import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { AppValidationPipe } from './common/pipes/validation.pipe';
import { validateEnv } from './config/env.validation';
import jwtConfig from './config/jwt.config';
import mailConfig from './config/mail.config';
import { AuthModule } from './modules/auth/auth.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { UsersModule } from './modules/users/users.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { StandardDocumentsModule } from './modules/standard-documents/standard-documents.module';
import { IndividualsModule } from './modules/individuals/individuals.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { AssetsModule } from './modules/assets/assets.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { MailerModule } from './shared/mailer/mailer.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [jwtConfig, mailConfig],
    }),
    PrismaModule,
    MailerModule,
    AuthModule,
    CompaniesModule,
    UsersModule,
    CategoriesModule,
    DocumentsModule,
    StandardDocumentsModule,
    IndividualsModule,
    RemindersModule,
    AssetsModule,
    ProjectsModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useClass: AppValidationPipe,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseTransformInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
  ],
})
export class AppModule {}
