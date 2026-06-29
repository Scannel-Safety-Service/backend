import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type JobType = 'seed-project-folders';

export interface SeedProjectFoldersData {
  projectId: string;
  companyId: string;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Adds a job to the background queue processing off-thread.
   */
  async addJob(jobType: JobType, data: SeedProjectFoldersData): Promise<void> {
    this.logger.log(
      `Enqueuing background job [${jobType}] for project ID ${data.projectId}`,
    );

    // Execute asynchronously using setImmediate to ensure it runs off-thread
    setImmediate(() => {
      this.processJob(jobType, data)
        .then(() => {
          this.logger.log(
            `Successfully completed job [${jobType}] for project ID ${data.projectId}`,
          );
        })
        .catch((error) => {
          this.logger.error(
            `Failed executing background job [${jobType}] for project ID ${data.projectId}`,
            error instanceof Error ? error.stack : error,
          );
        });
    });
  }

  /**
   * Worker logic that consumes background jobs.
   */
  private async processJob(
    jobType: JobType,
    data: SeedProjectFoldersData,
  ): Promise<void> {
    if (jobType === 'seed-project-folders') {
      const { projectId, companyId } = data;

      const foldersToSeed = [
        'Preliminary Plan',
        'AF1/AF2',
        'Appointments',
        'Plans',
        'Drawings',
        'Method Statements',
        'Inductions',
        'Toolbox Talks',
        'Site Audits',
        'SSWP',
        'Permits',
        'Accident Reports',
        'MSDS',
      ];

      // Perform a single, high-performance transaction using raw PrismaService to bypass tenant request scope
      await this.prisma.$transaction(
        foldersToSeed.map((folderName) =>
          this.prisma.folder.create({
            data: {
              name: folderName,
              projectId,
              companyId,
            },
          }),
        ),
      );
    }
  }
}
