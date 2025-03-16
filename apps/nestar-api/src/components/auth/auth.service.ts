import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Member } from '../../libs/dto/member/member';
import { JwtService } from '@nestjs/jwt';
import { T } from '../../libs/types/common';

@Injectable()
export class AuthService {
	constructor(private jwtService: JwtService) {}
	public async hashPassword(memberPassword: string): Promise<string> {
		const salt = await bcrypt.genSalt();

		return await bcrypt.hash(memberPassword, salt);
	}
	public async comparePassword(password: string, hashedPassword: string | undefined): Promise<boolean> {
		return bcrypt.compare(password, hashedPassword);
	}
	public async createToken(member: Member): Promise<string> {
        console.log('member:', member);
        
		const playload: T = {};

		Object.keys(member['_doc'] ? member['_doc'] : member).map((ele) => {
			playload[`${ele}`] = member[`${ele}`];
		});
		delete playload.memberPassword;

		return await this.jwtService.signAsync(playload);
	}
	public async verifyToken(token: string): Promise<Member> {
		const member = await this.jwtService.verifyAsync(token);
		return member;
	}
}
