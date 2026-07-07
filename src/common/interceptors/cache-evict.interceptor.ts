import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Observable, tap } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { CACHE_EVICT_OPTIONS, CacheEvictOptions } from '../decorators/cache-evict.decorator';

@Injectable()
export class CacheEvictInterceptor implements NestInterceptor {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const options = this.reflector.get<CacheEvictOptions>(
      CACHE_EVICT_OPTIONS,
      context.getHandler(),
    );

    if (!options) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async () => {
        const request = context.switchToHttp().getRequest();
        const companyId = request.user?.companyId;
        const store = this.cacheManager.store;

        // Verify if store supports keys() lookup
        if (!store.keys) {
          return;
        }

        const allKeys = await store.keys();
        let prefix = '';

        if (options.isTenantScoped && companyId) {
          prefix = `tenant:${companyId}:/api/v1/${options.key}`;
        } else {
          prefix = `/api/v1/${options.key}`;
        }

        const keysToEvict = allKeys.filter((key) => key.startsWith(prefix));
        
        await Promise.all(keysToEvict.map((key) => this.cacheManager.del(key)));
      }),
    );
  }
}
