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

@Injectable()
export class PropertyService {
	constructor(
		@InjectModel('Property') private readonly propertyModel: Model<Property>,
		private memberService: MemberService,
		private viewService: ViewService,
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
			const viewInput: ViewInput = { memberId: memberId, viewRefId: propertyId, viewGroup: ViewGroup.PROPERTY };
			const newView = await this.viewService.recordView(viewInput);

			if (newView) {
				await this.propertyStatsEditor({ _id: propertyId, targetKey: 'propertyViews', modifier: 1 });
				targetProperty.propertyViews++;
			}

			// meLiked
		}

		targetProperty.memberData = await this.memberService.getMember(null, targetProperty.memberId);
		return targetProperty;
	}

	public async propertyStatsEditor(input: StatisticModifier): Promise<Property> {
		const { _id, targetKey, modifier } = input;
		return (await this.propertyModel
			.findByIdAndUpdate({ _id }, { $inc: { [targetKey]: modifier } }, { new: true })
			.exec()) as unknown as Property;
	}

	public async updateProperty(memberId: ObjectId, input: PropertyUpdate): Promise<Property> {
		let { propertyStatus, soldAt, deletedAt } = input;
		console.log('propertyStatus:', propertyStatus);
		console.log('soldAt:', soldAt);
		console.log('deletedAt:', deletedAt);

		const search: T = {
			// serching object hosil qilindi
			_id: input._id,
			memberId: memberId,
			propertyStatus: PropertyStatus.ACTIVE, // faqat ACTIV holatdagi propertylarni agentlar update qila oladi
		};

		// if (propertyStatus === PropertyStatus.SOLD) soldAt = moment().toDate();  // savdo vaqti ro'yxatga olinyapti
		// else if (propertyStatus === PropertyStatus.DELETE) deletedAt = moment().toDate();  // o'chirilayotgan vaqti

		if (propertyStatus === PropertyStatus.SOLD) soldAt = new Date();
		else if (propertyStatus === PropertyStatus.DELETE) deletedAt = new Date();

		const result = await this.propertyModel.findOneAndUpdate(search, input, { new: true }).exec();
		if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);

		if (soldAt || deletedAt) {
			await this.memberService.memberStatsEditor({
				_id: memberId,
				targetKey: 'memberProperties',
				modifier: -1,
			}); // agentni propertylar soni 1 ga kamaymoqda
		}

		return result;
	}

	public async getProperties(memberId: ObjectId, input: PropertiesInquiry): Promise<Properties> {
		const { page, limit, sort, direction, search } = input;

		const match: T = { propertyStatus: PropertyStatus.ACTIVE }; // faqta ACTIV propertylarni ko'rish huquqiga ega bo'ladi
		const sortFinal: T = { [sort ?? 'createdAt']: direction ?? Direction.DESC };

		this.shapeMatchQuery(match, search);
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
							{ $unwind: '$memberData' },
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
		const {
			memberId,
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

		if (memberId) match.memberId = shapeIntoMongoObjectId(memberId);
		if (locationList) match.propertyLocation = { $in: locationList };
		if (roomList) match.propertyRooms = { $in: roomList };
		if (bedsList) match.propertyBeds = { $in: bedsList };
		if (typeList) match.propertyType = { $in: typeList };

		if (pricesRange) match.propertyPrice = { $gte: pricesRange.start, $lte: pricesRange.end };
		// $gte: katta yoki teng, $lte: kichik yoki teng
		if (periodsRange) match.constructedAt = { $gte: periodsRange.start, $lte: periodsRange.end };
		if (squaresRange) match.propertySquare = { $gte: squaresRange.start, $lte: squaresRange.end };

		if (text) match.propertyTitle = { $regex: text, $options: 'i' };
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
			propertyStatus: propertyStatus ?? { $ne: PropertyStatus.DELETE },
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

	/** ADMIN */
	public async getAllPropertiesByAdmin(input: AllPropertiesInquiry): Promise<Properties> {
		const { page, limit, sort, direction, search } = input;
		const { propertyStatus, propertyLocationList } = search;

		const match: T = {};  // match objectni hosil qildik
		const sortFinal = { [sort ?? 'createdAt']: direction ?? Direction.DESC };

		if (propertyStatus) match.propertyStatus = propertyStatus;
		if (propertyLocationList) match.propertyLocation = { $in: propertyLocationList };

		const result = await this.propertyModel
			.aggregate([
				{ $match: match },
				{ $sort: sortFinal },
				{
					$facet: {
						list: [
							{ $skip: (input.page - 1) * input.limit },
							{ $limit: input.limit },  // [property1, propetry2]
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
}
