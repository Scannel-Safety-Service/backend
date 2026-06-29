import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Projects (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let superadminToken: string;
  let acmeAdminToken: string;
  let globexAdminToken: string;
  let acmeUserToken: string;

  let acmeProjectId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);

    // Login and retrieve JWT tokens
    const login = async (email: string) => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'password123' })
        .expect(200);
      return response.body.data.accessToken;
    };

    superadminToken = await login('superadmin@scannel.com');
    acmeAdminToken = await login('admin@acme.com');
    globexAdminToken = await login('admin@globex.com');
    acmeUserToken = await login('user1@acme.com');
  });

  afterAll(async () => {
    // Cleanup projects created during testing
    if (acmeProjectId) {
      await prisma.project.deleteMany({
        where: { id: acmeProjectId },
      });
    }
    await app.close();
  });

  describe('POST /api/v1/projects', () => {
    it('should allow company admin to create a project and return 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${acmeAdminToken}`)
        .send({
          name: 'Construction Site Phase 1',
          year: 2026,
        })
        .expect(201);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.name).toBe('Construction Site Phase 1');
      expect(res.body.data.year).toBe(2026);
      expect(res.body.data.companyId).toBeDefined();

      acmeProjectId = res.body.data.id;
    });

    it('should reject creation by regular company user', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${acmeUserToken}`)
        .send({
          name: 'Construction Site Phase 2',
          year: 2026,
        })
        .expect(403);
    });

    it('should seed 13 folders asynchronously', async () => {
      // Wait a brief moment for the off-thread queue processor to finish
      await new Promise((resolve) => setTimeout(resolve, 500));

      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${acmeProjectId}/folders`)
        .set('Authorization', `Bearer ${acmeAdminToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.folders).toHaveLength(13);

      const folderNames = res.body.data.folders.map((f: any) => f.name);
      expect(folderNames).toContain('Preliminary Plan');
      expect(folderNames).toContain('MSDS');
      expect(folderNames).toContain('Site Audits');
    });
  });

  describe('POST /api/v1/projects/:projectId/folders/:folderId/documents', () => {
    let folderId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${acmeProjectId}/folders`)
        .set('Authorization', `Bearer ${acmeAdminToken}`)
        .expect(200);
      folderId = res.body.data.folders[0].id; // Grabs the first folder ID
    });

    it('should successfully upload a document to a project folder', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${acmeProjectId}/folders/${folderId}/documents`)
        .set('Authorization', `Bearer ${acmeAdminToken}`)
        .attach(
          'file',
          Buffer.from('dummy project safety document content'),
          'safety-plan.pdf',
        )
        .field('description', 'Acme safety roadmap')
        .expect(201);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.projectId).toBe(acmeProjectId);
      expect(res.body.data.folderId).toBe(folderId);
      expect(res.body.data.originalFileName).toBe('safety-plan.pdf');

      // Cleanup uploaded document in DB
      await prisma.document.delete({ where: { id: res.body.data.id } });
    });

    it('should prevent cross-tenant uploads (returns 404)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/projects/${acmeProjectId}/folders/${folderId}/documents`)
        .set('Authorization', `Bearer ${globexAdminToken}`)
        .attach('file', Buffer.from('stolen document'), 'secret.pdf')
        .expect(404);
    });
  });

  describe('GET /api/v1/projects', () => {
    it('should list projects categorized yearwise', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${acmeAdminToken}`)
        .expect(200);

      expect(res.body.data.projectsByYear).toBeDefined();
      expect(res.body.data.projectsByYear['2026']).toBeDefined();
      const projectNames = res.body.data.projectsByYear['2026'].map(
        (p: any) => p.name,
      );
      expect(projectNames).toContain('Construction Site Phase 1');
    });
  });

  describe('Cross-Tenant Guardrail Security', () => {
    it('should return 404 Not Found when Globex Admin queries Acme Project Folders', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/projects/${acmeProjectId}/folders`)
        .set('Authorization', `Bearer ${globexAdminToken}`)
        .expect(404);
    });

    it('should return 404 Not Found when Globex Admin tries to update Acme Project', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/projects/${acmeProjectId}`)
        .set('Authorization', `Bearer ${globexAdminToken}`)
        .send({ name: 'Hacked name' })
        .expect(404);
    });
  });

  describe('PATCH /api/v1/projects/:id', () => {
    it('should allow Acme Admin to update project name and year', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/projects/${acmeProjectId}`)
        .set('Authorization', `Bearer ${acmeAdminToken}`)
        .send({
          name: 'Construction Site Phase 1 - Updated',
          year: 2056,
        })
        .expect(200);

      expect(res.body.data.name).toBe('Construction Site Phase 1 - Updated');
      expect(res.body.data.year).toBe(2056);
    });
  });

  describe('Double-Gated Deletion (Archive & Permanent Delete)', () => {
    it('should reject permanent deletion if project is not archived', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/projects/${acmeProjectId}/permanent`)
        .set('Authorization', `Bearer ${acmeAdminToken}`)
        .expect(400);
    });

    it('should successfully soft-archive project', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/projects/${acmeProjectId}/archive`)
        .set('Authorization', `Bearer ${acmeAdminToken}`)
        .expect(200);

      expect(res.body.data.archivedAt).not.toBeNull();
    });

    it('should successfully delete permanently when project is archived', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/projects/${acmeProjectId}/permanent`)
        .set('Authorization', `Bearer ${acmeAdminToken}`)
        .expect(204);

      // Verify it is gone
      await request(app.getHttpServer())
        .get(`/api/v1/projects/${acmeProjectId}/folders`)
        .set('Authorization', `Bearer ${acmeAdminToken}`)
        .expect(404);

      acmeProjectId = ''; // avoid cleanup attempt in afterAll
    });
  });
});
