import { ExecutionContext, CallHandler } from '@nestjs/common';
import { CacheEvictInterceptor } from './cache-evict.interceptor';
import { of } from 'rxjs';

describe('CacheEvictInterceptor', () => {
  let interceptor: CacheEvictInterceptor;
  let mockCacheManager: any;
  let mockReflector: any;
  let mockStore: any;

  beforeEach(() => {
    mockStore = {
      keys: jest.fn().mockResolvedValue([]),
    };
    mockCacheManager = {
      store: mockStore,
      del: jest.fn().mockResolvedValue(undefined),
    };
    mockReflector = {
      get: jest.fn(),
    };
    interceptor = new CacheEvictInterceptor(mockCacheManager, mockReflector);
  });

  it('should pass request through if no evict options are configured', async () => {
    mockReflector.get.mockReturnValue(undefined);

    const mockContext = {
      getHandler: jest.fn(),
    } as unknown as ExecutionContext;
    
    const mockHandler = {
      handle: jest.fn().mockReturnValue(of('response')),
    } as unknown as CallHandler;

    const result$ = await interceptor.intercept(mockContext, mockHandler);
    
    result$.subscribe((val) => {
      expect(val).toBe('response');
    });
    expect(mockStore.keys).not.toHaveBeenCalled();
  });

  it('should evict matching keys for global cache', async () => {
    mockReflector.get.mockReturnValue({ key: 'standard-documents' });
    mockStore.keys.mockResolvedValue([
      '/api/v1/standard-documents',
      '/api/v1/standard-documents?limit=10',
      '/api/v1/categories',
    ]);

    const mockContext = {
      getHandler: () => jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: {},
        }),
      }),
    } as unknown as ExecutionContext;

    const mockHandler = {
      handle: jest.fn().mockReturnValue(of('mutated')),
    } as unknown as CallHandler;

    const result$ = await interceptor.intercept(mockContext, mockHandler);

    await new Promise<void>((resolve) => {
      result$.subscribe(() => {
        process.nextTick(() => {
          expect(mockCacheManager.del).toHaveBeenCalledWith('/api/v1/standard-documents');
          expect(mockCacheManager.del).toHaveBeenCalledWith('/api/v1/standard-documents?limit=10');
          expect(mockCacheManager.del).not.toHaveBeenCalledWith('/api/v1/categories');
          resolve();
        });
      });
    });
  });

  it('should evict matching keys for tenant cache', async () => {
    mockReflector.get.mockReturnValue({ key: 'categories', isTenantScoped: true });
    mockStore.keys.mockResolvedValue([
      'tenant:company_123:/api/v1/categories',
      'tenant:company_123:/api/v1/categories?limit=10',
      'tenant:company_456:/api/v1/categories',
      '/api/v1/categories',
    ]);

    const mockContext = {
      getHandler: () => jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            companyId: 'company_123',
          },
        }),
      }),
    } as unknown as ExecutionContext;

    const mockHandler = {
      handle: jest.fn().mockReturnValue(of('mutated')),
    } as unknown as CallHandler;

    const result$ = await interceptor.intercept(mockContext, mockHandler);

    await new Promise<void>((resolve) => {
      result$.subscribe(() => {
        process.nextTick(() => {
          expect(mockCacheManager.del).toHaveBeenCalledWith('tenant:company_123:/api/v1/categories');
          expect(mockCacheManager.del).toHaveBeenCalledWith('tenant:company_123:/api/v1/categories?limit=10');
          expect(mockCacheManager.del).not.toHaveBeenCalledWith('tenant:company_456:/api/v1/categories');
          expect(mockCacheManager.del).not.toHaveBeenCalledWith('/api/v1/categories');
          resolve();
        });
      });
    });
  });
});
