import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { Properties, Property } from '../../libs/dto/property/property';
import { Direction, Message } from '../../libs/enums/common.enum';
import {
	AgentPropertiesInquiry,
	AllPropertiesInquiry,
	PISearch,
	PropertiesInquiry,
	PropertyInput,
} from '../../libs/dto/property/property.input';
import { MemberService } from '../member/member.service';
import { StatisticModifier, T } from '../../libs/types/common';
import { PropertyStatus } from '../../libs/enums/property.enum';
import { ViewGroup } from '../../libs/enums/view.enum';
import { ViewInput } from '../../libs/dto/view/view.input';
import { ViewService } from '../view/view.service';
import { PropertyUpdate } from '../../libs/dto/property/property.update';
import * as moment from 'moment';
import { lookupMember, shapeIntoMongoObjectId } from '../../libs/config';
import { LikeInput } from '../../libs/dto/like/like.input';
import { LikeGroup } from '../../libs/enums/like.enum';
import { LikeService } from '../like/like.service';

@Injectable()
export class PropertyService {
	constructor(
		@InjectModel('Property') private readonly propertyModel: Model<Property>,
		private memberService: MemberService,
		private viewService: ViewService,
		private likeService: LikeService,
	) {}

	public async createProperty(input: PropertyInput): Promise<Property> {
		try {
			const result = await this.propertyModel.create(input);
			await this.memberService.memberStatsEditor({
				_id: result.memberId,
				targetKey: 'memberProperties',
				modifier: 1,
			});
			return result;
		} catch (err) {
			console.log('Error, Service.model:', err.message);
			throw new BadRequestException(Message.CREATE_FAILED);
		}
	}

	public async getProperty(memberId: ObjectId | null, propertyId: ObjectId): Promise<Property> {
		const search: T = {
			_id: propertyId,
			propertyStatus: PropertyStatus.ACTIVE,
		};

		const targetProperty: Property | null = await this.propertyModel.findOne(search).lean().exec();
		if (!targetProperty) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		if (memberId) {
			// Authenticate bo'lgan member murojat qilganda
			const viewInput: ViewInput = { memberId: memberId, viewRefId: propertyId, viewGroup: ViewGroup.PROPERTY };
			const newView = await this.viewService.recordView(viewInput);

			if (newView) {
				await this.propertyStatsEditor({ _id: propertyId, targetKey: 'propertyViews', modifier: 1 });
				targetProperty.propertyViews++;
			}

			// meLiked
			const likeInput: LikeInput = { memberId: memberId, likeRefId: propertyId, likeGroup: LikeGroup.PROPERTY };
			targetProperty.meLiked = await this.likeService.checkLikeExistence(likeInput);
		}

		targetProperty.memberData = await this.memberService.getMember(null, targetProperty.memberId);
		return targetProperty;
	}

	public async updateProperty(memberId: ObjectId, input: PropertyUpdate): Promise<Property> {
		let { propertyStatus, soldAt, deletedAt } = input;
		console.log('propertyStatus:', propertyStatus);
		console.log('soldAt:', soldAt);
		console.log('deletedAt:', deletedAt);

		const search: T = {
			// serching object hosil qilindi
			_id: input._id, // aynan qaysi propertyni update qilish kerakligi
			memberId: memberId, // agent mizni propertysi bo'lishi shart, agent o'zini propetysini yangilay olishi shart
			propertyStatus: PropertyStatus.ACTIVE, // faqat ACTIV holatdagi propertylarni agentlar update qila oladi
		};

		// if (propertyStatus === PropertyStatus.SOLD) soldAt = moment().toDate();  // savdo vaqti ro'yxatga olinyapti
		// else if (propertyStatus === PropertyStatus.DELETE) deletedAt = moment().toDate();  // o'chirilayotgan vaqti

		if (propertyStatus === PropertyStatus.SOLD) soldAt = new Date();
		else if (propertyStatus === PropertyStatus.DELETE) deletedAt = new Date();

		const result = await this.propertyModel.findOneAndUpdate(search, input, { new: true }).exec(); // updateni standart holatda amalga oshiryapmiz
		if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);

		if (soldAt || deletedAt) {
			// qachonki status o'zgarsa agentni memberProperties soni 1 ga kamayadi
			await this.memberService.memberStatsEditor({
				_id: memberId,
				targetKey: 'memberProperties',
				modifier: -1,
			});
		}

		return result;
	}

	public async getProperties(memberId: ObjectId, input: PropertiesInquiry): Promise<Properties> {
		const { page, limit, sort, direction, search } = input;

		const match: T = { propertyStatus: PropertyStatus.ACTIVE }; // faqta ACTIV propertylarni ko'rish huquqiga ega bo'ladi
		const sortFinal: T = { [sort ?? 'createdAt']: direction ?? Direction.DESC };

		this.shapeMatchQuery(match, search); // OOP match referance bitta shuning uchun return qabul qilishimiz shart emas
		console.log('match:', match);

		const result = await this.propertyModel
			.aggregate([
				{ $match: match },
				{ $sort: sortFinal },
				{
					$facet: {
						list: [
							{ $skip: page - 1 },
							{ $limit: limit },
							//meliked
							lookupMember, // config.ts da logic yozilgan
							{ $unwind: '$memberData' }, // array ichidagi malumotni memberData ga to'g'rilab berayapti
						],

						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();
		if (!result) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		return result[0];
	}

	private shapeMatchQuery(match: T, search: PISearch): void {
		// input asosida matchni qiymatlarini shakllantirib olyapmiz
		const {
			memberId, // distarction qilyapmiz: inputni ichidan quyidagi malumotlarni qabul qilyapmiz
			locationList,
			typeList,
			roomList,
			bedsList,
			options,
			pricesRange,
			periodsRange,
			squaresRange,
			text,
		} = search;

		if (memberId) match.memberId = shapeIntoMongoObjectId(memberId); // memberId mavjud bo'lsa matchga memberId ni yuklayapmiz, ayni agentimizni propertylarini olib beradi
		if (locationList) match.propertyLocation = { $in: locationList }; // aynan locationlistlarni olib beradi arrayda
		if (roomList) match.propertyRooms = { $in: roomList };
		if (bedsList) match.propertyBeds = { $in: bedsList };
		if (typeList) match.propertyType = { $in: typeList };

		if (pricesRange) match.propertyPrice = { $gte: pricesRange.start, $lte: pricesRange.end };
		// $gte: katta yoki teng, $lte: kichik yoki teng
		if (periodsRange) match.constructedAt = { $gte: periodsRange.start, $lte: periodsRange.end };
		if (squaresRange) match.propertySquare = { $gte: squaresRange.start, $lte: squaresRange.end };

		if (text) match.propertyTitle = { $regex: text, $options: 'i' }; // regular expression orqali searching ni amalga oshiryapmiz
		if (options) {
			match['$or'] = options.map((ele) => {
				// qaytarilagn qiymatni 'Or' bilan olyapmiz
				return { [ele]: true }; // ele - qiymat
			});
		}
	}

	public async getAgentProperties(memberId: ObjectId, input: AgentPropertiesInquiry): Promise<Properties> {
		const { page, limit, sort, direction, search } = input;

		const { propertyStatus } = search;
		if (propertyStatus === PropertyStatus.DELETE) throw new BadRequestException(Message.NOT_ALLOWED_REQUEST);

		const match: T = {
			memberId: memberId,
			propertyStatus: propertyStatus ?? { $ne: PropertyStatus.DELETE }, // DELETE ga teng bo'lmasligi kerak
		};
		const sortFinal = { [sort ?? 'createdAt']: direction ?? Direction.DESC };

		const result = await this.propertyModel
			.aggregate([
				{ $match: match },
				{ $sort: sortFinal },
				{
					$facet: {
						list: [{ $skip: page - 1 }, { $limit: limit }, lookupMember, { $unwind: '$memberData' }],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();
		if (!result) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		return result[0];
	}

	public async likeTargetProperty(memberId: ObjectId, likeRefId: ObjectId): Promise<Property> {
		const target: Property | null = await this.propertyModel
			.findOne({ _id: likeRefId, propertyStatus: PropertyStatus.ACTIVE })
			.exec();
		if (!target) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		const input: LikeInput = { 
			memberId: memberId, 
			likeRefId: likeRefId, 
			likeGroup: LikeGroup.PROPERTY 
		};

		const modifier = await this.likeService.toggleLike(input);
		const result = await this.propertyStatsEditor({
			// propertyni static datasi yangilanadi
			_id: likeRefId,
			targetKey: 'propertyLikes',
			modifier: modifier,
		});
		if (!result) throw new InternalServerErrorException(Message.SOMETHING_WENT_WRONG);

		return result;
	}

	/** ADMIN */
	public async getAllPropertiesByAdmin(input: AllPropertiesInquiry): Promise<Properties> {
		const { page, limit, sort, direction, search } = input;
		const { propertyStatus, propertyLocationList } = search;

		const match: T = {}; // match objectni hosil qildik
		const sortFinal = { [sort ?? 'createdAt']: direction ?? Direction.DESC };
		// kiritilmagan bo'lsa default qiymatlarini ko'rsatyapmiz

		if (propertyStatus) match.propertyStatus = propertyStatus;
		if (propertyLocationList) match.propertyLocation = { $in: propertyLocationList };
		// LocationList izlash mantig'ini matchni iciga yuklayapmiz

		const result = await this.propertyModel
			.aggregate([
				// aggregate static methodini chaqirib unga [] ni argument sifatida path bo'ladi
				{ $match: match }, // bitta pipelineda match  qilinyapti
				{ $sort: sortFinal }, // bitta pipelineda sort qilinyapti
				{
					$facet: {
						// faced orqali alohida 2 ta pipeline hosil qildik
						list: [
							// listda pagination qonuniyatini hosil qildik
							{ $skip: (input.page - 1) * input.limit }, // qatorlarni o'tkazib yuborish
							{ $limit: input.limit }, // faqat kerkali miqdordagi qatorni olib beradi
							lookupMember, // [memberData] ni olib beradi
							{ $unwind: '$memberData' }, // bu [memberData] => arrayni tushirib memberData ni olib beradi
						],
						metaCounter: [{ $count: 'total' }],
						// pagination ni hosil qilyapmiz
					},
				},
			])
			.exec();
		if (!result) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		return result[0];
	}

	public async updatePropertyByAdmin(input: PropertyUpdate): Promise<Property> {
		let { propertyStatus, soldAt, deletedAt } = input;
		const search: T = {
			_id: input._id,
			propertyStatus: PropertyStatus.ACTIVE, // AMIN faqat ACTIVE propertylarni o'zgartirishi mumkin
		};

		if (propertyStatus === PropertyStatus.SOLD) input.soldAt = moment().toDate();
		// o'zgartirmoqwchi bo'lgan propetryimiz statusi SOLD bo'lsa uni vaqtini belgilayapmiz
		else if (propertyStatus === PropertyStatus.DELETE) input.deletedAt = moment().toDate();
		// propetryimiz statusi DELETE bo'lsa uni o'chirilgan vaqtini belgilayapmiz

		const result = await this.propertyModel
			.findOneAndUpdate(
				search, // yuqoridagi search objecti
				input, // o'zgarayotgan qiymatlar ketma ketigi
				{ new: true }, // o'zgargan qiymat
			)
			.exec();

		if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);

		if (soldAt || deletedAt) {
			// agar admin soldAt yoki deletedAt qilgan bo'lsa
			await this.memberService.memberStatsEditor({
				_id: result.memberId, // propertyimizni egasini
				targetKey: 'memberProperties', // memberProperties sonini
				modifier: -1, // -1 ga kamaytiramiz
			});
		}

		return result;
	}

	public async removePropertyByAdmin(propertyId: ObjectId): Promise<Property> {
		const search: T = { _id: propertyId, propertyStatus: PropertyStatus.DELETE };
		// {biz o'chirmoqchi bo'lgan propertyIDsi, faqat statusi DELETE bo'lgan propertyni o'chira olamiz}
		const result = await this.propertyModel.findOneAndDelete(search).exec();
		if (!result) throw new InternalServerErrorException(Message.REMOVE_FAILED);
		// agar o'chirilmagan bo'lsa shu mantiq ishga tushadi

		return result;
	}

	public async propertyStatsEditor(input: StatisticModifier): Promise<Property> {
		const { _id, targetKey, modifier } = input;
		return (await this.propertyModel
			.findByIdAndUpdate({ _id }, { $inc: { [targetKey]: modifier } }, { new: true })
			.exec()) as unknown as Property;
	}
}
