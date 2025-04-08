import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Member } from 'apps/nestar-api/src/libs/dto/member/member';
import { Property } from 'apps/nestar-api/src/libs/dto/property/property';
import { MemberStatus, MemberType } from 'apps/nestar-api/src/libs/enums/member.enum';
import { PropertyStatus } from 'apps/nestar-api/src/libs/enums/property.enum';
import { Model } from 'mongoose';

@Injectable()
export class BatchService {
	constructor(  // 2 ta schema moduleni Inject qildik, Inject qilishda @InjectModel yordamga keladi
		@InjectModel('Property') private readonly propertyModel: Model<Property>,
		@InjectModel('Member') private readonly memberModel: Model<Member>,
	) {}

	public async batchRollback(): Promise<void> {
		await this.propertyModel
			.updateMany(
				// static method - aynan qaysi turdagi malumotlarni o'zgartiramiz
				{
					propertyStatus: PropertyStatus.ACTIVE,
				},
				{ propertyRank: 0 }, // aynan qaysi malumotga o'zgartirishimizni belgilab beradi
			)
			.exec();

		await this.memberModel
			.updateMany(  // aynan qaysi malumotlarni qo'lga olish kerakligi
				{
					memberStatus: MemberStatus.ACTIVE,
					memberType: MemberType.AGENT,
				},
				{ memberRank: 0 },
			)
			.exec();
	}

	public async batchTopProperties(): Promise<void> {
		const properties: Property[] = await this.propertyModel
			.find({
				propertyStatus: PropertyStatus.ACTIVE,
				propertyRank: 0,
			})
			.exec();

		const promisedList = properties.map(async (ele: Property) => {  // array ustida iteration methodni qo'llab, har bitta elementni qo'lga olyabmiz
			const { _id, propertyLikes, propertyViews } = ele;  // distraction qilyapmiz
			const rank = propertyLikes * 2 + propertyViews * 1;  // qonuniyat yaratilmoqda
			return await this.propertyModel.findByIdAndUpdate(_id, { propertyRank: rank });  // propertyRankni o'zgartiryapmiz
		});
		await Promise.all(promisedList);
	}

	public async batchTopAgents(): Promise<void> {
		const agents: Member[] = await this.memberModel
			.find({
				memberType: MemberType.AGENT,
				propertyStatus: MemberStatus.ACTIVE,
				propertyRank: 0, 
			})
			.exec();

		const promisedList = agents.map(async (ele: Member) => {
			const { _id, memberProperties, memberLikes, memberArticles, memberViews } = ele;
			const rank = memberProperties * 5 + memberArticles * 3 + memberLikes * 2 + memberViews * 1;
			return await this.propertyModel.findByIdAndUpdate(_id, { memberRank: rank });
		});
		await Promise.all(promisedList);  // har birini to'liq ishga tushirib beradi
	}

	public getHello(): string {
		return 'Welcome to Nestar BATCH Server!';
	}
}
