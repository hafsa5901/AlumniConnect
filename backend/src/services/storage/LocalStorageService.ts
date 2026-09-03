import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { IStorageService } from './IStorageService';

export class LocalStorageService implements IStorageService {
  private baseUploadDir: string;

  constructor(baseUploadDir?: string) {
    this.baseUploadDir = baseUploadDir || path.resolve(process.cwd(), 'uploads');
  }

  async save(file: Express.Multer.File, folder: string): Promise<string> {
    const targetDir = path.join(this.baseUploadDir, folder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const ext = path.extname(file.originalname).toLowerCase() || this.getExtensionFromMime(file.mimetype);
    const filename = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(targetDir, filename);

    await fs.promises.writeFile(filePath, file.buffer);

    return `/uploads/${folder}/${filename}`;
  }

  async delete(fileUrl: string): Promise<void> {
    if (!fileUrl || !fileUrl.startsWith('/uploads/')) {
      return;
    }

    const relativePath = fileUrl.replace(/^\/uploads\//, '');
    const absolutePath = path.join(this.baseUploadDir, relativePath);

    try {
      if (fs.existsSync(absolutePath)) {
        await fs.promises.unlink(absolutePath);
      }
    } catch (err) {
      console.error(`[LocalStorageService] Failed to delete file ${absolutePath}:`, err);
    }
  }

  private getExtensionFromMime(mime: string): string {
    switch (mime) {
      case 'image/jpeg':
        return '.jpg';
      case 'image/png':
        return '.png';
      case 'image/webp':
        return '.webp';
      default:
        return '.jpg';
    }
  }
}

export const storageService = new LocalStorageService();
