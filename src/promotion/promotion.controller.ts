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
    HttpStatus, BadRequestException, Inject,
} from '@nestjs/common';
import { PromotionService } from './promotion.service';
import { ValidationService } from '../common/validation.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { GetPromotionsDto, GetPromotionsSchema } from './dto/get-promotions.dto';
import { CreatePromotionDto, CreatePromotionSchema } from './dto/create-promotion.dto';
import { UpdatePromotionDto, UpdatePromotionSchema } from './dto/update-promotion.dto';
import { Role } from '@prisma/client';
import {WINSTON_MODULE_PROVIDER} from "nest-winston";
import {Logger} from "winston";

@Controller('promotions')
export class PromotionController {
    constructor(
        private promotionService: PromotionService,
        private validationService: ValidationService,
    ) {}

    // ==========================================
    // PUBLIC ENDPOINTS
    // ==========================================

    /**
     * GET /promotions/active
     * Get all currently active promotions
     */
    @Public()
    @Get('active')
    async getActivePromotions() {
        return this.promotionService.getActivePromotions();
    }

    /**
     * GET /promotions/:id
     * Get promotion detail
     */
    @Public()
    @Get(':id')
    async getPromotionById(@Param('id') id: string) {
        return this.promotionService.getPromotionById(id, false);
    }
}

@Controller('admin/promotions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OWNER)
export class AdminPromotionController {
    constructor(
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
        private promotionService: PromotionService,
        private validationService: ValidationService,
    ) {}

    // ==========================================
    // ADMIN ENDPOINTS
    // ==========================================

    /**
     * GET /admin/promotions
     * Get all promotions (including inactive/expired/deleted)
     */
    @Get()
    async getAllPromotions(@Query() query: GetPromotionsDto) {
        const dto = this.validationService.validate(GetPromotionsSchema, query);
        return this.promotionService.getAllPromotions(dto, true);
    }

    /**
     * GET /admin/promotions/:id
     * Get promotion detail by ID
     */
    @Get(':id')
    async getPromotionById(@Param('id') id: string) {
        return this.promotionService.getPromotionById(id, true);
    }

    /**
     * GET /admin/promotions/:id/details
     * Get promotion with all products
     */
    @Get(':id/details')
    async getPromotionDetailWithProducts(@Param('id') id: string) {
        return this.promotionService.getPromotionDetailWithProducts(id);
    }

    /**
     * GET /admin/promotions/:id/statistics
     * Get promotion statistics
     */
    @Get(':id/statistics')
    async getPromotionStatistics(@Param('id') id: string) {
        return this.promotionService.getPromotionStatistics(id);
    }

    /**
     * POST /admin/promotions
     * Create new promotion
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createPromotion(@Body() body: CreatePromotionDto) {
        const dto = this.validationService.validate(CreatePromotionSchema, body);
        return this.promotionService.createPromotion(dto);
    }

    /**
     * PATCH /admin/promotions/:id
     * Update promotion
     */
    @Patch(':id')
    async updatePromotion(@Param('id') id: string, @Body() body: UpdatePromotionDto) {
        const dto = this.validationService.validate(UpdatePromotionSchema, body);
        return this.promotionService.updatePromotion(id, dto);
    }

    /**
     * DELETE /admin/promotions/:id
     * Soft delete promotion
     */
    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    async deletePromotion(@Param('id') id: string) {
        return this.promotionService.deletePromotion(id);
    }

    /**
     * POST /admin/promotions/:id/restore
     * Restore deleted promotion
     */
    @Post(':id/restore')
    async restorePromotion(@Param('id') id: string) {
        return this.promotionService.restorePromotion(id);
    }

    /**
     * DELETE /admin/promotions/:id/permanent
     * Permanently delete promotion
     */
    @Delete(':id/permanent')
    @HttpCode(HttpStatus.OK)
    async hardDeletePromotion(@Param('id') id: string) {
        return this.promotionService.hardDeletePromotion(id);
    }

    /**
     * PATCH /admin/promotions/:id/toggle-active
     * Toggle promotion active status
     */
    @Patch(':id/toggle-active')
    async togglePromotionActive(@Param('id') id: string) {
        return this.promotionService.togglePromotionActive(id);
    }

    /**
     * POST /admin/promotions/:id/products/bulk
     * Bulk assign products to promotion
     */
    @Post(':id/products/bulk')
    async bulkAssignProducts(
        @Param('id') id: string,
        @Body('productIds') productIds: string[],
    ) {
        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
            throw new BadRequestException('Product IDs are required');
        }
        return this.promotionService.bulkAssignProducts(id, productIds);
    }

    /**
     * POST /admin/promotions/:id/products/:productId
     * Assign product to promotion
     */
    @Post(':id/products/:productId')
    async assignProductToPromotion(
        @Param('id') id: string,
        @Param('productId') productId: string,
    ) {
        return this.promotionService.assignProductToPromotion(id, productId);
    }

    /**
     * DELETE /admin/promotions/:id/products/:productId
     * Remove product from promotion
     */
    @Delete(':id/products/:productId')
    @HttpCode(HttpStatus.OK)
    async removeProductFromPromotion(
        @Param('id') id: string,
        @Param('productId') productId: string,
    ) {
        return this.promotionService.removeProductFromPromotion(id, productId);
    }

    /**
     * POST /admin/promotions/auto-update
     * Manually trigger auto update promotion status
     */
    @Post('auto-update')
    async manualAutoUpdate() {
        this.logger.info('🔧 Manual cron trigger by admin');
        return this.promotionService.autoUpdatePromotionStatus();
    }
}