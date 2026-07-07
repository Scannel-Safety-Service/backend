import { SetMetadata } from '@nestjs/common';

export interface CacheEvictOptions {
  /**
   * The base key pattern to invalidate (e.g. 'categories' or 'standard-documents')
   */
  key: string;

  /**
   * Whether the cache keys are tenant-scoped (includes companyId)
   */
  isTenantScoped?: boolean;
}

export const CACHE_EVICT_OPTIONS = 'cache_evict_options';

export const CacheEvict = (options: CacheEvictOptions) =>
  SetMetadata(CACHE_EVICT_OPTIONS, options);
