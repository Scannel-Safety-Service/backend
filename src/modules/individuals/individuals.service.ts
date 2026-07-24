import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Individual } from '@prisma/client';
import { CreateIndividualDto } from './dto/create-individual.dto';
import { UpdateIndividualDto } from './dto/update-individual.dto';
import { IndividualQueryDto } from './dto/individual-query.dto';
import { IndividualsRepository } from './individuals.repository';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class IndividualsService {
  constructor(
    private readonly repository: IndividualsRepository,
    private readonly prismaService: TenantPrismaService,
  ) {}

  async create(dto: CreateIndividualDto): Promise<Individual> {
    await this.verifyUserBelongsToTenant(dto.userId);

    return this.repository.create({
      name: dto.name,
      user: { connect: { id: dto.userId } },
      company: { connect: { id: dto.companyId || '' } },
    });
  }

  async findAll(queryDto: IndividualQueryDto, caller: AuthenticatedUser) {
    const where: Prisma.IndividualWhereInput = {};

    let targetUserId = queryDto.userId;
    if (caller.role !== Role.SUPER_ADMIN && caller.role !== Role.COMPANY_ADMIN) {
      targetUserId = caller.userId;
    }

    if (targetUserId) {
      where.userId = targetUserId;
    }

    if (queryDto.archived === 'true') {
      where.archivedAt = { not: null };
    } else if (queryDto.archived === 'false' || !queryDto.archived) {
      where.archivedAt = null;
    }
    // Permanently soft-deleted records are NEVER visible via API
    where.isDeleted = false;

    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;

    const [items, total] = await this.repository.findAndCount(
      where,
      page,
      limit,
    );

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Individual> {
    const individual = await this.repository.findById(id);
    if (!individual) {
      throw new NotFoundException('Individual not found');
    }
    // Permanently soft-deleted records are invisible via API
    if (individual.isDeleted) {
      throw new NotFoundException('Individual not found');
    }
    return individual;
  }

  async update(id: string, dto: UpdateIndividualDto): Promise<Individual> {
    await this.findOne(id);

    const updateData: Prisma.IndividualUpdateInput = {};
    if (dto.name !== undefined) updateData.name = dto.name;

    return this.repository.update(id, updateData);
  }

  async archive(id: string): Promise<Individual> {
    const individual = await this.findOne(id);
    if (individual.archivedAt !== null) {
      throw new BadRequestException('Individual is already archived');
    }

    return this.repository.update(id, {
      archivedAt: new Date(),
    });
  }

  async restore(id: string): Promise<Individual> {
    const individual = await this.findOne(id);
    if (individual.archivedAt === null) {
      throw new BadRequestException('Individual is not archived');
    }

    return this.repository.update(id, {
      archivedAt: null,
    });
  }

  async getLinkedDocuments(
    id: string,
    caller: AuthenticatedUser,
  ): Promise<{ items: any[]; total: number }> {
    await this.findOne(id);

    const [items, total] = await this.prismaService.client.$transaction([
      this.prismaService.client.document.findMany({
        where: {
          individualId: id,
          isDeleted: false,
        },
        select: {
          id: true,
          title: true,
          originalFileName: true,
          archivedAt: true,
          company: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50,
      }),
      this.prismaService.client.document.count({
        where: {
          individualId: id,
          isDeleted: false,
        },
      }),
    ]);

    return {
      items,
      total,
    };
  }

  /**
   * Soft permanent delete — sets isDeleted to true on individual AND linked documents.
   * Record is permanently hidden from the UI but remains in the database forever.
   */
  async permanentDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.repository.update(id, { isDeleted: true });
    await this.prismaService.client.document.updateMany({
      where: {
        individualId: id,
        isDeleted: false,
      },
      data: {
        isDeleted: true,
      },
    });
  }


  private async verifyUserBelongsToTenant(userId: string): Promise<void> {
    const user = await this.prismaService.client.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('Scoped user not found');
    }
  }
}
