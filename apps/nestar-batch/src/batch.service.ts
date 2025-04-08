import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Member } from 'apps/nestar-api/src/libs/dto/member/member';
import { Property } from 'apps/nestar-api/src/libs/dto/property/property';
import { MemberStatus, MemberType } from 'apps/nestar-api/src/libs/enums/member.enum';
import { PropertyStatus } from 'apps/nestar-api/src/libs/enums/property.enum';
import { Model } from 'mongoose';

@Injectable()
export class BatchService {
	public getHello(): string {
		return 'Welcome to Nestar BATCH Server!';
	}
	public async batchRollback(): Promise<void> {
		console.log('batchRollback');
	}

	public async batchProperties(): Promise<void> {
		console.log('batchProperties');
	}

	public async batchAgents(): Promise<void> {
		console.log('batchAgents');
	}
}
