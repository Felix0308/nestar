import { Logger } from '@nestjs/common';
import { OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'ws';
import * as WebSocket from 'ws';

interface MessagePayload {
	event: string;
	text: string;
}

interface InfoPayload {
	event: string;
	totalClients: number;
}

@WebSocketGateway({ transports: ['websocket'], secure: false })
//TCP connection qaysi transports ni qo'llashi, va secure bo''lishini talab etmaymiz
export class SocketGateway implements OnGatewayInit {
	private logger: Logger = new Logger('SocketEventsGateway');
	private summaryClient: number = 0; // WebSocketga ulangan clientlar soni

	@WebSocketServer()
	server: Server;

	public afterInit(server: Server) {
		// afterInit methodini chaqirib oldik, type Server bo'ladi
		this.logger.verbose(`WebSocket Server Initialized & total [${this.summaryClient}]`);
	}

	handleConnection(client: WebSocket, ...args: any[]) {
		// WebSocketga yangi clientlar ulangan vaqti ushbu method ishga tushadi
		this.summaryClient++; // birinchi ulangan vaqti clientlar soni 1 ga oshishi kerak
		this.logger.verbose(`Connection & total: [${this.summaryClient}]`);

		const infoMsg: InfoPayload = {
			event: 'info',
			totalClients: this.summaryClient,
		};
		this.emitMessage(infoMsg);
	}

	handleDisconnect(client: WebSocket) {
		// WebSocketga ulanagan clientlar browserdan chiqib ketganda, connection yo'qolganda bu method ishga tushadi
		this.summaryClient--;
		this.logger.verbose(`Disconnection & total: [${this.summaryClient}]`);

		const infoMsg: InfoPayload = {
			event: 'info',
			totalClients: this.summaryClient,
		};
		this.broadcastMessage(client, infoMsg);
	}

	@SubscribeMessage('message')
	public async handleMessage(client: WebSocket, payload: string): Promise<void> {
		const newMessage: MessagePayload = { event: 'message', text: payload };

		this.logger.verbose(`NEW MESSAGE ${payload}`);
		this.emitMessage(newMessage);
	}

	private broadcastMessage(sender: WebSocket, message: InfoPayload | MessagePayload) {
		this.server.clients.forEach((client) => {
			if (client !== sender && client.readyState === WebSocket.OPEN) {
				client.send(JSON.stringify(message));
			}
		});
	}

	private emitMessage(message: InfoPayload | MessagePayload) {
		this.server.clients.forEach((client) => {
			if (client.readyState === WebSocket.OPEN) {
				client.send(JSON.stringify(message));
			}
		});
	}
}
