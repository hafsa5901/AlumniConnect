export interface IStorageService {
  save(file: Express.Multer.File, folder: string): Promise<string>;
  delete(fileUrl: string): Promise<void>;
  savePrivate(file: Express.Multer.File, folder: string): Promise<{ storagePath: string; filename: string }>;
  deletePrivate(storagePath: string): Promise<void>;
  getPrivateFilePath(storagePath: string): string;
}
