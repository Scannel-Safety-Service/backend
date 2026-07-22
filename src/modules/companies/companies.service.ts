import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Company } from '@prisma/client';
import * as bcrypt from 'bcrypt';
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
    });
  }

  async findAll(queryDto: CompanyQueryDto): Promise<{ items: any[]; meta: any }> {
    // Permanently soft-deleted records are NEVER visible via API
    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;

    const [companies, total] = await this.companiesRepository.findAndCount(
      page,
      limit,
      queryDto.archived,
    );

    const items = companies.map((company) => {
      const validUsers = (company.users || []).filter((u: any) => !u.isDeleted);
      let targetUser =
        validUsers.find(
          (u: any) => u.role === 'COMPANY_ADMIN' && u.isActive && u.archivedAt === null,
        ) ||
        validUsers.find(
          (u: any) => u.role === 'COMPANY_ADMIN' && u.archivedAt === null,
        ) ||
        validUsers.find(
          (u: any) => u.role === 'COMPANY_ADMIN' && u.isActive,
        ) ||
        validUsers.find(
          (u: any) => u.role === 'COMPANY_ADMIN',
        ) ||
        validUsers.find(
          (u: any) => u.isActive && u.archivedAt === null,
        ) ||
        validUsers.find(
          (u: any) => u.isActive,
        ) ||
        validUsers[0];

      return {
        id: company.id,
        name: company.name,
        archivedAt: company.archivedAt,
        createdAt: company.createdAt,
        adminUserId: targetUser ? targetUser.id : null,
        adminEmail: targetUser ? targetUser.email : null,
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
    if (company.isDeleted) {
      throw new NotFoundException('Company not found');
    }
    return company;
  }

  async update(id: string, dto: UpdateCompanyDto): Promise<Company> {
    const company = await this.findOne(id) as any;

    let adminUserId: string | undefined;
    let adminUserData: any | undefined;

    if (dto.email !== undefined || (dto.password !== undefined && dto.password !== '')) {
      const validUsers = (company.users || []).filter((u: any) => !u.isDeleted);
      let adminUser =
        validUsers.find(
          (u: any) => u.role === 'COMPANY_ADMIN' && u.isActive && u.archivedAt === null,
        ) ||
        validUsers.find(
          (u: any) => u.role === 'COMPANY_ADMIN' && u.isActive,
        ) ||
        validUsers.find(
          (u: any) => u.role === 'COMPANY_ADMIN',
        ) ||
        validUsers.find(
          (u: any) => u.isActive && u.archivedAt === null,
        ) ||
        validUsers.find(
          (u: any) => u.isActive,
        ) ||
        validUsers[0];

      if (!adminUser) {
        throw new BadRequestException('No administrator found for this company to update.');
      }

      adminUserId = adminUser.id;
      adminUserData = {};

      if (dto.email !== undefined && dto.email !== adminUser.email) {
        const existing = await this.companiesRepository.findUserByEmailExcludeId(dto.email, adminUser.id);
        if (existing) {
          throw new BadRequestException('Email address is already in use.');
        }
        adminUserData.email = dto.email;
      }

      if (dto.password !== undefined && dto.password !== '') {
        adminUserData.passwordHash = await bcrypt.hash(dto.password, 12);
      }
    }

    return this.companiesRepository.updateCompanyAndAdmin(
      id,
      {
        name: dto.name,
      },
      adminUserId,
      adminUserData,
    );
  }

  async archive(id: string): Promise<Company> {
    const company = await this.findOne(id);
    if (company.archivedAt !== null) {
      throw new BadRequestException('Company is already archived');
    }
    return this.companiesRepository.archiveCompany(id);
  }

  async restore(id: string): Promise<Company> {
    const company = await this.findOne(id);
    if (company.archivedAt === null) {
      throw new BadRequestException('Company is not archived');
    }
    return this.companiesRepository.restoreCompany(id);
  }

  async delete(id: string): Promise<void> {
    const company = await this.findOne(id);
    if (company.archivedAt === null) {
      throw new BadRequestException('Company must be archived before it can be deleted');
    }
    await this.companiesRepository.deleteCompany(id);
  }
}
