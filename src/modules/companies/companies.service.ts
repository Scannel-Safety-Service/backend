import { Injectable, NotFoundException } from '@nestjs/common';
import { Company } from '@prisma/client';
import { CompaniesRepository } from './companies.repository';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly companiesRepository: CompaniesRepository) {}

  async create(dto: CreateCompanyDto): Promise<Company> {
    return this.companiesRepository.create({
      name: dto.name,
      isActive: true,
    });
  }

  async findAll(): Promise<any[]> {
    const companies = await this.companiesRepository.findAll();
    return companies.map((company) => {
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
  }

  async findOne(id: string): Promise<Company> {
    const company = await this.companiesRepository.findById(id);
    if (!company) {
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
}
