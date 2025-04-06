import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { Like, MeLiked } from '../../libs/dto/like/like';
import { LikeInput } from '../../libs/dto/like/like.input';
import { T } from '../../libs/types/common';
import { Message } from '../../libs/enums/common.enum';
import { LikeGroup } from '../../libs/enums/like.enum';
import { OrdinaryInquiry } from '../../libs/dto/property/property.input';
import { Properties } from '../../libs/dto/property/property';
import { lookupFavorite } from '../../libs/config';

@Injectable()
export class LikeService {
	constructor(@InjectModel('Like') private readonly likeModel: Model<Like>) {}

	public async toggleLike(input: LikeInput): Promise<number> {
		// console.log('EXUCUTED');
		const search: T = { memberId: input.memberId, likeRefId: input.likeRefId, likeGroup: input.likeGroup };
		const exist = await this.likeModel.findOne(search).exec();
		let modifier = 1;

		if (exist) {
			await this.likeModel.findOneAndDelete(search).exec(); // agar mavjud bo'lsa like collectiondan ushbu logni o'chirib erishsini talab qilamiz
			modifier = -1; // likeni databasedan o'chiriladi
		} else {
			try {
				await this.likeModel.create(input); // likeni databasega (likes collexction) qo'shib beradi
			} catch (err) {
				console.log('Error, Service.model:', err.message);
				throw new BadRequestException(Message.CREATE_FAILED);
			}
		}
		console.log(`- Like modifier ${modifier} -`);
		return modifier;
	}

	public async checkLikeExistence(input: LikeInput): Promise<MeLiked[]> {
		const { memberId, likeRefId } = input;

		const result = await this.likeModel
			.findOne({
				memberId: memberId,
				likeRefId: likeRefId,
			})
			.exec();

		return result
			? [
					{
						memberId: memberId,
						likeRefId: likeRefId,
						myFavorite: true,
					},
				]
			: [];
	}

	public async getFavoriteProperties(memberId: ObjectId, input: OrdinaryInquiry): Promise<Properties> {
		const { page, limit } = input;
		const match: T = { LikeGroup: LikeGroup.PROPERTY, memberId: memberId };

		const data: T = await this.likeModel
			.aggregate([  // likes collectiondan biz like bosgan propertylarni izlamoqdamiz
				{ $match: match },
				{ $sort: { updatedAt: -1 } },  // eng oxirgi qo'ygan likemizga qarab sort qildik
				{
					$lookup: {
						from: 'properties',
						localField: 'likeRefId',
						foreignField: '_id',
						as: 'favoriteProperty',
					},
				},
				{ $unwind: '$favoriteProperty' },
				{
					$facet: {  // properties shaklidagi malumotlarni shakllantirish
						list: [
							{ $skip: (page - 1) * limit },
							{ $limit: limit },
							lookupFavorite,
							{ $unwind: '$favoriteProperty.memberData' },
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();
		// console.log('data:', data);

		// resultni shakllantirdik
		const result: Properties = { list: [], metaCounter: data[0].metaCounter };
		console.log('result:', result);

		result.list = data[0].list.map((ele) => ele.favoriteProperty);

		return result;
	}
}
