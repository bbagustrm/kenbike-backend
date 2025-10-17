import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    HttpCode,
    HttpStatus,
    ParseIntPipe,
    DefaultValuePipe, Patch, BadRequestException, Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductService } from './product.service';
import { ValidationService } from '../common/validation.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { FileUploadUtil } from '../utils/file-upload.util';
import { GetProductsDto, GetProductsSchema } from './dto/get-products.dto';
import { CreateProductDto, CreateProductSchema } from './dto/create-product.dto';
import { Role } from '@prisma/client';
import {UpdateProductDto, UpdateProductSchema} from "./dto/update-product.dto";

@Controller('products')
export class ProductController {
    constructor(
        private productService: ProductService,
        private validationService: ValidationService,
    ) {}

    // ==========================================
    // PUBLIC ENDPOINTS
    // ==========================================

    /**
     * GET /products
     * Get all active products with filters
     */
    @Public()
    @Get()
    async getAllProducts(@Query() query: GetProductsDto) {
        const dto = this.validationService.validate(GetProductsSchema, query);
        return this.productService.getAllProducts(dto, false);
    }

    /**
     * GET /products/featured
     * Get featured products
     */
    @Public()
    @Get('featured')
    async getFeaturedProducts(
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    ) {
        return this.productService.getFeaturedProducts(limit);
    }

    /**
     * GET /products/best-sellers
     * Get best selling products
     */
    @Public()
    @Get('best-sellers')
    async getBestSellers(
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('categorySlug') categorySlug?: string,
    ) {
        return this.productService.getBestSellers(limit, categorySlug);
    }

    /**
     * GET /products/trending
     * Get trending products
     */
    @Public()
    @Get('trending')
    async getTrendingProducts(
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
    ) {
        return this.productService.getTrendingProducts(limit, days);
    }

    /**
     * GET /products/:slug
     * Get product detail by slug
     */
    @Public()
    @Get(':slug')
    async getProductBySlug(@Param('slug') slug: string) {
        return this.productService.getProductBySlug(slug);
    }
}

@Controller('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OWNER)
export class AdminProductController {
    constructor(
        private productService: ProductService,
        private validationService: ValidationService,
    ) {}

    // ==========================================
    // ADMIN ENDPOINTS
    // ==========================================

    /**
     * GET /admin/products
     * Get all products (including inactive/deleted)
     */
    @Get()
    async getAllProducts(@Query() query: GetProductsDto) {
        const dto = this.validationService.validate(GetProductsSchema, query);
        return this.productService.getAllProducts(dto, true);
    }

    /**
     * GET /admin/products/:id
     * Get product detail by ID
     */
    @Get(':id')
    async getProductById(@Param('id') id: string) {
        return this.productService.getProductById(id);
    }

    /**
     * POST /admin/products
     * Create new product with variants
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @UseInterceptors(
        FileInterceptor('image', {
            limits: { fileSize: 2 * 1024 * 1024 },
            fileFilter: FileUploadUtil.imageFileFilter,
        }),
    )
    async createProduct(
        @Body() body: CreateProductDto,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        // Parse nested JSON if sent as string
        if (typeof body.variants === 'string') {
            body.variants = JSON.parse(body.variants);
        }
        if (typeof body.tagIds === 'string') {
            body.tagIds = JSON.parse(body.tagIds);
        }

        const dto = this.validationService.validate(CreateProductSchema, body);
        return this.productService.createProduct(dto, file);
    }

    /**
     * PATCH /admin/products/:id
     * Update product
     */
    @Patch(':id')
    @UseInterceptors(
        FileInterceptor('image', {
            limits: { fileSize: 2 * 1024 * 1024 },
            fileFilter: FileUploadUtil.imageFileFilter,
        }),
    )
    async updateProduct(
        @Param('id') id: string,
        @Body() body: UpdateProductDto,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        // Parse nested JSON if sent as string
        if (typeof body.variants === 'string') {
            body.variants = JSON.parse(body.variants);
        }
        if (typeof body.tagIds === 'string') {
            body.tagIds = JSON.parse(body.tagIds);
        }

        const dto = this.validationService.validate(UpdateProductSchema, body);
        return this.productService.updateProduct(id, dto, file);
    }

    /**
     * DELETE /admin/products/:id
     * Soft delete product
     */
    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    async deleteProduct(@Param('id') id: string) {
        return this.productService.deleteProduct(id);
    }

    /**
     * POST /admin/products/:id/restore
     * Restore deleted product
     */
    @Post(':id/restore')
    async restoreProduct(@Param('id') id: string) {
        return this.productService.restoreProduct(id);
    }

    /**
     * DELETE /admin/products/:id/hard
     * Permanently delete product
     */
    @Delete(':id/hard')
    @HttpCode(HttpStatus.OK)
    async hardDeleteProduct(@Param('id') id: string) {
        return this.productService.hardDeleteProduct(id);
    }

    /**
     * PATCH /admin/products/:id/toggle-active
     * Toggle product active status
     */
    @Patch(':id/toggle-active')
    async toggleProductActive(@Param('id') id: string) {
        return this.productService.toggleProductActive(id);
    }

    /**
     * PATCH /admin/products/:id/toggle-featured
     * Toggle product featured status
     */
    @Patch(':id/toggle-featured')
    async toggleProductFeatured(@Param('id') id: string) {
        return this.productService.toggleProductFeatured(id);
    }

    /**
     * POST /admin/products/bulk-delete
     * Bulk soft delete products
     */
    @Post('bulk-delete')
    @HttpCode(HttpStatus.OK)
    async bulkDeleteProducts(@Body('ids') ids: string[]) {
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            throw new BadRequestException('Product IDs are required');
        }
        return this.productService.bulkDeleteProducts(ids);
    }

    /**
     * POST /admin/products/bulk-restore
     * Bulk restore products
     */
    @Post('bulk-restore')
    @HttpCode(HttpStatus.OK)
    async bulkRestoreProducts(@Body('ids') ids: string[]) {
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            throw new BadRequestException('Product IDs are required');
        }
        return this.productService.bulkRestoreProducts(ids);
    }
}