import { CacheInterceptor } from '@nestjs/cache-manager';
import { CallHandler, ExecutionContext, Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class TenantCacheInterceptor extends CacheInterceptor {
  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const response = context.switchToHttp().getResponse();
    const cacheKey = await this.trackBy(context);

    if (cacheKey) {
      try {
        const cachedValue = await this.cacheManager.get(cacheKey);
        if (cachedValue !== undefined && cachedValue !== null) {
          if (response && typeof response.header === 'function') {
            response.header('X-Cache', 'HIT');
          }
        } else {
          if (response && typeof response.header === 'function') {
            response.header('X-Cache', 'MISS');
          }
        }
      } catch {
        // Fallback silently
      }
    }

    return super.intercept(context, next);
  }
  protected trackBy(
    context: ExecutionContext,
  ): string | Promise<string | null | undefined> | null | undefined {
    const request = context.switchToHttp().getRequest();
    const cacheKey = super.trackBy(context);

    if (!cacheKey) {
      return undefined;
    }

    // Get company ID from the authenticated user context (injected by JwtAuthGuard)
    const companyId = request.user?.companyId;

    // Partition the cache key by the companyId to prevent cross-tenant data leaks
    if (companyId) {
      if (cacheKey instanceof Promise) {
        return cacheKey.then((key) => (key ? `tenant:${companyId}:${key}` : undefined));
      }
      return `tenant:${companyId}:${cacheKey}`;
    }

    return cacheKey;
  }
}
