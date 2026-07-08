import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Company } from '@prisma/client';
import { CompaniesRepository } from './companies.repository';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyQueryDto } from './dto/company-query.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly companiesRepository: CompaniesRepository) {}

  async create(dto: CreateCompanyDto): Promise<Company> {
    return this.companiesRepository.create({
      name: dto.name,
      isActive: true,
    });
  }

  async findAll(queryDto: CompanyQueryDto): Promise<{ items: any[]; meta: any }> {
    // Permanently soft-deleted records are NEVER visible via API
    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;
    const isActive = queryDto.isActive === 'true' ? true : queryDto.isActive === 'false' ? false : undefined;

    const [companies, total] = await this.companiesRepository.findAndCount(
      page,
      limit,
      isActive,
    );

    const items = companies.map((company) => {
      // Find an active COMPANY_ADMIN user
      let targetUser = company.users.find(
        (u: any) => u.role === 'COMPANY_ADMIN' && u.isActive && u.archivedAt === null,
      );
      // Fallback to any active user
      if (!targetUser) {
        targetUser = company.users.find(
          (u: any) => u.isActive && u.archivedAt === null,
        );
      }
      return {
        id: company.id,
        name: company.name,
        isActive: company.isActive,
        createdAt: company.createdAt,
        adminUserId: targetUser ? targetUser.id : null,
      };
    });

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

  async findOne(id: string): Promise<Company> {
    const company = await this.companiesRepository.findById(id);
    if (!company) {
      throw new NotFoundException(`Company not found`);
    }
    // Permanently soft-deleted records are invisible via API
    if ((company as any).deletedAt !== null) {
      throw new NotFoundException('Company not found');
    }
    return company;
  }

  async update(id: string, dto: UpdateCompanyDto): Promise<Company> {
    await this.findOne(id);

    return this.companiesRepository.update(id, {
      name: dto.name,
      isActive: dto.isActive,
    });
  }

  async archive(id: string): Promise<Company> {
    const company = await this.findOne(id);
    if ((company as any).archivedAt !== null) {
      throw new BadRequestException('Company is already archived');
    }
    return this.companiesRepository.update(id, { archivedAt: new Date() } as any);
  }

  async restore(id: string): Promise<Company> {
    const company = await this.findOne(id);
    if ((company as any).archivedAt === null) {
      throw new BadRequestException('Company is not archived');
    }
    return this.companiesRepository.update(id, { archivedAt: null } as any);
  }

  /**
   * Soft permanent delete — sets deletedAt timestamp.
   * Record is permanently hidden from the UI but remains in the database forever.
   * Requires the company to be archived first.
   */
  async permanentDelete(id: string): Promise<void> {
    const company = await this.findOne(id);
    if ((company as any).archivedAt === null) {
      throw new BadRequestException(
        'Company must be archived before permanent deletion',
      );
    }
    await this.companiesRepository.update(id, { deletedAt: new Date() } as any);
  }
}
