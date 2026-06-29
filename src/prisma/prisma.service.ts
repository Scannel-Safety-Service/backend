import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, Client } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private pool: Pool;
  private readonly connectionString: string;

  constructor(configService: ConfigService) {
    const connectionString = configService.get<string>('DATABASE_URL');
    if (!connectionString) {
      const logger = new Logger(PrismaService.name);
      logger.error(
        '❌ DATABASE_URL is not defined in environment variables.\n' +
        '   Please set it in your .env file and restart the server.',
      );
      process.exit(1);
    }

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    super({ adapter });
    this.pool = pool;
    this.connectionString = connectionString;
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Database connection established successfully.');
    } catch (err: any) {
      await this.handleConnectionError(err);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async handleConnectionError(err: any): Promise<void> {
    const code: string = err?.code ?? err?.meta?.code ?? '';
    const message: string = err?.message ?? '';

    // PostgreSQL service is not running
    if (
      code === 'ECONNREFUSED' ||
      message.includes('ECONNREFUSED') ||
      message.includes('connect ECONNREFUSED') ||
      message.includes('Connection refused')
    ) {
      this.logger.error(
        '❌ Cannot connect to PostgreSQL — the service does not appear to be running.\n' +
        `   Connection string: ${this.maskPassword(this.connectionString)}\n` +
        '   → Start PostgreSQL (e.g. `pg_ctl start` or `net start postgresql`) and retry.',
      );
      process.exit(1);
    }

    // Database does not exist — try to create it automatically
    if (code === '3D000') {
      await this.tryCreateDatabase();
      return;
    }

    // Unknown / unrecoverable — re-throw so NestJS can report it
    throw err;
  }

  /**
   * Attempt to create the missing database using a raw pg Client connected to
   * the `postgres` system database, then retry Prisma's $connect().
   */
  private async tryCreateDatabase(): Promise<void> {
    const url = new URL(this.connectionString);
    const dbName = url.pathname.slice(1); // strip leading "/"

    this.logger.warn(
      `⚠️  Database "${dbName}" does not exist. Attempting auto-create…`,
    );

    const client = new Client({
      host: url.hostname,
      port: parseInt(url.port || '5432', 10),
      user: url.username,
      password: url.password,
      database: 'postgres', // connect to the system db to issue CREATE DATABASE
    });

    try {
      await client.connect();
      await client.query(`CREATE DATABASE "${dbName}"`);
      await client.end();
      this.logger.log(`✅ Database "${dbName}" created successfully.`);
    } catch (createErr: any) {
      await client.end().catch(() => undefined);
      this.logger.error(
        `❌ Failed to auto-create database "${dbName}": ${createErr?.message}\n` +
        '   Please create the database manually and restart.',
      );
      process.exit(1);
    }

    // Retry Prisma connection against the newly created DB
    try {
      await this.$connect();
      this.logger.log('✅ Database connection established after auto-create.');
    } catch (retryErr: any) {
      this.logger.error(
        `❌ Connection still failing after creating "${dbName}".\n` +
        `   Error: ${retryErr?.message}`,
      );
      process.exit(1);
    }
  }

  /** Masks the password portion of a connection string for safe logging. */
  private maskPassword(connStr: string): string {
    try {
      const url = new URL(connStr);
      if (url.password) url.password = '****';
      return url.toString();
    } catch {
      return connStr;
    }
  }
}
