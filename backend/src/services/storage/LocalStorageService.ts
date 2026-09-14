import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { IStorageService } from './IStorageService';

export class LocalStorageService implements IStorageService {
  private baseUploadDir: string;
  private privateBaseDir: string;

  constructor(baseUploadDir?: string, privateBaseDir?: string) {
    this.baseUploadDir = baseUploadDir || path.resolve(process.cwd(), 'uploads');
    this.privateBaseDir = privateBaseDir || path.resolve(process.cwd(), 'uploads_private');
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

  async savePrivate(file: Express.Multer.File, folder: string): Promise<{ storagePath: string; filename: string }> {
    const sanitizedFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '');
    const targetDir = path.join(this.privateBaseDir, sanitizedFolder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const ext = path.extname(file.originalname).toLowerCase() || this.getExtensionFromMime(file.mimetype);
    const filename = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(targetDir, filename);

    await fs.promises.writeFile(filePath, file.buffer);

    const storagePath = `${sanitizedFolder}/${filename}`;
    return { storagePath, filename };
  }

  async deletePrivate(storagePath: string): Promise<void> {
    if (!storagePath) return;

    try {
      const absolutePath = this.getPrivateFilePath(storagePath);
      if (fs.existsSync(absolutePath)) {
        await fs.promises.unlink(absolutePath);
      }
    } catch (err) {
      console.error(`[LocalStorageService] Failed to delete private file safely:`, err);
    }
  }

  getPrivateFilePath(storagePath: string): string {
    if (!storagePath) {
      throw new Error('Invalid storage path.');
    }
    const normalizedRelative = path.normalize(storagePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const absolutePath = path.resolve(this.privateBaseDir, normalizedRelative);

    if (!absolutePath.startsWith(this.privateBaseDir)) {
      throw new Error('Path traversal detected.');
    }

    return absolutePath;
  }

  private getExtensionFromMime(mime: string): string {
    switch (mime) {
      case 'image/jpeg':
        return '.jpg';
      case 'image/png':
        return '.png';
      case 'image/webp':
        return '.webp';
      case 'application/pdf':
        return '.pdf';
      case 'application/msword':
        return '.doc';
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return '.docx';
      default:
        return '.bin';
    }
  }
}

export const storageService = new LocalStorageService();
