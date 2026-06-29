import { BadRequestException, Inject, Injectable, Scope } from '@nestjs/common';
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
    const req = this.request;

    // Extended client with automated tenant filters on scoped models
    this.client = this.prisma.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const user = req?.user;

            // If request is not authenticated yet or has no session user, bypass scoping
            if (!user) {
              return query(args);
            }

            const { companyId, role } = user;
            const resolvedCompanyId =
              companyId || req?.body?.companyId || req?.query?.companyId;

            const isScoped = TENANT_SCOPED_MODELS.includes(model);

            if (isScoped) {
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
                if (role !== Role.SUPER_ADMIN && resolvedCompanyId) {
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
                              { companyId: resolvedCompanyId },
                              { companyId: null },
                            ],
                          },
                        ],
                      };
                    } else {
                      queryArgs.where = {
                        ...queryArgs.where,
                        companyId: resolvedCompanyId,
                      };
                    }
                  } else {
                    queryArgs.where = {
                      ...queryArgs.where,
                      companyId: resolvedCompanyId,
                    };
                  }
                }
              }

              // 2. Intercept and auto-inject tenant on creations
              if (operation === 'create') {
                if (resolvedCompanyId) {
                  queryArgs.data.company = {
                    connect: { id: resolvedCompanyId },
                  };
                } else if (queryArgs.data.company?.connect?.id === '') {
                  throw new BadRequestException(
                    `Company ID is required to create a tenant-scoped ${model}`,
                  );
                }
              } else if (operation === 'createMany') {
                if (resolvedCompanyId) {
                  if (Array.isArray(queryArgs.data)) {
                    queryArgs.data = queryArgs.data.map((item: any) => ({
                      ...item,
                      companyId: resolvedCompanyId,
                    }));
                  } else if (
                    queryArgs.data &&
                    typeof queryArgs.data === 'object'
                  ) {
                    queryArgs.data = {
                      ...queryArgs.data,
                      companyId: resolvedCompanyId,
                    };
                  }
                }
              } else if (operation === 'upsert') {
                if (resolvedCompanyId) {
                  queryArgs.create.company = {
                    connect: { id: resolvedCompanyId },
                  };
                }
              }
            }

            return query(args);
          },
        },
      },
    }) as unknown as PrismaClient;
  }
}
