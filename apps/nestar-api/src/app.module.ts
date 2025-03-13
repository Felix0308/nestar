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
				console.log('error:', error);
				const graphqlFormattedError = {
					// errorni bir standartga keltirdik
					code: error?.extensions.code,
					message: error?.extensions?.response?.message || error?.extensions?.response?.message || error?.message,
				};

				console.log('GraphQL global Error:', graphqlFormattedError);
				return graphqlFormattedError;
			},
		}),
		ComponentsModule, // HTTP
		DatabaseModule, // TCP
	],
	controllers: [AppController],
	providers: [AppService, AppResolver],
})
export class AppModule {}
