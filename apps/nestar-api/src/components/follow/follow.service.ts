import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Follower, Followers, Following, Followings } from '../../libs/dto/follow/follow';
import { Model, ObjectId } from 'mongoose';
import { MemberService } from '../member/member.service';
import { Direction, Message } from '../../libs/enums/common.enum';
import { FollowInquiry } from '../../libs/dto/follow/follow.input';
import { T } from '../../libs/types/common';
import { lookupFollowerData, lookupFollowingData } from '../../libs/config';

@Injectable()
export class FollowService {
	constructor(
		@InjectModel('Follow') private readonly followModel: Model<Follower | Following>,
		private readonly memberService: MemberService,
	) {}

	public async subscribe(followerId: ObjectId, followingId: ObjectId): Promise<Follower> {
		if (followerId.toString() === followingId.toString()) {  
            // har ikkla objectID ni stringga o'tkazib solishtiryapmiz, 
            // referencelari boshqa bo'lganligi uchun to'g'ridan to'g'ri qiymatlarini solishtira olmaymiz
			throw new InternalServerErrorException(Message.SELF_SUBSCRIPTION_DENIED);
		}

		const targetMember = await this.memberService.getMember(null, followingId); 
        // detail pageda emasligi uchun birinchi murojatchimiz null bo'ladui
		if (!targetMember) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		const result = await this.registerSubscription(followerId, followingId);  // ro'yhatga olish

		await this.memberService.memberStatsEditor({ _id: followerId, targetKey: 'memberFollowings', modifier: 1 });
		await this.memberService.memberStatsEditor({ _id: followingId, targetKey: 'memberFollowers', modifier: 1 });

		return result;
	}

	private async registerSubscription(followerId: ObjectId, followingId: ObjectId): Promise<Follower> {
		try {
			return await this.followModel.create({ 
                followingId: followingId, 
                followerId: followerId 
            });
		} catch (err) {
			console.log('Error, Service.model', err);
			throw new BadRequestException(Message.CREATE_FAILED);
		}
	}

	public async unsubscribe(followerId: ObjectId, followingId: ObjectId): Promise<Follower> {
		const targetMember = await this.memberService.getMember(null, followingId);
		if (!targetMember) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		const result = await this.followModel.findOneAndDelete({ 
            followingId: followingId, 
            followerId: followerId 
        });
		if (!result) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		await this.memberService.memberStatsEditor({ _id: followerId, targetKey: 'memberFollowings', modifier: -1 });
        // birlik argumentni path qilyapmiz
		await this.memberService.memberStatsEditor({ _id: followingId, targetKey: 'memberFollowers', modifier: -1 });

		return result;
	}

	public async getMemberFollowings(memberId: ObjectId | null, input: FollowInquiry): Promise<Followings> {
		const { page, limit, search } = input;
		if (!search?.followerId) throw new InternalServerErrorException(Message.BAD_REQUEST);
        // agar followerId null ni tashkil etgan bo'lsa (fronteddan yuborilmagan bo'lsa), backend validationni amalga oshirdik

		const match: T = { followerId: search?.followerId };
		console.log('match', match);

		const result = await this.followModel
			.aggregate([
				{ $match: match },
				{ $sort: { created: Direction.DESC } },  // Direction Decending ko'rinishida bo'lyapti
				{
					$facet: {  // faced orqali hozirgi pipeline 2 ta mustaqil pipeline ga ajratib bir vaqtning o'zida ikkala pipelinedan foydalanish imkonini beradi
						list: [
							{ $skip: (page - 1) * limit },
							{ $limit: limit },
                            // meLiked
                            // meFollowed
							lookupFollowingData,
							{ $unwind: '$followingData' },  // following bo'lgan memberni to'liq malumotini olib beradi
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();
		if (!result) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		return result[0];
	}

	public async getMemberFollowers(memberId: ObjectId | null, input: FollowInquiry): Promise<Followers> {
		const { page, limit, search } = input;
		if (!search?.followingId) throw new InternalServerErrorException(Message.BAD_REQUEST);

		const match: T = { followingId: search?.followingId }; 
        // followingId ni search?.followingId ga teng bo'lgandagi qiymatini matchga tenglayabmiz.
		console.log('match', match);

		const result = await this.followModel
			.aggregate([  // database server ni maydonida hosil bo'ladi
				{ $match: match },
				{ $sort: { created: Direction.DESC } },
				{
					$facet: {
						list: [
							{ $skip: (page - 1) * limit },
							{ $limit: limit },
							// meLiked
							// meFollowed
							lookupFollowerData,
							{ $unwind: '$followerData' },
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();
		if (!result) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		return result[0];
	}
}
