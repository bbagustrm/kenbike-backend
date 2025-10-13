import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';

export class FileUploadUtil {
    /**
     * Allowed image extensions
     */
    private static readonly ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

    /**
     * Max file size (2MB in bytes)
     */
    private static readonly MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

    /**
     * Validate image file
     */
    static validateImageFile(file: Express.Multer.File): void {
        if (!file) {
            throw new BadRequestException('File is required');
        }

        // Check file size
        if (file.size > this.MAX_FILE_SIZE) {
            throw new BadRequestException('File size must not exceed 2MB');
        }

        // Check file extension
        const fileExtension = extname(file.originalname).toLowerCase();
        if (!this.ALLOWED_EXTENSIONS.includes(fileExtension)) {
            throw new BadRequestException(
                'Only JPG, JPEG, PNG, and WEBP formats are allowed',
            );
        }

        // Check mimetype
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
            throw new BadRequestException('Invalid file type');
        }
    }

    /**
     * Get file filter for multer
     */
    static imageFileFilter = (req: any, file: Express.Multer.File, callback: any) => {
        const fileExtension = extname(file.originalname).toLowerCase();

        if (!FileUploadUtil.ALLOWED_EXTENSIONS.includes(fileExtension)) {
            return callback(
                new BadRequestException('Only JPG, JPEG, PNG, and WEBP formats are allowed'),
                false,
            );
        }

        callback(null, true);
    };

    /**
     * Validate multiple files
     */
    static validateMultipleFiles(files: Express.Multer.File[], maxFiles: number = 5): void {
        if (files.length > maxFiles) {
            throw new BadRequestException(`Maximum ${maxFiles} files allowed`);
        }

        files.forEach((file) => this.validateImageFile(file));
    }
}