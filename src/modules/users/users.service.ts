import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findAll(queryDto: UserQueryDto) {
    const where: Prisma.UserWhereInput = {};

    if (queryDto.name) {
      where.OR = [
        { firstName: { contains: queryDto.name, mode: 'insensitive' } },
        { lastName: { contains: queryDto.name, mode: 'insensitive' } },
      ];
    }

    if (queryDto.email) {
      where.email = { contains: queryDto.email, mode: 'insensitive' };
    }

    if (queryDto.userCode) {
      where.userCode = { contains: queryDto.userCode, mode: 'insensitive' };
    }

    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;

    const [items, total] = await this.usersRepository.findAndCount(where, page, limit);

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

  async findOne(id: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { passwordHash: _, ...result } = user;
    return result;
  }

  async update(id: string, dto: UpdateUserDto): Promise<Omit<User, 'passwordHash'>> {
    // Verify user exists (throws NotFoundException if not)
    await this.findOne(id);

    const updateData: Prisma.UserUpdateInput = {};
    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
    if (dto.userCode !== undefined) updateData.userCode = dto.userCode || null;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const updatedUser = await this.usersRepository.update(id, updateData);
    const { passwordHash: _, ...result } = updatedUser;
    return result;
  }

  async archive(id: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.findOne(id);
    if (user.archivedAt !== null) {
      throw new BadRequestException('User is already archived');
    }

    const updatedUser = await this.usersRepository.update(id, {
      archivedAt: new Date(),
    });
    const { passwordHash: _, ...result } = updatedUser;
    return result;
  }

  async restore(id: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.findOne(id);
    if (user.archivedAt === null) {
      throw new BadRequestException('User is not archived');
    }

    const updatedUser = await this.usersRepository.update(id, {
      archivedAt: null,
    });
    const { passwordHash: _, ...result } = updatedUser;
    return result;
  }

  async permanentDelete(id: string): Promise<void> {
    const user = await this.findOne(id);
    if (user.archivedAt === null) {
      throw new BadRequestException('User must be archived first before permanent deletion');
    }

    await this.usersRepository.delete(id);
  }
}
