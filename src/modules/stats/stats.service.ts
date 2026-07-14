import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';

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
        where: { isDeleted: false },
      }),

      // Active companies
      this.prisma.company.count({
        where: { isDeleted: false, archivedAt: null },
      }),

      // Total users (not permanently deleted, excluding company/super admins)
      this.prisma.user.count({
        where: {
          isDeleted: false,
          role: {
            notIn: [Role.COMPANY_ADMIN, Role.SUPER_ADMIN],
          },
        },
      }),

      // Total projects (not permanently deleted)
      this.prisma.project.count({
        where: { isDeleted: false },
      }),

      // Total assets (not permanently deleted)
      this.prisma.asset.count({
        where: { isDeleted: false },
      }),

      // Assets grouped by category
      this.prisma.asset.groupBy({
        by: ['category'],
        _count: { id: true },
        where: { isDeleted: false },
      }),

      // Expired assets
      this.prisma.asset.count({
        where: {
          isDeleted: false,
          expiryDate: { lt: now },
        },
      }),

      // Expiring soon (amber — within 30 days)
      this.prisma.asset.count({
        where: {
          isDeleted: false,
          expiryDate: { gte: now, lte: amberCutoff },
        },
      }),

      // Valid assets (expire after 30 days from now)
      this.prisma.asset.count({
        where: {
          isDeleted: false,
          expiryDate: { gt: amberCutoff },
        },
      }),

      // Projects grouped by year for bar chart
      this.prisma.project.groupBy({
        by: ['year'],
        _count: { id: true },
        where: { isDeleted: false },
        orderBy: { year: 'asc' },
      }),
    ]);

    // Shape asset-by-category into a simple map
    const categoryMap: Record<string, number> = {};
    for (const row of assetsByCategory as any[]) {
      categoryMap[row.category] = row._count?.id ?? 0;
    }

    // Shape projects-by-year into a simple map
    const projectsByYearMap: Record<string, number> = {};
    for (const row of projectsByYear as any[]) {
      projectsByYearMap[row.year.toString()] = row._count?.id ?? 0;
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
