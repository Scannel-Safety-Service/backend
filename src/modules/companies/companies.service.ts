import { Injectable, NotFoundException } from '@nestjs/common';
import { Company, Role } from '@prisma/client';
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
      // Find the most suitable user to impersonate:
      // 1. COMPANY_ADMIN
      // 2. COMPANY_USER
      // 3. APP_USER
      const adminUser =
        company.users.find((u) => u.role === Role.COMPANY_ADMIN) ||
        company.users.find((u) => u.role === Role.COMPANY_USER) ||
        company.users.find((u) => u.role === Role.APP_USER);

      const { users, ...companyData } = company;
      return {
        ...companyData,
        adminUserId: adminUser ? adminUser.id : null,
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
