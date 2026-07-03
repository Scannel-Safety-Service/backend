import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UsersRepository } from './users.repository';
import { AuthService } from '../auth/auth.service';
import { MailerService } from '../../shared/mailer/mailer.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly authService: AuthService,
    private readonly mailerService: MailerService,
  ) {}

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

    if (queryDto.archived === 'true') {
      where.archivedAt = { not: null };
    } else if (queryDto.archived === 'false' || !queryDto.archived) {
      where.archivedAt = null;
    }

    if (queryDto.role) {
      where.role = queryDto.role as any;
    }

    if (queryDto.isActive !== undefined) {
      where.isActive = queryDto.isActive === 'true';
    }

    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;

    const [items, total] = await this.usersRepository.findAndCount(
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

  async findOne(id: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { passwordHash: _, ...result } = user;
    return result;
  }

  async update(id: string, dto: UpdateUserDto): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: Prisma.UserUpdateInput = {};
    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
    if (dto.userCode !== undefined) updateData.userCode = dto.userCode || null;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    if (dto.email !== undefined) {
      if (dto.email !== user.email) {
        const existingUser = await this.usersRepository.findByEmail(dto.email);
        if (existingUser && existingUser.id !== id) {
          throw new BadRequestException('Email address is already in use');
        }
      }
      updateData.email = dto.email;
    }

    if (dto.password !== undefined && dto.password !== '') {
      updateData.passwordHash = await bcrypt.hash(dto.password, 12);
    }

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
      throw new BadRequestException(
        'User must be archived first before permanent deletion',
      );
    }

    await this.usersRepository.delete(id);
  }

  async sendWelcomeEmail(id: string): Promise<void> {
    const user = await this.findOne(id);
    if (user.archivedAt !== null) {
      throw new BadRequestException(
        'Cannot send welcome email to an archived user',
      );
    }

    const token = await this.authService.generateInvitationToken(user.id);
    await this.mailerService.sendWelcomeInvitationEmail(user.email, token);
  }

  async issueToClient(id: string): Promise<void> {
    const user = await this.usersRepository.findByIdWithCompany(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.archivedAt !== null) {
      throw new BadRequestException('Cannot send credentials to an archived user');
    }

    await this.mailerService.sendIssueToClientEmail(user, user.company);
  }
}
