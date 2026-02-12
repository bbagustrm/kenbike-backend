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
    HttpStatus,
    DefaultValuePipe,
    ParseIntPipe, BadRequestException,
} from '@nestjs/common';
import { TagService } from './tag.service';
import { ValidationService } from '../common/validation.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { GetTagsDto, GetTagsSchema } from './dto/get-tags.dto';
import { CreateTagDto, CreateTagSchema } from './dto/create-tag.dto';
import { UpdateTagDto, UpdateTagSchema } from './dto/update-tag.dto';
import { Role } from '@prisma/client';

@Controller('tags')
export class TagController {
    constructor(
        private tagService: TagService,
        private validationService: ValidationService,
    ) {}

    // ==========================================
    // PUBLIC ENDPOINTS
    // ==========================================

    /**
     * GET /tags
     * Get all active tags
     */
    @Public()
    @Get()
    async getAllTags(@Query() query: GetTagsDto) {
        const dto = this.validationService.validate(GetTagsSchema, query);
        return this.tagService.getAllTags(dto, false);
    }

    /**
     * GET /tags/popular
     * Get popular tags
     */
    @Public()
    @Get('popular')
    async getPopularTags(
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    ) {
        return this.tagService.getPopularTags(limit);
    }

    /**
     * GET /tags/:slug
     * Get tag detail by slug
     */
    @Public()
    @Get(':slug')
    async getTagBySlug(@Param('slug') slug: string) {
        return this.tagService.getTagBySlug(slug);
    }

    /**
     * GET /tags/:slug/products
     * Get products by tag
     */
    @Public()
    @Get(':slug/products')
    async getProductsByTag(
        @Param('slug') slug: string,
        @Query() query: any,
    ) {
        return this.tagService.getProductsByTag(slug, query);
    }
}

@Controller('admin/tags')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OWNER)
export class AdminTagController {
    constructor(
        private tagService: TagService,
        private validationService: ValidationService,
    ) {}

    // ==========================================
    // ADMIN ENDPOINTS
    // ==========================================

    /**
     * GET /admin/tags
     * Get all tags (including inactive/deleted)
     */
    @Get()
    async getAllTags(@Query() query: GetTagsDto) {
        const dto = this.validationService.validate(GetTagsSchema, query);
        return this.tagService.getAllTags(dto, true);
    }

    /**
     * GET /admin/tags/:id
     * Get tag detail by ID
     */
    @Get(':id')
    async getTagById(@Param('id') id: string) {
        return this.tagService.getTagById(id);
    }

    /**
     * GET /admin/tags/:id/statistics
     * Get tag statistics
     */
    @Get(':id/statistics')
    async getTagStatistics(@Param('id') id: string) {
        return this.tagService.getTagStatistics(id);
    }

    /**
     * POST /admin/tags
     * Create new tag
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createTag(@Body() body: CreateTagDto) {
        const dto = this.validationService.validate(CreateTagSchema, body);
        return this.tagService.createTag(dto);
    }

    /**
     * PATCH /admin/tags/:id
     * Update tag
     */
    @Patch(':id')
    async updateTag(@Param('id') id: string, @Body() body: UpdateTagDto) {
        const dto = this.validationService.validate(UpdateTagSchema, body);
        return this.tagService.updateTag(id, dto);
    }

    /**
     * DELETE /admin/tags/:id
     * Soft delete tag
     */
    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    async deleteTag(@Param('id') id: string) {
        return this.tagService.deleteTag(id);
    }

    /**
     * POST /admin/tags/:id/restore
     * Restore deleted tag
     */
    @Post(':id/restore')
    async restoreTag(@Param('id') id: string) {
        return this.tagService.restoreTag(id);
    }

    /**
     * DELETE /admin/tags/:id/permanent
     * Permanently delete tag
     */
    @Delete(':id/permanent')
    @HttpCode(HttpStatus.OK)
    async hardDeleteTag(@Param('id') id: string) {
        return this.tagService.hardDeleteTag(id);
    }

    /**
     * PATCH /admin/tags/:id/toggle-active
     * Toggle tag active status
     */
    @Patch(':id/toggle-active')
    async toggleTagActive(@Param('id') id: string) {
        return this.tagService.toggleTagActive(id);
    }

    /**
     * POST /admin/tags/bulk-delete
     * Bulk soft delete tags
     */
    @Post('bulk-delete')
    @HttpCode(HttpStatus.OK)
    async bulkDeleteTags(@Body('ids') ids: string[]) {
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            throw new BadRequestException('Tag IDs are required');
        }
        return this.tagService.bulkDeleteTags(ids);
    }

    /**
     * POST /admin/tags/bulk-restore
     * Bulk restore tags
     */
    @Post('bulk-restore')
    @HttpCode(HttpStatus.OK)
    async bulkRestoreTags(@Body('ids') ids: string[]) {
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            throw new BadRequestException('Tag IDs are required');
        }
        return this.tagService.bulkRestoreTags(ids);
    }
}