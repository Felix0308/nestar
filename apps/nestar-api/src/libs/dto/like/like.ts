import { Field, ObjectType } from '@nestjs/graphql';
import { LikeGroup } from '../../enums/like.enum';
import { ObjectId } from 'mongoose';

// javob qaytarilayotfganda
@ObjectType()  // murojatchi malum bir targetga like bosgan yoki bosmaganligini aniqlab beruvchi object type
export class MeLiked {
	@Field(() => String)
	memberId: ObjectId;

	@Field(() => String)
	likeRefId: ObjectId;

	@Field(() => Boolean)
	myFavorite: boolean;
}

@ObjectType() // like hosil bo'lganda qanday keylar bo'ladi
export class Like {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => LikeGroup)
	likeGroup: LikeGroup;

	@Field(() => String)
	likeRefId: ObjectId;

	@Field(() => String)
	memberId: ObjectId;

	@Field(() => Date)
	createdAt: Date; // mongodb avtomatic hosil qiolib beradi

	@Field(() => Date)
	updatedAt: Date; // mongodb avtomatic hosil qiolib beradi
}


