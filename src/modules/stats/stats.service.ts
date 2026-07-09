import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const AMBER_THRESHOLD_DAYS = 30;

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlatformStats() {
    const now = new Date();
    const amberCutoff = new Date(now);
    amberCutoff.setDate(amberCutoff.getDate() + AMBER_THRESHOLD_DAYS);

    const [
      totalCompanies,
      activeCompanies,
      totalUsers,
      totalProjects,
      totalAssets,
      assetsByCategory,
      expiredAssets,
      expiringAssets,
      validAssets,
      projectsByYear,
    ] = await Promise.all([
      // Total companies (not permanently deleted)
      this.prisma.company.count({
        where: { deletedAt: null },
      }),

      // Active companies
      this.prisma.company.count({
        where: { deletedAt: null, isActive: true, archivedAt: null },
      }),

      // Total users (not permanently deleted)
      this.prisma.user.count({
        where: { deletedAt: null },
      }),

      // Total projects (not permanently deleted)
      this.prisma.project.count({
        where: { deletedAt: null },
      }),

      // Total assets (not permanently deleted)
      this.prisma.asset.count({
        where: { deletedAt: null },
      }),

      // Assets grouped by category
      this.prisma.asset.groupBy({
        by: ['category'],
        _count: { id: true },
        where: { deletedAt: null },
      }),

      // Expired assets
      this.prisma.asset.count({
        where: {
          deletedAt: null,
          expiryDate: { lt: now },
        },
      }),

      // Expiring soon (amber — within 30 days)
      this.prisma.asset.count({
        where: {
          deletedAt: null,
          expiryDate: { gte: now, lte: amberCutoff },
        },
      }),

      // Valid assets (expire after 30 days from now)
      this.prisma.asset.count({
        where: {
          deletedAt: null,
          expiryDate: { gt: amberCutoff },
        },
      }),

      // Projects grouped by year for bar chart
      this.prisma.project.groupBy({
        by: ['year'],
        _count: { id: true },
        where: { deletedAt: null },
        orderBy: { year: 'asc' },
      }),
    ]);

    // Shape asset-by-category into a simple map
    const categoryMap: Record<string, number> = {};
    for (const row of assetsByCategory) {
      categoryMap[row.category] = row._count.id;
    }

    // Shape projects-by-year into a simple map
    const projectsByYearMap: Record<string, number> = {};
    for (const row of projectsByYear) {
      projectsByYearMap[row.year.toString()] = row._count.id;
    }

    return {
      companies: {
        total: totalCompanies,
        active: activeCompanies,
        archived: totalCompanies - activeCompanies,
      },
      users: {
        total: totalUsers,
      },
      projects: {
        total: totalProjects,
        byYear: projectsByYearMap,
      },
      assets: {
        total: totalAssets,
        byCategory: {
          PLANT: categoryMap['PLANT'] ?? 0,
          LIFTING_EQUIPMENT: categoryMap['LIFTING_EQUIPMENT'] ?? 0,
          WORKING_AT_HEIGHT: categoryMap['WORKING_AT_HEIGHT'] ?? 0,
          CALIBRATION_TOOLS: categoryMap['CALIBRATION_TOOLS'] ?? 0,
        },
        expiryHealth: {
          expired: expiredAssets,
          expiringSoon: expiringAssets,
          valid: validAssets,
        },
      },
    };
  }
}
