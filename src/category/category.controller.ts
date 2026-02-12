import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus, BadRequestException,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { ValidationService } from '../common/validation.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { GetCategoriesDto, GetCategoriesSchema } from './dto/get-categories.dto';
import { CreateCategoryDto, CreateCategorySchema } from './dto/create-category.dto';
import { UpdateCategoryDto, UpdateCategorySchema } from './dto/update-category.dto';
import { Role } from '@prisma/client';

@Controller('categories')
export class CategoryController {
    constructor(
        private categoryService: CategoryService,
        private validationService: ValidationService,
    ) {}

    // ==========================================
    // PUBLIC ENDPOINTS
    // ==========================================

    /**
     * GET /categories
     * Get all active categories
     */
    @Public()
    @Get()
    async getAllCategories(@Query() query: GetCategoriesDto) {
        const dto = this.validationService.validate(GetCategoriesSchema, query);
        return this.categoryService.getAllCategories(dto, false);
    }

    /**
     * GET /categories/:slug
     * Get category detail by slug
     */
    @Public()
    @Get(':slug')
    async getCategoryBySlug(@Param('slug') slug: string) {
        return this.categoryService.getCategoryBySlug(slug);
    }

    /**
     * GET /categories/:slug/products
     * Get products by category
     */
    @Public()
    @Get(':slug/products')
    async getProductsByCategory(@Param('slug') slug: string, @Query() query: any) {
        return this.categoryService.getProductsByCategory(slug, query);
    }
}

@Controller('admin/categories'  )
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OWNER)
export class AdminCategoryController {
    constructor(
        private categoryService: CategoryService,
        private validationService: ValidationService,
    ) {}

    // ==========================================
    // ADMIN ENDPOINTS
    // ==========================================

    /**
     * GET /admin/categories
     * Get all categories (including inactive/deleted)
     */
    @Get()
    async getAllCategories(@Query() query: GetCategoriesDto) {
        const dto = this.validationService.validate(GetCategoriesSchema, query);
        return this.categoryService.getAllCategories(dto, true);
    }

    /**
     * GET /admin/categories/:id
     * Get category detail by ID
     */
    @Get(':id')
    async getCategoryById(@Param('id') id: string) {
        return this.categoryService.getCategoryById(id);
    }

    /**
     * GET /admin/categories/:id/statistics
     * Get category statistics
     */
    @Get(':id/statistics')
    async getCategoryStatistics(@Param('id') id: string) {
        return this.categoryService.getCategoryStatistics(id);
    }

    /**
     * POST /admin/categories
     * Create new category
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createCategory(@Body() body: CreateCategoryDto) {
        const dto = this.validationService.validate(CreateCategorySchema, body);
        return this.categoryService.createCategory(dto);
    }

    /**
     * PATCH /admin/categories/:id
     * Update category
     */
    @Patch(':id')
    async updateCategory(@Param('id') id: string, @Body() body: UpdateCategoryDto) {
        const dto = this.validationService.validate(UpdateCategorySchema, body);
        return this.categoryService.updateCategory(id, dto);
    }

    /**
     * DELETE /admin/categories/:id
     * Soft delete category
     */
    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    async deleteCategory(@Param('id') id: string) {
        return this.categoryService.deleteCategory(id);
    }

    /**
     * POST /admin/categories/:id/restore
     * Restore deleted category
     */
    @Post(':id/restore')
    async restoreCategory(@Param('id') id: string) {
        return this.categoryService.restoreCategory(id);
    }

    /**
     * DELETE /admin/categories/:id/permanent
     * Permanently delete category
     */
    @Delete(':id/permanent')
    @HttpCode(HttpStatus.OK)
    async hardDeleteCategory(@Param('id') id: string) {
        return this.categoryService.hardDeleteCategory(id);
    }

    /**
     * PATCH /admin/categories/:id/toggle-active
     * Toggle category active status
     */
    @Patch(':id/toggle-active')
    async toggleCategoryActive(@Param('id') id: string) {
        return this.categoryService.toggleCategoryActive(id);
    }

    /**
     * POST /admin/categories/bulk-delete
     * Bulk soft delete categories
     */
    @Post('bulk-delete')
    @HttpCode(HttpStatus.OK)
    async bulkDeleteCategories(@Body('ids') ids: string[]) {
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            throw new BadRequestException('Category IDs are required');
        }
        return this.categoryService.bulkDeleteCategories(ids);
    }

    /**
     * POST /admin/categories/bulk-restore
     * Bulk restore categories
     */
    @Post('bulk-restore')
    @HttpCode(HttpStatus.OK)
    async bulkRestoreCategories(@Body('ids') ids: string[]) {
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            throw new BadRequestException('Category IDs are required');
        }
        return this.categoryService.bulkRestoreCategories(ids);
    }
}