import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const httpCtx = context.switchToHttp();
    const response = httpCtx.getResponse();

    return next.handle().pipe(
      map((res) => {
        const statusCode = response.statusCode || 200;

        if (res && typeof res === 'object' && 'data' in res && 'message' in res) {
          return {
            statusCode,
            message: String(res.message),
            data: res.data,
          };
        }

        if (res && typeof res === 'object' && 'statusCode' in res && 'data' in res) {
          return res as ApiResponse<T>;
        }

        return {
          statusCode,
          message: 'Operation completed successfully',
          data: res === undefined ? null : res,
        };
      }),
    );
  }
}
