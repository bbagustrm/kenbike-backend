import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync, mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LocalStorageService {
    private readonly uploadDir: string;
    private readonly baseUrl: string;

    constructor(
        private configService: ConfigService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {
        this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || './uploads';
        this.baseUrl = this.configService.get<string>('BASE_URL') || 'http://localhost:3000';
        this.ensureUploadDir();
    }

    private ensureUploadDir() {
        const folders = ['profiles', 'products', 'variants', 'reviews'];

        if (!existsSync(this.uploadDir)) {
            mkdirSync(this.uploadDir, { recursive: true });
            this.logger.info(`📁 Created upload directory: ${this.uploadDir}`);
        }

        folders.forEach((folder) => {
            const folderPath = path.join(this.uploadDir, folder);
            if (!existsSync(folderPath)) {
                mkdirSync(folderPath, { recursive: true });
                this.logger.info(`📁 Created subfolder: ${folderPath}`);
            }
        });
    }

    async uploadImage(
        file: Express.Multer.File,
        folder: 'profiles' | 'products' | 'variants' | 'reviews',
    ): Promise<{ url: string; path: string }> {
        try {
            if (!file) {
                throw new BadRequestException('No file provided');
            }

            const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            if (!allowedMimeTypes.includes(file.mimetype)) {
                throw new BadRequestException(
                    'Invalid file type. Only JPEG, PNG, and WebP are allowed',
                );
            }

            const maxSize = 2 * 1024 * 1024;
            if (file.size > maxSize) {
                throw new BadRequestException('File size must not exceed 2MB');
            }

            // Generate filename
            const ext = path.extname(file.originalname);
            const filename = `${uuidv4()}${ext}`;

            // Use ABSOLUTE path
            const absoluteUploadDir = path.resolve(this.uploadDir);
            const folderPath = path.join(absoluteUploadDir, folder);
            const filePath = path.join(folderPath, filename);

            if (!existsSync(folderPath)) {
                this.logger.error(`❌ Folder does not exist: ${folderPath}`);
                mkdirSync(folderPath, { recursive: true });
                this.logger.info(`📁 Created folder: ${folderPath}`);
            }

            this.logger.info('📤 About to write file:', {
                originalname: file.originalname,
                size: file.size,
                filename,
                folderPath,
                filePath,
                folderExists: existsSync(folderPath),
                canWrite: true, // We'll check this
            });

            await fs.writeFile(filePath, file.buffer);

            const fileExists = existsSync(filePath);
            this.logger.info(`File write result:`, {
                filePath,
                exists: fileExists,
                size: fileExists ? (await fs.stat(filePath)).size : 0,
            });

            if (!fileExists) {
                throw new BadRequestException('File was not written to disk');
            }

            // Generate public URL - use BASE_URL directly
            const url = `${this.baseUrl}/uploads/${folder}/${filename}`;

            this.logger.info(`✅ Upload complete:`, {
                url,
                filePath,
            });

            return { url, path: filePath };
        } catch (error) {
            this.logger.error('❌ Upload failed:', {
                error: error.message,
                stack: error.stack,
            });
            throw new BadRequestException(`Failed to upload image: ${error.message}`);
        }
    }

    async deleteImage(imageUrl: string): Promise<void> {
        try {
            if (!imageUrl) return;

            const urlParts = imageUrl.split('/uploads/');
            if (urlParts.length < 2) {
                this.logger.warn(`Invalid image URL format: ${imageUrl}`);
                return;
            }

            const relativePath = urlParts[1];
            const filePath = path.join(this.uploadDir, relativePath);

            if (existsSync(filePath)) {
                await fs.unlink(filePath);
                this.logger.info(`🗑️ Image deleted: ${filePath}`);
            } else {
                this.logger.warn(`Image not found: ${filePath}`);
            }
        } catch (error) {
            this.logger.error('Failed to delete image', error);
        }
    }

    async deleteImages(imageUrls: string[]): Promise<void> {
        const deletePromises = imageUrls.map((url) => this.deleteImage(url));
        await Promise.all(deletePromises);
    }
}