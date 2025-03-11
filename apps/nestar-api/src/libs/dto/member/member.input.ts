import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, Length } from 'class-validator';
import { MemberAuthType, MemberType } from '../../enums/member.enum';

@InputType()
export class MemberInput {
	@IsNotEmpty() // bo'sh bo'lmasligini ta'minlaydigon decorator
	@Length(3, 12) // nickname ni min va max nechta bo'lishi
	@Field(() => String) // (memberNick) qanday turda bo‘lishini belgilaydi.
	memberNick: string;

	@IsNotEmpty()
	@Length(5, 12)
	@Field(() => String)
	memberPassword: string;

	@IsNotEmpty()
	@Field(() => String)
	memberPhone: string;

	@IsOptional()  // bo'lishi ham bo'lmasligi ham mumkin
   
	@Field(() => MemberType, { nullable: true })  // bo'sh bo'lishi mumkin
	memberType?: MemberType;

	@IsOptional()
	@Field(() => MemberAuthType, { nullable: true })
	memberAuthType?: MemberAuthType;  // member.enum.ts fileda ko'rsatilgan
}

@InputType()
export class LoginInput {
	@IsNotEmpty()
	@Length(3, 12)
	@Field(() => String)
	memberNick: string;

	@IsNotEmpty()
	@Length(5, 12)
	@Field(() => String)
	memberPassword: string;
}
