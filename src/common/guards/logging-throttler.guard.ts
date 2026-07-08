import { ExecutionContext, Inject, Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail, ThrottlerRequest } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LoggingThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(LoggingThrottlerGuard.name);

  @Inject(ConfigService)
  private readonly configService: ConfigService;

  protected async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    const { context } = requestProps;
    const req = context.switchToHttp().getRequest();

    // Check if it's a sensitive auth POST endpoint
    const isSensitiveAuthRoute =
      req.method === 'POST' &&
      (req.url.endsWith('/login') ||
        req.url.endsWith('/forgot-password') ||
        req.url.endsWith('/reset-password') ||
        req.url.endsWith('/accept-invitation'));

    if (isSensitiveAuthRoute) {
      requestProps.limit = this.configService.get<number>('THROTTLER_AUTH_LIMIT') ?? 5;
    }

    return super.handleRequest(requestProps);
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const req = context.switchToHttp().getRequest();
    this.logger.warn(
      `Rate limit exceeded: IP=${req.ip}, Route=${req.method} ${req.originalUrl || req.url}, Limit=${throttlerLimitDetail.limit}, TTL=${throttlerLimitDetail.ttl}ms`,
    );
    await super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
