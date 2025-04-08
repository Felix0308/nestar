import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { LoggingInterceptor } from './libs/interceptor/Logging.interceptor';
import { graphqlUploadExpress } from 'graphql-upload';
import * as express from 'express';
import { WsAdapter } from '@nestjs/platform-ws';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	app.useGlobalPipes(new ValidationPipe()); 
	// kiraytogan va chiqayotgan ma'lumotlarni datasini typeni tekshiradi
	// ValidationPipe ni global sifatiada integratsiyasini amalga oshirdik

	app.useGlobalInterceptors(new LoggingInterceptor()); 
	// kiraytogan va chiqayotgan ma'lumotlarni vaqtini logga chiqarib beradi

	app.enableCors({ origin: true, credentials: true }); 
	// ixtiyoriy domen requestlarni server qabul etishiga ruxsat beryapmiz

	app.use(graphqlUploadExpress({ maxFileSize: 15000000, maxFiles: 10 }));
	// serverni ximoyalash maqsadida yuklanadigon malumotlarni xajmini cheklaydigon middleware integration hosil qildik

	app.use('/uploads', express.static('./uploads')); 
	// uploads folderini tashqariga ochiqlayapmiz

	app.useWebSocketAdapter(new WsAdapter(app)); 
	// sock4etmodule o'z faoliyatini bajarishi uchun zamin yaratib beradi
	await app.listen(process.env.PORT_API ?? 3000);
}
bootstrap();
