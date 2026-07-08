import { ExecutionContext, CallHandler } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { TenantCacheInterceptor } from './tenant-cache.interceptor';
import { of } from 'rxjs';

describe('TenantCacheInterceptor', () => {
  let interceptor: TenantCacheInterceptor;
  let mockCacheManager: any;

  beforeEach(() => {
    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };
    const reflector = {};
    interceptor = new TenantCacheInterceptor(mockCacheManager, reflector as any);
  });

  it('should return undefined if super.trackBy returns undefined', () => {
    jest.spyOn(CacheInterceptor.prototype as any, 'trackBy').mockReturnValue(undefined);

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as ExecutionContext;

    expect(interceptor['trackBy'](mockContext)).toBeUndefined();
  });

  it('should return standard key if companyId is not present', () => {
    jest.spyOn(CacheInterceptor.prototype as any, 'trackBy').mockReturnValue('/api/v1/standard-documents');

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {},
        }),
      }),
    } as ExecutionContext;

    expect(interceptor['trackBy'](mockContext)).toBe('/api/v1/standard-documents');
  });

  it('should return companyId-partitioned key if companyId is present', () => {
    jest.spyOn(CacheInterceptor.prototype as any, 'trackBy').mockReturnValue('/api/v1/categories');

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            companyId: 'company_123',
          },
        }),
      }),
    } as ExecutionContext;

    expect(interceptor['trackBy'](mockContext)).toBe('tenant:company_123:/api/v1/categories');
  });

  it('should return companyId-partitioned key if companyId is present and super.trackBy returns a Promise', async () => {
    jest.spyOn(CacheInterceptor.prototype as any, 'trackBy').mockReturnValue(Promise.resolve('/api/v1/categories'));

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            companyId: 'company_123',
          },
        }),
      }),
    } as ExecutionContext;

    const result = interceptor['trackBy'](mockContext);
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBe('tenant:company_123:/api/v1/categories');
  });

  it('should set X-Cache: MISS header on cache miss', async () => {
    const mockResponse = {
      header: jest.fn(),
    };
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { companyId: 'company_123' }
        }),
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;

    const mockHandler = {
      handle: jest.fn().mockReturnValue(of('data')),
    } as CallHandler;

    jest.spyOn(CacheInterceptor.prototype as any, 'trackBy').mockReturnValue('/api/v1/categories');
    mockCacheManager.get.mockResolvedValue(null);
    jest.spyOn(CacheInterceptor.prototype, 'intercept').mockResolvedValue(of('data') as any);

    await interceptor.intercept(mockContext, mockHandler);

    expect(mockResponse.header).toHaveBeenCalledWith('X-Cache', 'MISS');
  });

  it('should set X-Cache: HIT header on cache hit', async () => {
    const mockResponse = {
      header: jest.fn(),
    };
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { companyId: 'company_123' }
        }),
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;

    const mockHandler = {
      handle: jest.fn().mockReturnValue(of('data')),
    } as CallHandler;

    jest.spyOn(CacheInterceptor.prototype as any, 'trackBy').mockReturnValue('/api/v1/categories');
    mockCacheManager.get.mockResolvedValue({ some: 'data' });
    jest.spyOn(CacheInterceptor.prototype, 'intercept').mockResolvedValue(of({ some: 'data' }) as any);

    await interceptor.intercept(mockContext, mockHandler);

    expect(mockResponse.header).toHaveBeenCalledWith('X-Cache', 'HIT');
  });
});
