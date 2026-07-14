import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  PORT: number = 3000;

  @IsNumber()
  @IsOptional()
  THROTTLER_TTL: number = 60000;

  @IsNumber()
  @IsOptional()
  THROTTLER_LIMIT: number = 100;

  @IsNumber()
  @IsOptional()
  THROTTLER_AUTH_LIMIT: number = 5;



  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_EXPIRY!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRY!: string;

  // Mobile channel JWT — optional until mobile app is live
  @IsString()
  @IsOptional()
  JWT_MOBILE_SECRET?: string;

  @IsString()
  @IsOptional()
  JWT_MOBILE_ACCESS_EXPIRY?: string;

  @IsString()
  @IsOptional()
  JWT_MOBILE_REFRESH_EXPIRY?: string;

  @IsString()
  @IsOptional()
  SMTP_HOST?: string;

  @IsNumber()
  @IsOptional()
  SMTP_PORT?: number;

  @IsString()
  @IsOptional()
  SMTP_USER?: string;

  @IsString()
  @IsOptional()
  SMTP_PASS?: string;

  @IsString()
  @IsOptional()
  SMTP_FROM?: string;
}

export function validateEnv(config: Record<string, any>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
