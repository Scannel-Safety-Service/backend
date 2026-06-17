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

  async findAll(): Promise<Company[]> {
    return this.companiesRepository.findAll();
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
