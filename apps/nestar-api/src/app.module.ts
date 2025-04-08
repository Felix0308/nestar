import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver } from '@nestjs/apollo';
import { AppResolver } from './app.resolver';
import { ComponentsModule } from './components/components.module';
import { DatabaseModule } from './database/database.module';
import { T } from './libs/types/common';
import { SocketModule } from './socket/socket.module';

@Module({  
	imports: [
		ConfigModule.forRoot(),
		GraphQLModule.forRoot({
			driver: ApolloDriver,
			playground: true,
			uploads: false,
			autoSchemaFile: true,
			formatError: (error: T) => {
				// graphQl da ixtiyoriy errorni olib beradi
				// console.log('error:', error);
				const graphqlFormattedError = {
					// errorni bir standartga keltirdik
					code: error?.extensions.code,
					message: error?.extensions?.response?.message || 
					error?.extensions?.response?.message || 
					error?.message,
				};

				console.log('GraphQL global Error:', graphqlFormattedError);
				return graphqlFormattedError;
			},
		}),
		ComponentsModule, // HTTP
		DatabaseModule, // TCP
		SocketModule, 
	],
	controllers: [AppController],  // bu server Rest Api sifatiada run bo'lyapti
	providers: [AppService, AppResolver],  // graphQL sifatida ham run bo'lyapti
})
export class AppModule {}
