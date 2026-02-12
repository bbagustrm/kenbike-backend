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

type UploadFolder = 'profiles' | 'products' | 'variants' | 'gallery' | 'reviews';

@Controller('upload')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadController {
    constructor(private readonly localStorageService: LocalStorageService) {}

    /**
     * POST /upload/image - Single image upload
     * Returns environment-aware URL (relative for dev, full URL for prod)
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
    ) {
        if (!file) {
            throw new BadRequestException('File is required');
        }
        if (!folder) {
            throw new BadRequestException('Folder parameter is required');
        }

        FileUploadUtil.validateImageFile(file);

        // ✅ LocalStorageService handles URL format based on environment
        const result = await this.localStorageService.uploadImage(file, folder);

        return {
            message: 'Image uploaded successfully',
            data: {
                url: result.url, // Already environment-aware!
                path: result.path,
            },
        };
    }

    /**
     * POST /upload/images - Multiple images upload
     * Returns environment-aware URLs
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
    ) {
        if (!files || files.length === 0) {
            throw new BadRequestException('At least one file is required');
        }
        if (!folder) {
            throw new BadRequestException('Folder parameter is required');
        }

        const maxFiles = folder === 'gallery' ? 20 : 10;
        FileUploadUtil.validateMultipleFiles(files, maxFiles);

        // Upload all files - LocalStorageService returns proper URLs
        const uploadPromises = files.map((file) =>
            this.localStorageService.uploadImage(file, folder)
        );

        const results = await Promise.all(uploadPromises);

        return {
            message: `${results.length} images uploaded successfully`,
            data: {
                urls: results.map((r) => r.url), // Already environment-aware!
                count: results.length,
            },
        };
    }

    /**
     * POST /upload/profile - Profile image upload
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

        const result = await this.localStorageService.uploadImage(file, 'profiles');

        return {
            message: 'Profile image uploaded successfully',
            data: {
                url: result.url,
                path: result.path,
            },
        };
    }

    /**
     * POST /upload/product - Product image upload
     */
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

        const result = await this.localStorageService.uploadImage(file, 'products');

        return {
            message: 'Product image uploaded successfully',
            data: {
                url: result.url,
                path: result.path,
            },
        };
    }

    /**
     * POST /upload/variants - Variant images upload
     */
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

        const uploadPromises = files.map((file) =>
            this.localStorageService.uploadImage(file, 'variants')
        );

        const results = await Promise.all(uploadPromises);

        return {
            message: `${results.length} variant images uploaded successfully`,
            data: {
                urls: results.map((r) => r.url),
                count: results.length,
            },
        };
    }

    /**
     * POST /upload/gallery - Gallery images upload
     */
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

        const uploadPromises = files.map((file) =>
            this.localStorageService.uploadImage(file, 'gallery')
        );

        const results = await Promise.all(uploadPromises);

        return {
            message: `${results.length} gallery images uploaded successfully`,
            data: {
                urls: results.map((r) => r.url),
                count: results.length,
            },
        };
    }
}