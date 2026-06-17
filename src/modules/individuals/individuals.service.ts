import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Individual } from '@prisma/client';
import { CreateIndividualDto } from './dto/create-individual.dto';
import { UpdateIndividualDto } from './dto/update-individual.dto';
import { IndividualQueryDto } from './dto/individual-query.dto';
import { IndividualsRepository } from './individuals.repository';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';

@Injectable()
export class IndividualsService {
  constructor(
    private readonly repository: IndividualsRepository,
    private readonly prismaService: TenantPrismaService,
  ) {}

  async create(dto: CreateIndividualDto): Promise<Individual> {
    await this.verifyUserBelongsToTenant(dto.userId);

    return this.repository.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      user: { connect: { id: dto.userId } },
      company: { connect: { id: '' } }, // Injected by TenantPrismaService
    });
  }

  async findAll(queryDto: IndividualQueryDto) {
    const where: Prisma.IndividualWhereInput = {};

    if (queryDto.userId) {
      where.userId = queryDto.userId;
    }

    if (queryDto.archived === 'true') {
      where.archivedAt = { not: null };
    } else if (queryDto.archived === 'false' || !queryDto.archived) {
      where.archivedAt = null;
    }

    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;

    const [items, total] = await this.repository.findAndCount(where, page, limit);

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
    return individual;
  }

  async update(id: string, dto: UpdateIndividualDto): Promise<Individual> {
    await this.findOne(id);

    const updateData: Prisma.IndividualUpdateInput = {};
    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;

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

  async permanentDelete(id: string): Promise<void> {
    const individual = await this.findOne(id);
    if (individual.archivedAt === null) {
      throw new BadRequestException('Individual must be archived first before permanent deletion');
    }

    // Delete associated reminders first
    await this.prismaService.client.reminder.deleteMany({
      where: { individualId: id },
    });

    await this.repository.delete(id);
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
