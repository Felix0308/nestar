import { Injectable } from '@nestjs/common';

@Injectable()
export class MemberService {
	public async signup(): Promise<string> {
		return 'Signup excuted';
	}
	public async login(): Promise<string> {
		return 'Login excuted';
	}
	public async updateMember(): Promise<string> {
		return 'UpdateMember excuted';
	}
	public async getMember(): Promise<string> {
		return 'getMember excuted';
	}
}
