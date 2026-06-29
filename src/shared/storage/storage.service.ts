import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir = path.join(process.cwd(), 'uploads');

  constructor() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      this.logger.log(`Created uploads directory at: ${this.uploadDir}`);
    }
  }

  async saveFile(
    file: Express.Multer.File,
  ): Promise<{ fileUrl: string; originalFileName: string }> {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const filename = `${uniqueSuffix}${ext}`;
    const filePath = path.join(this.uploadDir, filename);

    await fs.promises.writeFile(filePath, file.buffer);
    this.logger.log(`File saved: ${filename} (${file.size} bytes)`);

    return {
      fileUrl: `/uploads/${filename}`,
      originalFileName: file.originalname,
    };
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      if (!fileUrl.startsWith('/uploads/')) {
        return;
      }
      const filename = path.basename(fileUrl);
      const filePath = path.join(this.uploadDir, filename);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        this.logger.log(`File deleted: ${filename}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete file: ${fileUrl}`, error);
    }
  }
}
