import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { Member, Members } from '../../libs/dto/member/member';
import { AgentsInquiry, LoginInput, MemberInput, MembersInquiry } from '../../libs/dto/member/member.input';
import { MemberStatus, MemberType } from '../../libs/enums/member.enum';
import { Direction, Message } from '../../libs/enums/common.enum';
import { AuthService } from '../auth/auth.service';
import { MemberUpdate } from '../../libs/dto/member/member.update';
import { StatisticModifier, T } from '../../libs/types/common';
import { ViewService } from '../view/view.service';
import { ViewGroup } from '../../libs/enums/view.enum';

@Injectable()
export class MemberService {
	constructor(
		@InjectModel('Member') private readonly memberModel: Model<Member>,
		private authService: AuthService,
		private viewService: ViewService,
	) {}

	public async signup(input: MemberInput): Promise<Member> {
		input.memberPassword = await this.authService.hashPassword(input.memberPassword);
		try {
			const result = await this.memberModel.create(input);
			result.accessToken = await this.authService.createToken(result);
			return result;
		} catch (err) {
			console.log('Error, Service.model:', err.message);
			throw new BadRequestException(Message.USED_MEMBER_NICK_OR_PHONE);
		}
	}

	public async login(input: LoginInput): Promise<Member> {
		const { memberNick, memberPassword } = input;
		console.log('input:', input);

		const response: Member | null = await this.memberModel
			.findOne({ memberNick: memberNick })
			.select('+memberPassword') // memberPassword ni by default olib beradi
			.exec();

		if (!response || response.memberStatus === MemberStatus.DELETE) {
			// user o'zini delete qilib chiqib ketgan bo'lsa
			throw new InternalServerErrorException(Message.NO_MEMBER_NICK);
		} else if (response.memberStatus === MemberStatus.BLOCK) {
			// agar user block bo'lgan bo'lsa
			throw new InternalServerErrorException(Message.BLOCKED_USER);
			// block massageni chiqar
		}

		const isMatch = await this.authService.comparePassword(input.memberPassword, response.memberPassword);
		if (!isMatch) throw new InternalServerErrorException(Message.WRONG_PASSWORD);
		response.accessToken = await this.authService.createToken(response);

		return response;
	}

	public async updateMember(memberId: ObjectId, input: MemberUpdate): Promise<Member> {
		const result: Member | null = await this.memberModel
			.findOneAndUpdate({ _id: memberId, memberStatus: MemberStatus.ACTIVE }, input, { new: true })
			.exec();

		if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);

		result.accessToken = await this.authService.createToken(result);
		// accessToken ni qayta qurishdan maqsad => user malumotlarini o'zgartirsa frontendda o'zgarishsiz qoladi
		return result;
	}

	public async getMember(memberId: ObjectId, targetId: ObjectId): Promise<Member> {
		const search: T = {
			_id: targetId,
			memberStatus: {
				$in: [MemberStatus.ACTIVE, MemberStatus.BLOCK],
				// ACTIVE va BLOCK bo'lgan member ma'lumotlarini ko'rish imkoniyati
			},
		};

		const targetMember: Member | null = await this.memberModel.findOne(search).lean().exec();
		if (!targetMember) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		if (memberId) { 
			// record view
			const viewInput = {
				memberId: memberId,
				viewRefId: targetId,
				viewGroup: ViewGroup.MEMBER,
			};
			const newView = await this.viewService.recordView(viewInput);
			if (newView) {
				await this.memberModel.findOneAndUpdate(search, { $inc: { memberViews: 1 } }, { new: true }).exec();
				targetMember.memberViews++;
			}
		}
		// meLiked
		// meFollowed

		return targetMember;
	}

	public async getAgents(memberId: ObjectId, input: AgentsInquiry): Promise<Members> {
		const { text } = input.search; // birorta textni search qilmoqchi bo'lsak input.searchdan olamiz
		const match: T = {
			memberType: MemberType.AGENT,
			memberStatus: MemberStatus.ACTIVE,
		};
		const sort: T = { [input?.sort ?? 'createdAt']: input?.direction ?? Direction.DESC }; //=> dinamic usul yoki bu => {createdAt: -1};

		if (text) match.memberNick = { $regex: new RegExp(text, 'i') }; // 'i' - ignore

		const result = await this.memberModel
			.aggregate([
				{ $match: match },
				{ $sort: sort },
				{
					$facet: {
						list: [{ $skip: (input.page - 1) * input.limit }, { $limit: input.limit }],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();
		if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		return result[0];
	}

	public async getAllMembersByAdmin(input: MembersInquiry): Promise<Members> {
		const { memberStatus, memberType, text } = input.search;
		const match: T = {}; // har qanday memberlarni olib berishi kerak
		const sort: T = { [input?.sort ?? 'createdAt']: input?.direction ?? Direction.DESC };

		if (memberStatus) match.memberStatus = memberStatus;
		if (memberType) match.memberType = memberType;
		if (text) match.memberNick = { $regex: new RegExp(text, 'i') };

		const result = await this.memberModel
			.aggregate([
				{ $match: match },
				{ $sort: sort },
				{
					$facet: {
						list: [{ $skip: (input.page - 1) * input.limit }, { $limit: input.limit }], // biz talab etayotgan memberlar
						metaCounter: [{ $count: 'total' }], // database dagi memberlarni umumiy sonini taqdim etadi
					},
				},
			])
			.exec();

		if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		return result[0];
	}

	public async updateMemberByAdmin(input: MemberUpdate): Promise<Member> {
		const result: Member | null = await this.memberModel
			.findOneAndUpdate({ _id: input._id }, input, { new: true })
			.exec();
		if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);
		return result;
	}

	public async memberStatsEditor(input: StatisticModifier): Promise<Member | null> {
		console.log('executed');
		const { _id, targetKey, modifier } = input;
		return await this.memberModel
			.findByIdAndUpdate(
				_id,
				{
					$inc: { [targetKey]: modifier }, // increase syntaxsis
				},
				{ new: true },
			)
			.exec();
	}
}
