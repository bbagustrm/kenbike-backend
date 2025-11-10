import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// ✅ Add type for storage folders
export type StorageFolder = 'profiles' | 'products' | 'variants' | 'gallery' | 'reviews';

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

        this.logger.info(`📁 Storage initialized:`, {
            uploadDir: this.uploadDir,
            baseUrl: this.baseUrl,
            absolutePath: path.resolve(this.uploadDir),
        });

        this.ensureUploadDir();
    }

    private ensureUploadDir() {
        // ✅ Add 'gallery' to folders array
        const folders: StorageFolder[] = ['profiles', 'products', 'variants', 'gallery', 'reviews'];

        // Get absolute path
        const absoluteUploadDir = path.resolve(this.uploadDir);

        this.logger.info(`📂 Ensuring upload directory exists:`, {
            relative: this.uploadDir,
            absolute: absoluteUploadDir,
        });

        // Create main upload directory
        if (!fs.existsSync(absoluteUploadDir)) {
            try {
                fs.mkdirSync(absoluteUploadDir, { recursive: true, mode: 0o755 });
                this.logger.info(`✅ Created upload directory: ${absoluteUploadDir}`);
            } catch (error) {
                this.logger.error(`❌ Failed to create upload directory:`, error);
                throw error;
            }
        } else {
            this.logger.info(`✅ Upload directory already exists: ${absoluteUploadDir}`);
        }

        // Create subfolders
        folders.forEach((folder) => {
            const folderPath = path.join(absoluteUploadDir, folder);

            if (!fs.existsSync(folderPath)) {
                try {
                    fs.mkdirSync(folderPath, { recursive: true, mode: 0o755 });
                    this.logger.info(`✅ Created subfolder: ${folderPath}`);
                } catch (error) {
                    this.logger.error(`❌ Failed to create subfolder ${folder}:`, error);
                    throw error;
                }
            }

            // Check permissions
            try {
                fs.accessSync(folderPath, fs.constants.W_OK | fs.constants.R_OK);
                this.logger.info(`✅ Folder ${folder} is writable`);
            } catch (error) {
                this.logger.error(`❌ Folder ${folder} is NOT writable:`, error);
                throw new Error(`Upload folder ${folder} is not writable. Please check permissions.`);
            }
        });
    }

    async uploadImage(
        file: Express.Multer.File,
        folder: StorageFolder, // ✅ Use StorageFolder type
    ): Promise<{ url: string; path: string }> {
        try {
            this.logger.info('📤 Starting file upload:', {
                originalName: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                bufferLength: file.buffer?.length,
                folder,
            });

            if (!file) {
                throw new BadRequestException('No file provided');
            }

            if (!file.buffer) {
                throw new BadRequestException('File buffer is empty');
            }

            // Validate file type
            const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            if (!allowedMimeTypes.includes(file.mimetype)) {
                throw new BadRequestException(
                    'Invalid file type. Only JPEG, PNG, and WEBP are allowed',
                );
            }

            const maxSize = folder === 'gallery' ? 5 * 1024 * 1024 : 2 * 1024 * 1024; // 5MB for gallery, 2MB for others
            if (file.size > maxSize) {
                const maxSizeMB = folder === 'gallery' ? 5 : 2;
                throw new BadRequestException(`File size must not exceed ${maxSizeMB}MB`);
            }

            // Generate filename
            const ext = path.extname(file.originalname).toLowerCase();
            if (!ext || !['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
                throw new BadRequestException('Invalid file extension');
            }

            const filename = `${uuidv4()}${ext}`;

            // Get absolute paths
            const absoluteUploadDir = path.resolve(this.uploadDir);
            const folderPath = path.join(absoluteUploadDir, folder);
            const filePath = path.join(folderPath, filename);

            this.logger.info('📂 File paths:', {
                uploadDir: this.uploadDir,
                absoluteUploadDir,
                folderPath,
                filePath,
                filename,
            });

            // Check if folder exists
            if (!fs.existsSync(folderPath)) {
                this.logger.warn(`❗ Folder doesn't exist, creating: ${folderPath}`);
                fs.mkdirSync(folderPath, { recursive: true, mode: 0o755 });
            }

            // Check folder permissions
            try {
                fs.accessSync(folderPath, fs.constants.W_OK | fs.constants.R_OK);
                this.logger.info('✅ Folder is writable');
            } catch (permError) {
                this.logger.error('❌ Folder permission error:', permError);
                throw new BadRequestException(`Cannot write to upload folder. Permission denied.`);
            }

            // Write file synchronously for better error handling
            try {
                this.logger.info('💾 Writing file...');
                fs.writeFileSync(filePath, file.buffer, { mode: 0o644 });
                this.logger.info('✅ File written successfully');
            } catch (writeError: any) {
                this.logger.error('❌ File write error:', {
                    error: writeError.message,
                    code: writeError.code,
                    errno: writeError.errno,
                    syscall: writeError.syscall,
                    path: writeError.path,
                });
                throw new BadRequestException(`Failed to write file: ${writeError.message}`);
            }

            // Verify file exists
            if (!fs.existsSync(filePath)) {
                this.logger.error('❌ File verification failed - file does not exist after write');
                throw new BadRequestException('File was not saved properly');
            }

            // Get file stats
            const stats = fs.statSync(filePath);
            this.logger.info('📊 File stats:', {
                filePath,
                exists: true,
                size: stats.size,
                mode: stats.mode.toString(8),
                uid: stats.uid,
                gid: stats.gid,
            });

            // Verify file size matches
            if (stats.size !== file.size) {
                this.logger.warn('⚠️ File size mismatch:', {
                    original: file.size,
                    saved: stats.size,
                });
            }

            const url = `${this.baseUrl}/uploads/${folder}/${filename}`;

            this.logger.info('✅ Upload complete:', {
                url,
                filePath,
                size: stats.size,
            });

            return { url, path: filePath };
        } catch (error: any) {
            this.logger.error('❌ Upload failed:', {
                error: error.message,
                stack: error.stack,
                code: error.code,
                name: error.name,
            });

            if (error instanceof BadRequestException) {
                throw error;
            }

            throw new BadRequestException(`Failed to upload image: ${error.message}`);
        }
    }

    /**
     * Delete a single file by URL or path
     * This is an alias for deleteImage for better naming consistency
     */
    async deleteFile(fileUrl: string): Promise<void> {
        return this.deleteImage(fileUrl);
    }

    async deleteImage(imageUrl: string): Promise<void> {
        try {
            if (!imageUrl) return;

            let relativePath: string;

            if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
                try {
                    const url = new URL(imageUrl);
                    relativePath = url.pathname.replace(/^\/uploads\//, '');
                } catch (urlError) {
                    this.logger.warn(`Invalid URL format: ${imageUrl}`);
                    return;
                }
            } else {
                // It's a relative path
                const urlParts = imageUrl.split('/uploads/');
                if (urlParts.length < 2) {
                    this.logger.warn(`Invalid image URL format: ${imageUrl}`);
                    return;
                }
                relativePath = urlParts[1];
            }

            const absoluteUploadDir = path.resolve(this.uploadDir);
            const filePath = path.join(absoluteUploadDir, relativePath);

            // Security check: ensure the file is within the upload directory
            const normalizedFilePath = path.normalize(filePath);
            const normalizedUploadDir = path.normalize(absoluteUploadDir);

            if (!normalizedFilePath.startsWith(normalizedUploadDir)) {
                this.logger.warn(`⚠️ Security: Attempted to delete file outside upload directory: ${filePath}`);
                return;
            }

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                this.logger.info(`🗑️ Image deleted: ${filePath}`);
            } else {
                this.logger.warn(`⚠️ Image not found: ${filePath}`);
            }
        } catch (error: any) {
            this.logger.error('❌ Delete failed:', {
                error: error.message,
                url: imageUrl,
            });
            // Don't throw error, just log it
            // This prevents deletion failures from breaking other operations
        }
    }

    async deleteImages(imageUrls: string[]): Promise<void> {
        for (const url of imageUrls) {
            await this.deleteImage(url);
        }
    }

    /**
     * Delete multiple files by URLs or paths
     * This is an alias for deleteImages for better naming consistency
     */
    async deleteFiles(fileUrls: string[]): Promise<void> {
        return this.deleteImages(fileUrls);
    }

    /**
     * Check if a file exists
     */
    fileExists(fileUrl: string): boolean {
        try {
            if (!fileUrl) return false;

            let relativePath: string;

            if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
                try {
                    const url = new URL(fileUrl);
                    relativePath = url.pathname.replace(/^\/uploads\//, '');
                } catch (urlError) {
                    return false;
                }
            } else {
                const urlParts = fileUrl.split('/uploads/');
                if (urlParts.length < 2) {
                    return false;
                }
                relativePath = urlParts[1];
            }

            const absoluteUploadDir = path.resolve(this.uploadDir);
            const filePath = path.join(absoluteUploadDir, relativePath);

            return fs.existsSync(filePath);
        } catch (error) {
            return false;
        }
    }

    /**
     * Get file size in bytes
     */
    getFileSize(fileUrl: string): number | null {
        try {
            if (!fileUrl) return null;

            let relativePath: string;

            if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
                try {
                    const url = new URL(fileUrl);
                    relativePath = url.pathname.replace(/^\/uploads\//, '');
                } catch (urlError) {
                    return null;
                }
            } else {
                const urlParts = fileUrl.split('/uploads/');
                if (urlParts.length < 2) {
                    return null;
                }
                relativePath = urlParts[1];
            }

            const absoluteUploadDir = path.resolve(this.uploadDir);
            const filePath = path.join(absoluteUploadDir, relativePath);

            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                return stats.size;
            }

            return null;
        } catch (error) {
            return null;
        }
    }
}