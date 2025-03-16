import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
	private readonly logger: Logger = new Logger();
	// Logger => kirib kelgan request va chiqib ketayotgan respsonselarni terminalga chop etib beradi.

	public intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const recordTime = Date.now();
		const requestType = context.getType<GqlContextType>();
		// kirib kelayotgan requestni typeni aniqlaydi

		if (requestType === 'http') {
			// Develop if needed
		} else if (requestType === 'graphql') {
			// (1) Print request
			const gqlContext = GqlExecutionContext.create(context);
            // console.log('gqlContext =>', gqlContext.getContext().req.body);
			this.logger.log(`${this.stringify(gqlContext.getContext().req.body)}`, 'REQUEST');

			// (2) Errors handling  via graphql
			// (3) error-free response
			return next.handle().pipe(
				tap((context) => {
					const responseTime = Date.now() - recordTime;
					// chop etish vaqtidan - request kirib kelgan vaqtni ayrib response timeni hosil qilyapmiz
					this.logger.log(`${this.stringify(context)} - ${responseTime}ms \n\n`, 'RESPONSE');
				}),
			);
		}
		return next.handle();
	}

	private stringify(context: ExecutionContext): string {  // to'liq ma'lumotni olib beradi
        // console.log(typeof context);
		return JSON.stringify(context).slice(0, 75); 
        // kirib kelayotgan requestni body qismi 0 dan 75 chi harfigacha chop etadi
	}
}
