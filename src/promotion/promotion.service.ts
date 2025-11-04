import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
    Inject,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PaginationUtil } from '../utils/pagination.util';
import { GetPromotionsDto } from './dto/get-promotions.dto';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Prisma } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class PromotionService {
    constructor(
        private prisma: PrismaService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    /**
     * GET ALL PROMOTIONS (Public & Admin)
     */
    async getAllPromotions(dto: GetPromotionsDto, isAdmin: boolean = false) {
        const {
            page,
            limit,
            search,
            isActive,
            includeDeleted,
            sortBy,
            order,
        } = dto;

        // Validate pagination
        const { page: validPage, limit: validLimit } = PaginationUtil.validateParams(page, limit);

        // Build where clause
        const where: Prisma.PromotionWhereInput = {};

        // Soft delete filter
        if (!isAdmin || !includeDeleted) {
            where.deletedAt = null;
        }

        // Active filter
        if (!isAdmin) {
            where.isActive = true;
        } else if (isActive !== undefined) {
            where.isActive = isActive;
        }

        // For public, always filter out expired
        if (!isAdmin) {
            where.AND = [
                { startDate: { lte: new Date() } },
                { endDate: { gte: new Date() } },
            ];
        }

        // Search filter
        if (search) {
            where.name = { contains: search, mode: 'insensitive' };
        }

        // Get total count
        const total = await this.prisma.promotion.count({ where });

        // Prepare orderBy
        let orderBy: any = {};
        if (sortBy === 'productCount') {
            orderBy = { createdAt: order };
        } else {
            orderBy = { [sortBy]: order };
        }

        // Get promotions
        const promotions = await this.prisma.promotion.findMany({
            where,
            include: {
                _count: {
                    select: {
                        products: {
                            where: {
                                deletedAt: null,
                                ...(isAdmin ? {} : { isActive: true }),
                            },
                        },
                    },
                },
            },
            skip: PaginationUtil.getSkip(validPage, validLimit),
            take: validLimit,
            orderBy,
        });

        // Sort by product count if needed
        let sortedPromotions = promotions;
        if (sortBy === 'productCount') {
            sortedPromotions = promotions.sort((a, b) => {
                const diff = a._count.products - b._count.products;
                return order === 'asc' ? diff : -diff;
            });
        }

        // Transform response
        const data = sortedPromotions.map((promotion) => ({
            id: promotion.id,
            name: promotion.name,
            discount: promotion.discount,
            discountPercentage: `${(promotion.discount * 100).toFixed(0)}%`,
            startDate: promotion.startDate,
            endDate: promotion.endDate,
            isActive: promotion.isActive,
            isExpired: new Date() > new Date(promotion.endDate),
            isUpcoming: new Date() < new Date(promotion.startDate),
            productCount: promotion._count.products,
            ...(isAdmin && { deletedAt: promotion.deletedAt }),
            createdAt: promotion.createdAt,
            updatedAt: promotion.updatedAt,
        }));

        return {
            meta: PaginationUtil.generateMeta(total, validPage, validLimit),
            data,
        };
    }

    /**
     * GET ACTIVE PROMOTIONS (Public)
     */
    async getActivePromotions() {
        const now = new Date();

        const promotions = await this.prisma.promotion.findMany({
            where: {
                isActive: true,
                deletedAt: null,
                startDate: { lte: now },
                endDate: { gte: now },
            },
            include: {
                _count: {
                    select: {
                        products: {
                            where: {
                                deletedAt: null,
                                isActive: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                discount: 'desc',
            },
        });

        const data = promotions.map((promotion) => ({
            id: promotion.id,
            name: promotion.name,
            discount: promotion.discount,
            discountPercentage: `${(promotion.discount * 100).toFixed(0)}%`,
            startDate: promotion.startDate,
            endDate: promotion.endDate,
            productCount: promotion._count.products,
            daysRemaining: Math.ceil(
                (new Date(promotion.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
            ),
        }));

        return { data };
    }

    /**
     * GET PROMOTION BY ID (Admin & Public)
     */
    async getPromotionById(id: string, isAdmin: boolean = false) {
        const promotion = await this.prisma.promotion.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        products: {
                            where: {
                                deletedAt: null,
                            },
                        },
                    },
                },
            },
        });

        if (!promotion) {
            throw new NotFoundException('Promotion not found');
        }

        // Public can only see active, non-deleted, non-expired promotions
        if (!isAdmin) {
            if (
                promotion.deletedAt ||
                !promotion.isActive ||
                new Date() > new Date(promotion.endDate) ||
                new Date() < new Date(promotion.startDate)
            ) {
                throw new NotFoundException('Promotion not found');
            }
        }

        return {
            data: {
                id: promotion.id,
                name: promotion.name,
                discount: promotion.discount,
                discountPercentage: `${(promotion.discount * 100).toFixed(0)}%`,
                startDate: promotion.startDate,
                endDate: promotion.endDate,
                isActive: promotion.isActive,
                isExpired: new Date() > new Date(promotion.endDate),
                isUpcoming: new Date() < new Date(promotion.startDate),
                productCount: promotion._count.products,
                ...(isAdmin && { deletedAt: promotion.deletedAt }),
                createdAt: promotion.createdAt,
                updatedAt: promotion.updatedAt,
            },
        };
    }

    /**
     * GET PROMOTION DETAIL WITH PRODUCTS (Admin)
     */
    async getPromotionDetailWithProducts(id: string) {
        const promotion = await this.prisma.promotion.findUnique({
            where: { id },
            include: {
                products: {
                    where: { deletedAt: null },
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        idPrice: true,
                        enPrice: true,
                        images: {
                            orderBy: { order: 'asc' },
                            take: 1, // Only get primary image
                        },
                        totalSold: true,
                        isActive: true,
                    },
                    take: 50, // Limit products in response
                },
            },
        });

        if (!promotion) {
            throw new NotFoundException('Promotion not found');
        }

        return {
            data: {
                id: promotion.id,
                name: promotion.name,
                discount: promotion.discount,
                discountPercentage: `${(promotion.discount * 100).toFixed(0)}%`,
                startDate: promotion.startDate,
                endDate: promotion.endDate,
                isActive: promotion.isActive,
                isExpired: new Date() > new Date(promotion.endDate),
                isUpcoming: new Date() < new Date(promotion.startDate),
                deletedAt: promotion.deletedAt,
                products: promotion.products.map((product) => ({
                    ...product,
                    imageUrl: product.images[0]?.imageUrl || null, // Get primary image
                    images: product.images, // Keep images array
                    discountedIdPrice: Math.round(product.idPrice * (1 - promotion.discount)),
                    discountedEnPrice: Math.round(product.enPrice * (1 - promotion.discount)),
                    savings: Math.round(product.idPrice * promotion.discount),
                })),
                createdAt: promotion.createdAt,
                updatedAt: promotion.updatedAt,
            },
        };
    }

    /**
     * CREATE PROMOTION (Admin)
     */
    async createPromotion(dto: CreatePromotionDto) {
        // Check if name already exists
        const existingPromotion = await this.prisma.promotion.findFirst({
            where: {
                name: {
                    equals: dto.name,
                    mode: 'insensitive',
                },
                deletedAt: null,
            },
        });

        if (existingPromotion) {
            throw new ConflictException('Promotion with this name already exists');
        }

        // Create promotion
        const promotion = await this.prisma.promotion.create({
            data: {
                name: dto.name,
                discount: dto.discount,
                startDate: new Date(dto.startDate),
                endDate: new Date(dto.endDate),
                isActive: dto.isActive,
            },
        });

        this.logger.info(`✅ Promotion created: ${promotion.name} (${promotion.id})`);

        return this.getPromotionById(promotion.id, true);
    }

    /**
     * UPDATE PROMOTION (Admin)
     */
    async updatePromotion(id: string, dto: UpdatePromotionDto) {
        // Check if promotion exists
        const existingPromotion = await this.prisma.promotion.findUnique({
            where: { id },
        });

        if (!existingPromotion) {
            throw new NotFoundException('Promotion not found');
        }

        // Check if name is being changed and already exists
        if (dto.name && dto.name !== existingPromotion.name) {
            const nameExists = await this.prisma.promotion.findFirst({
                where: {
                    name: {
                        equals: dto.name,
                        mode: 'insensitive',
                    },
                    id: { not: id },
                    deletedAt: null,
                },
            });

            if (nameExists) {
                throw new ConflictException('Promotion with this name already exists');
            }
        }

        // Validate date range with existing dates
        const startDate = dto.startDate
            ? new Date(dto.startDate)
            : existingPromotion.startDate;
        const endDate = dto.endDate ? new Date(dto.endDate) : existingPromotion.endDate;

        if (endDate <= startDate) {
            throw new BadRequestException('End date must be after start date');
        }

        // Update promotion
        const promotion = await this.prisma.promotion.update({
            where: { id },
            data: {
                ...(dto.name && { name: dto.name }),
                ...(dto.discount !== undefined && { discount: dto.discount }),
                ...(dto.startDate && { startDate: new Date(dto.startDate) }),
                ...(dto.endDate && { endDate: new Date(dto.endDate) }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            },
        });

        this.logger.info(`✅ Promotion updated: ${promotion.name} (${promotion.id})`);

        return this.getPromotionById(promotion.id, true);
    }

    /**
     * DELETE PROMOTION (Admin) - Soft Delete
     */
    async deletePromotion(id: string) {
        const promotion = await this.prisma.promotion.findUnique({
            where: { id },
        });

        if (!promotion) {
            throw new NotFoundException('Promotion not found');
        }

        if (promotion.deletedAt) {
            throw new BadRequestException('Promotion already deleted');
        }

        // Soft delete promotion (products will have promotionId set to null)
        await this.prisma.$transaction([
            this.prisma.promotion.update({
                where: { id },
                data: { deletedAt: new Date() },
            }),
            this.prisma.product.updateMany({
                where: { promotionId: id },
                data: { promotionId: null },
            }),
        ]);

        this.logger.info(`🗑️ Promotion soft deleted: ${promotion.name} (${id})`);

        return {
            message: 'Promotion deleted successfully',
            data: { id, deletedAt: new Date() },
        };
    }

    /**
     * RESTORE PROMOTION (Admin)
     */
    async restorePromotion(id: string) {
        const promotion = await this.prisma.promotion.findUnique({
            where: { id },
        });

        if (!promotion) {
            throw new NotFoundException('Promotion not found');
        }

        if (!promotion.deletedAt) {
            throw new BadRequestException('Promotion is not deleted');
        }

        // Restore promotion
        await this.prisma.promotion.update({
            where: { id },
            data: { deletedAt: null },
        });

        this.logger.info(`♻️ Promotion restored: ${promotion.name} (${id})`);

        return this.getPromotionById(id, true);
    }

    /**
     * HARD DELETE PROMOTION (Admin) - Permanent Delete
     */
    async hardDeletePromotion(id: string) {
        const promotion = await this.prisma.promotion.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { products: true },
                },
            },
        });

        if (!promotion) {
            throw new NotFoundException('Promotion not found');
        }

        // Remove promotion from all products first
        if (promotion._count.products > 0) {
            await this.prisma.product.updateMany({
                where: { promotionId: id },
                data: { promotionId: null },
            });
        }

        // Hard delete from database
        await this.prisma.promotion.delete({
            where: { id },
        });

        this.logger.info(`💀 Promotion permanently deleted: ${promotion.name} (${id})`);

        return {
            message: 'Promotion permanently deleted',
            data: { id },
        };
    }

    /**
     * TOGGLE PROMOTION ACTIVE STATUS (Admin)
     */
    async togglePromotionActive(id: string) {
        const promotion = await this.prisma.promotion.findUnique({
            where: { id },
        });

        if (!promotion) {
            throw new NotFoundException('Promotion not found');
        }

        const updated = await this.prisma.promotion.update({
            where: { id },
            data: {
                isActive: !promotion.isActive,
            },
        });

        this.logger.info(
            `🔄 Promotion active status toggled: ${promotion.name} (${updated.isActive})`,
        );

        return {
            message: 'Promotion status updated',
            data: {
                id: updated.id,
                isActive: updated.isActive,
            },
        };
    }

    /**
     * ASSIGN PRODUCT TO PROMOTION (Admin)
     */
    async assignProductToPromotion(promotionId: string, productId: string) {
        // Check if promotion exists and is valid
        const promotion = await this.prisma.promotion.findUnique({
            where: { id: promotionId, deletedAt: null },
        });

        if (!promotion) {
            throw new NotFoundException('Promotion not found');
        }

        // Check if product exists
        const product = await this.prisma.product.findUnique({
            where: { id: productId, deletedAt: null },
        });

        if (!product) {
            throw new NotFoundException('Product not found');
        }

        // Check if product already has a promotion
        if (product.promotionId) {
            throw new ConflictException('Product already has an active promotion');
        }

        // Assign promotion to product
        await this.prisma.product.update({
            where: { id: productId },
            data: { promotionId },
        });

        this.logger.info(
            `✅ Product ${product.name} assigned to promotion ${promotion.name}`,
        );

        return {
            message: 'Product assigned to promotion successfully',
            data: {
                productId: product.id,
                productName: product.name,
                promotionId: promotion.id,
                promotionName: promotion.name,
                discount: promotion.discount,
                discountedPrice: Math.round(product.idPrice * (1 - promotion.discount)),
            },
        };
    }

    /**
     * REMOVE PRODUCT FROM PROMOTION (Admin)
     */
    async removeProductFromPromotion(promotionId: string, productId: string) {
        // Check if product exists and has this promotion
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
        });

        if (!product) {
            throw new NotFoundException('Product not found');
        }

        if (product.promotionId !== promotionId) {
            throw new BadRequestException('Product does not have this promotion');
        }

        // Remove promotion from product
        await this.prisma.product.update({
            where: { id: productId },
            data: { promotionId: null },
        });

        this.logger.info(`✅ Product removed from promotion`);

        return {
            message: 'Product removed from promotion successfully',
        };
    }

    /**
     * BULK ASSIGN PRODUCTS TO PROMOTION (Admin)
     */
    async bulkAssignProducts(promotionId: string, productIds: string[]) {
        // Check if promotion exists
        const promotion = await this.prisma.promotion.findUnique({
            where: { id: promotionId, deletedAt: null },
        });

        if (!promotion) {
            throw new NotFoundException('Promotion not found');
        }

        // Check products exist (without filtering by promotionId yet)
        const products = await this.prisma.product.findMany({
            where: {
                id: { in: productIds },
                deletedAt: null,
            },
            select: {
                id: true,
                name: true,
                promotionId: true,
            },
        });

        // Check if all requested products were found
        if (products.length !== productIds.length) {
            const foundIds = products.map((p) => p.id);
            const missingIds = productIds.filter((id) => !foundIds.includes(id));
            throw new NotFoundException(
                `Products not found: ${missingIds.join(', ')}`,
            );
        }

        // Check which products already have promotions
        const productsWithPromotion = products.filter((p) => p.promotionId !== null);

        if (productsWithPromotion.length > 0) {
            const productNames = productsWithPromotion.map((p) => p.name).join(', ');
            throw new ConflictException(
                `${productsWithPromotion.length} product(s) already have promotions: ${productNames}`,
            );
        }

        // Assign promotion to all products
        const result = await this.prisma.product.updateMany({
            where: {
                id: { in: productIds },
                deletedAt: null,
            },
            data: { promotionId },
        });

        this.logger.info(
            `✅ ${result.count} products assigned to promotion ${promotion.name}`,
        );

        return {
            message: `${result.count} products assigned to promotion successfully`,
            data: {
                count: result.count,
                promotionName: promotion.name,
                discount: promotion.discount,
                discountPercentage: `${(promotion.discount * 100).toFixed(0)}%`,
            },
        };
    }

    /**
     * AUTO ACTIVATE/DEACTIVATE PROMOTIONS (Cron Job)
     * Runs every hour to check promotion dates
     */
    @Cron(CronExpression.EVERY_HOUR)
    async autoUpdatePromotionStatus() {
        const now = new Date();

        // Activate promotions that should start
        const toActivate = await this.prisma.promotion.updateMany({
            where: {
                isActive: false,
                deletedAt: null,
                startDate: { lte: now },
                endDate: { gte: now },
            },
            data: { isActive: true },
        });

        // Deactivate expired promotions
        const toDeactivate = await this.prisma.promotion.updateMany({
            where: {
                isActive: true,
                deletedAt: null,
                endDate: { lt: now },
            },
            data: { isActive: false },
        });

        const expiredPromotions = await this.prisma.promotion.findMany({
            where: {
                deletedAt: null,
                endDate: { lt: now },
            },
            select: { id: true },
        });

        const expiredPromotionIds = expiredPromotions.map(p => p.id);

        let productsUpdated = 0;
        if (expiredPromotionIds.length > 0) {
            const updateResult = await this.prisma.product.updateMany({
                where: {
                    promotionId: { in: expiredPromotionIds },
                },
                data: {
                    promotionId: null,
                },
            });
            productsUpdated = updateResult.count;
        }

        if (toActivate.count > 0 || toDeactivate.count > 0 || productsUpdated > 0) {
            this.logger.info(
                `🔄 Auto-updated promotions: ${toActivate.count} activated, ${toDeactivate.count} deactivated, ${productsUpdated} products cleared`,
            );
        }

        return {
            activated: toActivate.count,
            deactivated: toDeactivate.count,
            productsCleared: productsUpdated,
        };
    }

    /**
     * GET PROMOTION STATISTICS (Admin)
     */
    async getPromotionStatistics(id: string) {
        const promotion = await this.prisma.promotion.findUnique({
            where: { id },
            include: {
                products: {
                    where: { deletedAt: null },
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        idPrice: true,
                        totalSold: true,
                        totalView: true,
                        avgRating: true,
                        isActive: true,
                    },
                },
            },
        });

        if (!promotion) {
            throw new NotFoundException('Promotion not found');
        }

        const totalProducts = promotion.products.length;
        const activeProducts = promotion.products.filter((p) => p.isActive).length;
        const totalSold = promotion.products.reduce((sum, p) => sum + p.totalSold, 0);
        const totalViews = promotion.products.reduce((sum, p) => sum + p.totalView, 0);

        // Calculate potential savings
        const potentialSavings = promotion.products.reduce(
            (sum, p) => sum + p.idPrice * promotion.discount * p.totalSold,
            0,
        );

        // Top products
        const topProducts = promotion.products
            .sort((a, b) => b.totalSold - a.totalSold)
            .slice(0, 5)
            .map((p) => ({
                id: p.id,
                name: p.name,
                slug: p.slug,
                originalPrice: p.idPrice,
                discountedPrice: Math.round(p.idPrice * (1 - promotion.discount)),
                totalSold: p.totalSold,
                avgRating: p.avgRating,
            }));

        return {
            data: {
                promotion: {
                    id: promotion.id,
                    name: promotion.name,
                    discount: promotion.discount,
                    discountPercentage: `${(promotion.discount * 100).toFixed(0)}%`,
                    startDate: promotion.startDate,
                    endDate: promotion.endDate,
                    isActive: promotion.isActive,
                    isExpired: new Date() > new Date(promotion.endDate),
                },
                statistics: {
                    totalProducts,
                    activeProducts,
                    inactiveProducts: totalProducts - activeProducts,
                    totalSold,
                    totalViews,
                    potentialSavings,
                    avgProductRating:
                        promotion.products.reduce((sum, p) => sum + (p.avgRating || 0), 0) /
                        totalProducts || 0,
                },
                topProducts,
            },
        };
    }
}