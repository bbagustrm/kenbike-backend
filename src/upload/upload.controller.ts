import {
    Controller,
    Post,
    UseInterceptors,
    UploadedFile,
    UploadedFiles,
    Body,
    BadRequestException,
    HttpCode,
    HttpStatus,
    UseGuards,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { LocalStorageService } from '../common/storage/local-storage.service';
import { FileUploadUtil } from '../utils/file-upload.util';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import * as sharp from 'sharp';
import { join } from 'path';
import { promises as fs } from 'fs';

type UploadFolder = 'profiles' | 'products' | 'variants' | 'gallery' | 'reviews';

@Controller('upload')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadController {
    constructor(private readonly localStorageService: LocalStorageService) {}

    // ✅ Helper: Convert image ke WebP untuk hemat size
    private async convertToWebP(
        file: Express.Multer.File,
        outputPath: string,
        quality = 80
    ): Promise<void> {
        await sharp(file.buffer)
            .webp({ quality, effort: 6 }) // effort 6 = balance speed & compression
            .toFile(outputPath);
    }

    /**
     * POST /upload/image - Upload dengan auto WebP conversion
     */
    @Post('image')
    @Roles(Role.ADMIN, Role.OWNER)
    @HttpCode(HttpStatus.OK)
    @UseInterceptors(
        FileInterceptor('file', {
            limits: { fileSize: 5 * 1024 * 1024 },
            fileFilter: FileUploadUtil.imageFileFilter,
        }),
    )
    async uploadImage(
        @UploadedFile() file: Express.Multer.File,
        @Body('folder') folder: UploadFolder,
        @Body('convertWebP') convertWebP?: string, // "true" untuk convert
    ) {
        if (!file) {
            throw new BadRequestException('File is required');
        }
        if (!folder) {
            throw new BadRequestException('Folder parameter is required');
        }

        FileUploadUtil.validateImageFile(file);

        // ✅ Convert ke WebP jika diminta (default: true untuk products/gallery)
        const shouldConvert = convertWebP === 'true' ||
            ['products', 'gallery', 'variants'].includes(folder);

        let result;

        if (shouldConvert) {
            // Simpan dengan format WebP
            const webpFilename = file.originalname.replace(/\.[^.]+$/, '.webp');
            const uploadDir = join(process.cwd(), 'uploads', folder);
            const outputPath = join(uploadDir, webpFilename);

            // Pastikan folder exists
            await fs.mkdir(uploadDir, { recursive: true });

            // Convert & save
            await this.convertToWebP(file, outputPath);

            result = {
                url: `/uploads/${folder}/${webpFilename}`,
                path: outputPath,
            };
        } else {
            // Upload normal
            result = await this.localStorageService.uploadImage(file, folder);
        }

        return {
            message: 'Image uploaded successfully',
            data: {
                url: result.url,
                path: result.path,
                optimized: shouldConvert,
            },
        };
    }

    /**
     * POST /upload/images - Batch upload dengan WebP
     */
    @Post('images')
    @Roles(Role.ADMIN, Role.OWNER)
    @HttpCode(HttpStatus.OK)
    @UseInterceptors(
        FilesInterceptor('files', 20, {
            limits: { fileSize: 5 * 1024 * 1024 },
            fileFilter: FileUploadUtil.imageFileFilter,
        }),
    )
    async uploadImages(
        @UploadedFiles() files: Express.Multer.File[],
        @Body('folder') folder: UploadFolder,
        @Body('convertWebP') convertWebP?: string,
    ) {
        if (!files || files.length === 0) {
            throw new BadRequestException('At least one file is required');
        }
        if (!folder) {
            throw new BadRequestException('Folder parameter is required');
        }

        const maxFiles = folder === 'gallery' ? 20 : 10;
        FileUploadUtil.validateMultipleFiles(files, maxFiles);

        const shouldConvert = convertWebP === 'true' ||
            ['products', 'gallery', 'variants'].includes(folder);

        const uploadPromises = files.map(async (file) => {
            if (shouldConvert) {
                const webpFilename = file.originalname.replace(/\.[^.]+$/, '.webp');
                const uploadDir = join(process.cwd(), 'uploads', folder);
                const outputPath = join(uploadDir, webpFilename);

                await fs.mkdir(uploadDir, { recursive: true });
                await this.convertToWebP(file, outputPath);

                return {
                    url: `/uploads/${folder}/${webpFilename}`,
                    path: outputPath,
                };
            } else {
                return this.localStorageService.uploadImage(file, folder);
            }
        });

        const results = await Promise.all(uploadPromises);

        return {
            message: `${results.length} images uploaded successfully`,
            data: {
                urls: results.map((r) => r.url),
                count: results.length,
                optimized: shouldConvert,
            },
        };
    }

    /**
     * POST /upload/profile
     */
    @Post('profile')
    @HttpCode(HttpStatus.OK)
    @UseInterceptors(
        FileInterceptor('file', {
            limits: { fileSize: 2 * 1024 * 1024 },
            fileFilter: FileUploadUtil.imageFileFilter,
        }),
    )
    async uploadProfile(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('File is required');
        }
        FileUploadUtil.validateImageFile(file);

        // Profile images biasanya kecil, convert ke WebP
        const webpFilename = file.originalname.replace(/\.[^.]+$/, '.webp');
        const uploadDir = join(process.cwd(), 'uploads', 'profiles');
        const outputPath = join(uploadDir, webpFilename);

        await fs.mkdir(uploadDir, { recursive: true });
        await this.convertToWebP(file, outputPath, 85); // Kualitas lebih tinggi untuk profile

        return {
            message: 'Profile image uploaded successfully',
            data: {
                url: `/uploads/profiles/${webpFilename}`,
                path: outputPath,
                optimized: true,
            },
        };
    }

    @Post('product')
    @Roles(Role.ADMIN, Role.OWNER)
    @HttpCode(HttpStatus.OK)
    @UseInterceptors(
        FileInterceptor('file', {
            limits: { fileSize: 2 * 1024 * 1024 },
            fileFilter: FileUploadUtil.imageFileFilter,
        }),
    )
    async uploadProduct(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('File is required');
        }
        FileUploadUtil.validateImageFile(file);

        const webpFilename = file.originalname.replace(/\.[^.]+$/, '.webp');
        const uploadDir = join(process.cwd(), 'uploads', 'products');
        const outputPath = join(uploadDir, webpFilename);

        await fs.mkdir(uploadDir, { recursive: true });
        await this.convertToWebP(file, outputPath);

        return {
            message: 'Product image uploaded successfully',
            data: {
                url: `/uploads/products/${webpFilename}`,
                path: outputPath,
                optimized: true,
            },
        };
    }

    @Post('variants')
    @Roles(Role.ADMIN, Role.OWNER)
    @HttpCode(HttpStatus.OK)
    @UseInterceptors(
        FilesInterceptor('files', 5, {
            limits: { fileSize: 2 * 1024 * 1024 },
            fileFilter: FileUploadUtil.imageFileFilter,
        }),
    )
    async uploadVariantImages(@UploadedFiles() files: Express.Multer.File[]) {
        if (!files || files.length === 0) {
            throw new BadRequestException('At least one file is required');
        }
        FileUploadUtil.validateMultipleFiles(files, 5);

        const uploadPromises = files.map(async (file) => {
            const webpFilename = file.originalname.replace(/\.[^.]+$/, '.webp');
            const uploadDir = join(process.cwd(), 'uploads', 'variants');
            const outputPath = join(uploadDir, webpFilename);

            await fs.mkdir(uploadDir, { recursive: true });
            await this.convertToWebP(file, outputPath);

            return {
                url: `/uploads/variants/${webpFilename}`,
                path: outputPath,
            };
        });

        const results = await Promise.all(uploadPromises);

        return {
            message: `${results.length} variant images uploaded successfully`,
            data: {
                urls: results.map((r) => r.url),
                count: results.length,
                optimized: true,
            },
        };
    }

    @Post('gallery')
    @Roles(Role.ADMIN, Role.OWNER)
    @HttpCode(HttpStatus.OK)
    @UseInterceptors(
        FilesInterceptor('files', 20, {
            limits: { fileSize: 5 * 1024 * 1024 },
            fileFilter: FileUploadUtil.imageFileFilter,
        }),
    )
    async uploadGalleryImages(@UploadedFiles() files: Express.Multer.File[]) {
        if (!files || files.length === 0) {
            throw new BadRequestException('At least one file is required');
        }
        FileUploadUtil.validateMultipleFiles(files, 20);

        const uploadPromises = files.map(async (file) => {
            const webpFilename = file.originalname.replace(/\.[^.]+$/, '.webp');
            const uploadDir = join(process.cwd(), 'uploads', 'gallery');
            const outputPath = join(uploadDir, webpFilename);

            await fs.mkdir(uploadDir, { recursive: true });
            await this.convertToWebP(file, outputPath);

            return {
                url: `/uploads/gallery/${webpFilename}`,
                path: outputPath,
            };
        });

        const results = await Promise.all(uploadPromises);

        return {
            message: `${results.length} gallery images uploaded successfully`,
            data: {
                urls: results.map((r) => r.url),
                count: results.length,
                optimized: true,
            },
        };
    }
}