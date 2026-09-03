export interface IStorageService {
  save(file: Express.Multer.File, folder: string): Promise<string>;
  delete(fileUrl: string): Promise<void>;
}
