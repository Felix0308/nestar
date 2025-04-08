import { Logger } from '@nestjs/common';
import { OnGatewayInit, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { Server } from 'ws';

@WebSocketGateway({ transports: ['websocket'], secure: false })
//TCP connection qaysi transports ni qo'llashi, va secure bo''lishini talab etmaymiz
export class SocketGateway implements OnGatewayInit {
	private logger: Logger = new Logger('SocketEventsGateway');
	private summaryClient: number = 0; // WebSocketga ulangan clientlar soni

	public afterInit(server: Server) {
		// afterInit methodini chaqirib oldik, type Server bo'ladi
		this.logger.log(`WebSocket Server Initialized total ${this.summaryClient}`);
	}

	handleConnection(client: WebSocket, ...args: any[]) {
		// WebSocketga yangi clientlar ulangan vaqti ushbu method ishga tushadi
		this.summaryClient++; // birinchi ulangan vaqti clientlar soni 1 ga oshishi kerak
		this.logger.log(`==Client connected total: ${this.summaryClient} ==`);
	}

	handleDisconnect(client: WebSocket) {
		// WebSocketga ulanagan clientlar browserdan chiqib ketganda, connection yo'qolganda bu method ishga tushadi
		this.summaryClient--;
		this.logger.log(`==Client disconnected left total: ${this.summaryClient} ==\n`);
	}

	@SubscribeMessage('message')
	handleMessage(client: any, payload: any): string {
		return 'Hello world!';
	}
}
