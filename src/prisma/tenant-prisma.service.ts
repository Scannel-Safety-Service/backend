import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { TENANT_SCOPED_MODELS } from '../common/constants/tenant-scoped-models';
import { Role } from '../common/enums/role.enum';
import { PrismaService } from './prisma.service';

@Injectable({ scope: Scope.REQUEST })
export class TenantPrismaService {
  public readonly client: PrismaClient;

  constructor(
    @Inject(REQUEST) private readonly request: any,
    private readonly prisma: PrismaService,
  ) {
    const user = this.request?.user;

    // Fallback if request is not authenticated yet or has no session user
    if (!user) {
      this.client = this.prisma;
      return;
    }

    const { companyId, role } = user;

    // Super Admin has global bypass, bypass extended client
    if (role === Role.SUPER_ADMIN) {
      this.client = this.prisma;
      return;
    }

    // Extended client with automated tenant filters on scoped models
    this.client = this.prisma.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const isScoped = TENANT_SCOPED_MODELS.includes(model);

            if (isScoped && companyId) {
              const queryArgs = args as any;
              // 1. Intercept read & write filters
              if (
                [
                  'findMany',
                  'findFirst',
                  'findUnique',
                  'findUniqueOrThrow',
                  'count',
                  'aggregate',
                  'groupBy',
                  'update',
                  'updateMany',
                  'delete',
                  'deleteMany',
                  'upsert',
                ].includes(operation)
              ) {
                if (model === 'Category') {
                  if (
                    [
                      'findMany',
                      'findFirst',
                      'findUnique',
                      'findUniqueOrThrow',
                      'count',
                      'aggregate',
                      'groupBy',
                    ].includes(operation)
                  ) {
                    queryArgs.where = {
                      ...queryArgs.where,
                      AND: [
                        ...(queryArgs.where?.AND || []),
                        {
                          OR: [
                            { companyId },
                            { companyId: null },
                          ],
                        },
                      ],
                    };
                  } else {
                    queryArgs.where = { ...queryArgs.where, companyId };
                  }
                } else {
                  queryArgs.where = { ...queryArgs.where, companyId };
                }
              }

              // 2. Intercept and auto-inject tenant on creations
              if (operation === 'create') {
                queryArgs.data = { ...queryArgs.data, companyId };
              } else if (operation === 'createMany') {
                if (Array.isArray(queryArgs.data)) {
                  queryArgs.data = queryArgs.data.map((item: any) => ({ ...item, companyId }));
                } else if (queryArgs.data && typeof queryArgs.data === 'object') {
                  queryArgs.data = { ...queryArgs.data, companyId };
                }
              } else if (operation === 'upsert') {
                queryArgs.create = { ...queryArgs.create, companyId };
                queryArgs.update = { ...queryArgs.update, companyId };
              }
            }

            return query(args);
          },
        },
      },
    }) as unknown as PrismaClient;
  }
}
