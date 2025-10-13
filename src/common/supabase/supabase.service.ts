import { Injectable, BadRequestException, InternalServerErrorException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

export interface UploadResult {
    url: string;
    path: string;
    fullPath: string;
}

@Injectable()
export class SupabaseService {
    private supabase: SupabaseClient;
    private readonly bucketName: string;
    private readonly publicUrl: string;

    constructor(
        private configService: ConfigService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {
        const supabaseUrl = this.getRequiredEnv('SUPABASE_URL');
        const supabaseKey = this.getRequiredEnv('SUPABASE_ANON_KEY');
        this.bucketName = this.getRequiredEnv('SUPABASE_BUCKET_NAME');
        this.publicUrl = this.getRequiredEnv('SUPABASE_PUBLIC_URL');

        if (!supabaseUrl || !supabaseKey || !this.bucketName || !this.publicUrl) {
            throw new Error('❌ Missing Supabase configuration values in environment variables.');
        }

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase URL and Key must be provided');
        }

        this.supabase = createClient(supabaseUrl, supabaseKey);
        this.logger.info('✅ Supabase client initialized');
    }

    private getRequiredEnv(key: string): string {
        const val = this.configService.get<string>(key);
        if (!val) {
            this.logger.error(`Missing environment variable ${key}`);
            throw new Error(`Environment variable ${key} is required`);
        }
        return val;
    }

    /**
     * Generate unique filename
     */
    private generateFileName(originalName: string): string {
        const ext = path.extname(originalName);
        const uniqueName = `${uuidv4()}${ext}`;
        return uniqueName;
    }

    /**
     * Validate image file
     */
    private validateImageFile(file: Express.Multer.File): void {
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const maxSize = 2 * 1024 * 1024; // 2MB

        if (!allowedMimeTypes.includes(file.mimetype)) {
            throw new BadRequestException('Only JPG, JPEG, PNG, and WEBP formats are allowed');
        }

        if (file.size > maxSize) {
            throw new BadRequestException('File size must not exceed 2MB');
        }
    }

    /**
     * Upload single image to Supabase Storage
     * @param file - Multer file object
     * @param folder - Folder path in bucket (e.g., 'products', 'variants', 'reviews')
     * @returns Upload result with public URL
     */
    async uploadImage(
        file: Express.Multer.File,
        folder: string = 'general',
    ): Promise<UploadResult> {
        try {
            // Validate file
            this.validateImageFile(file);

            // Generate unique filename
            const fileName = this.generateFileName(file.originalname);
            const filePath = `${folder}/${fileName}`;

            // Upload to Supabase
            const { data, error } = await this.supabase.storage
                .from(this.bucketName)
                .upload(filePath, file.buffer, {
                    contentType: file.mimetype,
                    cacheControl: '3600',
                    upsert: false,
                });

            if (error) {
                this.logger.error('Supabase upload error:', error);
                throw new InternalServerErrorException('Failed to upload image');
            }

            // Get public URL
            const { data: urlData } = this.supabase.storage
                .from(this.bucketName)
                .getPublicUrl(filePath);

            const publicUrl = urlData.publicUrl;

            this.logger.info(`✅ Image uploaded: ${filePath}`);

            return {
                url: publicUrl,
                path: fileName,
                fullPath: filePath,
            };
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            this.logger.error('Upload error:', error);
            throw new InternalServerErrorException('Failed to upload image');
        }
    }

    /**
     * Upload multiple images
     * @param files - Array of Multer file objects
     * @param folder - Folder path in bucket
     * @returns Array of upload results
     */
    async uploadMultipleImages(
        files: Express.Multer.File[],
        folder: string = 'general',
    ): Promise<UploadResult[]> {
        const uploadPromises = files.map((file) => this.uploadImage(file, folder));
        return Promise.all(uploadPromises);
    }

    /**
     * Delete image from Supabase Storage
     * @param filePath - Full path of file in bucket (e.g., 'products/uuid.jpg')
     */
    async deleteImage(filePath: string): Promise<void> {
        try {
            const { error } = await this.supabase.storage
                .from(this.bucketName)
                .remove([filePath]);

            if (error) {
                this.logger.error('Supabase delete error:', error);
                throw new InternalServerErrorException('Failed to delete image');
            }

            this.logger.info(`✅ Image deleted: ${filePath}`);
        } catch (error) {
            this.logger.error('Delete error:', error);
            throw new InternalServerErrorException('Failed to delete image');
        }
    }

    /**
     * Delete multiple images
     * @param filePaths - Array of file paths
     */
    async deleteMultipleImages(filePaths: string[]): Promise<void> {
        try {
            const { error } = await this.supabase.storage
                .from(this.bucketName)
                .remove(filePaths);

            if (error) {
                this.logger.error('Supabase delete multiple error:', error);
                throw new InternalServerErrorException('Failed to delete images');
            }

            this.logger.info(`✅ ${filePaths.length} images deleted`);
        } catch (error) {
            this.logger.error('Delete multiple error:', error);
            throw new InternalServerErrorException('Failed to delete images');
        }
    }

    /**
     * Extract file path from public URL
     * @param publicUrl - Public URL from Supabase
     * @returns File path in bucket
     */
    extractFilePathFromUrl(publicUrl: string): string | null {
        try {
            // Example URL: https://xyz.supabase.co/storage/v1/object/public/store-images/products/uuid.jpg
            // Extract: products/uuid.jpg
            const urlParts = publicUrl.split(`${this.bucketName}/`);
            if (urlParts.length > 1) {
                return urlParts[1];
            }
            return null;
        } catch (error) {
            this.logger.error('Extract path error:', error);
            return null;
        }
    }

    /**
     * Check if bucket exists, create if not
     */
    async ensureBucketExists(): Promise<void> {
        try {
            const { data: buckets, error } = await this.supabase.storage.listBuckets();

            if (error) {
                throw error;
            }

            const bucketExists = buckets?.some((bucket) => bucket.name === this.bucketName);

            if (!bucketExists) {
                const { error: createError } = await this.supabase.storage.createBucket(
                    this.bucketName,
                    {
                        public: true,
                        fileSizeLimit: 2097152, // 2MB
                        allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
                    },
                );

                if (createError) {
                    throw createError;
                }

                this.logger.info(`✅ Bucket created: ${this.bucketName}`);
            } else {
                this.logger.info(`✅ Bucket exists: ${this.bucketName}`);
            }
        } catch (error) {
            this.logger.error('Ensure bucket error:', error);
            throw new InternalServerErrorException('Failed to ensure bucket exists');
        }
    }

    /**
     * Get file info
     */
    async getFileInfo(filePath: string): Promise<any> {
        try {
            const { data, error } = await this.supabase.storage
                .from(this.bucketName)
                .list(path.dirname(filePath), {
                    search: path.basename(filePath),
                });

            if (error) {
                throw error;
            }

            return data?.[0] || null;
        } catch (error) {
            this.logger.error('Get file info error:', error);
            return null;
        }
    }
}