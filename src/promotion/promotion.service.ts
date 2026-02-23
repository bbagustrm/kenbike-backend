import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
    Inject,
    OnModuleInit,
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
import { NotificationService } from '../notification/notification.service';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class PromotionService implements OnModuleInit {
    // Static cache key for active promotions (no params = static key)
    private static readonly ACTIVE_PROMOTIONS_KEY = 'promotions:active';

    constructor(
        private prisma: PrismaService,
        private notificationService: NotificationService,
        private redisService: RedisService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    // ==========================================
    // CACHE WARMING ON STARTUP
    // ==========================================

    async onModuleInit() {
        if (!this.redisService.isCacheEnabled()) return;

        try {
            this.logger.info('🔥 Warming promotion cache...');
            await this.getActivePromotions();
            this.logger.info('✅ Promotion cache warmed successfully');
        } catch (error) {
            this.logger.warn('⚠️  Promotion cache warming failed (non-critical)', { error });
        }
    }

    // ==========================================
    // CACHE HELPERS
    // ==========================================

    /**
     * Invalidate active promotions cache
     * Also invalidates product list cache (products embed promotion data)
     */
    private async invalidatePromotionCaches(): Promise<void> {
        await Promise.all([
            this.redisService.del(PromotionService.ACTIVE_PROMOTIONS_KEY),
            this.redisService.delByPattern('products:list:*'),
        ]);
    }

    // ==========================================
    // READ METHODS
    // ==========================================

    /**
     * GET ALL PROMOTIONS (Public & Admin)
     * No caching on list - complex filters, mostly admin use
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

        const { page: validPage, limit: validLimit } = PaginationUtil.validateParams(page, limit);

        const where: Prisma.PromotionWhereInput = {};

        if (!isAdmin || !includeDeleted) {
            where.deletedAt = null;
        }

        if (!isAdmin) {
            where.isActive = true;
        } else if (isActive !== undefined) {
            where.isActive = isActive;
        }

        if (!isAdmin) {
            where.AND = [
                { startDate: { lte: new Date() } },
                { endDate: { gte: new Date() } },
            ];
        }

        if (search) {
            where.name = { contains: search, mode: 'insensitive' };
        }

        const total = await this.prisma.promotion.count({ where });

        let orderBy: any = {};
        if (sortBy === 'productCount') {
            orderBy = { createdAt: order };
        } else {
            orderBy = { [sortBy]: order };
        }

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

        let sortedPromotions = promotions;
        if (sortBy === 'productCount') {
            sortedPromotions = promotions.sort((a, b) => {
                const diff = a._count.products - b._count.products;
                return order === 'asc' ? diff : -diff;
            });
        }

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
     * Caching: promotions:active (static key), TTL 300s
     */
    async getActivePromotions() {
        const cacheKey = PromotionService.ACTIVE_PROMOTIONS_KEY;
        const start = Date.now();

        const cached = await this.redisService.get<any>(cacheKey);
        if (cached) {
            this.logger.info(`✅ [CACHE HIT] GET /promotions/active — ${Date.now() - start}ms (no DB query)`);
            return cached;
        }

        this.logger.info(`❌ [CACHE MISS] GET /promotions/active — fetching from DB...`);
        const dbStart = Date.now();
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
                        products: { where: { deletedAt: null, isActive: true } },
                    },
                },
            },
            orderBy: { discount: 'desc' },
        });

        this.logger.info(`🗄️  [DB QUERY] GET /promotions/active — ${Date.now() - dbStart}ms`);

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

        const result = { data };
        const ttl = this.redisService.getTTL('promotions');
        await this.redisService.set(cacheKey, result, ttl);
        this.logger.info(`💾 [CACHE SET] GET /promotions/active (TTL: ${ttl}s)`);
        return result;
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
                            take: 1,
                        },
                        totalSold: true,
                        isActive: true,
                    },
                    take: 50,
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
                    imageUrl: product.images[0]?.imageUrl || null,
                    images: product.images,
                    discountedIdPrice: Math.round(product.idPrice * (1 - promotion.discount)),
                    discountedEnPrice: Math.round(product.enPrice * (1 - promotion.discount)),
                    savings: Math.round(product.idPrice * promotion.discount),
                })),
                createdAt: promotion.createdAt,
                updatedAt: promotion.updatedAt,
            },
        };
    }

    // ==========================================
    // WRITE METHODS (WITH CACHE INVALIDATION)
    // ==========================================

    /**
     * CREATE PROMOTION (Admin)
     * Invalidates: promotions:active
     */
    async createPromotion(dto: CreatePromotionDto, sendNotification: boolean = false) {
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

        if (sendNotification && dto.isActive) {
            const now = new Date();
            const startDate = new Date(dto.startDate);

            if (startDate <= now) {
                try {
                    await this.notificationService.notifyPromotionStart(
                        promotion.name,
                        promotion.discount,
                        promotion.id,
                        'id',
                    );
                    this.logger.info(`🔔 Promotion notification sent: ${promotion.name}`);
                } catch (error: any) {
                    this.logger.error('❌ Failed to send promotion notification', {
                        promotionId: promotion.id,
                        error: error.message,
                    });
                }
            }
        }

        // Invalidate promotion cache (new promotion may be active)
        await this.invalidatePromotionCaches();

        return this.getPromotionById(promotion.id, true);
    }

    /**
     * UPDATE PROMOTION (Admin)
     * Invalidates: promotions:active, products:list:*
     */
    async updatePromotion(id: string, dto: UpdatePromotionDto) {
        const existingPromotion = await this.prisma.promotion.findUnique({
            where: { id },
        });

        if (!existingPromotion) {
            throw new NotFoundException('Promotion not found');
        }

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

        const startDate = dto.startDate
            ? new Date(dto.startDate)
            : existingPromotion.startDate;
        const endDate = dto.endDate ? new Date(dto.endDate) : existingPromotion.endDate;

        if (endDate <= startDate) {
            throw new BadRequestException('End date must be after start date');
        }

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

        // Invalidate caches (discount/dates changed affect product prices in list)
        await this.invalidatePromotionCaches();

        return this.getPromotionById(promotion.id, true);
    }

    /**
     * DELETE PROMOTION (Admin) - Soft Delete
     * Invalidates: promotions:active, products:list:*
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

        // Invalidate caches
        await this.invalidatePromotionCaches();

        return {
            message: 'Promotion deleted successfully',
            data: { id, deletedAt: new Date() },
        };
    }

    /**
     * RESTORE PROMOTION (Admin)
     * Invalidates: promotions:active
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

        await this.prisma.promotion.update({
            where: { id },
            data: { deletedAt: null },
        });

        this.logger.info(`♻️ Promotion restored: ${promotion.name} (${id})`);

        // Invalidate caches
        await this.invalidatePromotionCaches();

        return this.getPromotionById(id, true);
    }

    /**
     * HARD DELETE PROMOTION (Admin)
     * Invalidates: promotions:active, products:list:*
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

        if (promotion._count.products > 0) {
            await this.prisma.product.updateMany({
                where: { promotionId: id },
                data: { promotionId: null },
            });
        }

        await this.prisma.promotion.delete({
            where: { id },
        });

        this.logger.info(`💀 Promotion permanently deleted: ${promotion.name} (${id})`);

        // Invalidate caches
        await this.invalidatePromotionCaches();

        return {
            message: 'Promotion permanently deleted',
            data: { id },
        };
    }

    /**
     * TOGGLE PROMOTION ACTIVE STATUS (Admin)
     * Invalidates: promotions:active, products:list:*
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

        // Invalidate caches
        await this.invalidatePromotionCaches();

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
     * Invalidates: promotions:active, products:list:*, product:{slug}
     */
    async assignProductToPromotion(promotionId: string, productId: string) {
        const promotion = await this.prisma.promotion.findUnique({
            where: { id: promotionId, deletedAt: null },
        });

        if (!promotion) {
            throw new NotFoundException('Promotion not found');
        }

        const product = await this.prisma.product.findUnique({
            where: { id: productId, deletedAt: null },
        });

        if (!product) {
            throw new NotFoundException('Product not found');
        }

        if (product.promotionId) {
            throw new ConflictException('Product already has an active promotion');
        }

        await this.prisma.product.update({
            where: { id: productId },
            data: { promotionId },
        });

        this.logger.info(
            `✅ Product ${product.name} assigned to promotion ${promotion.name}`,
        );

        // Invalidate promotion cache and the specific product's cache
        await Promise.all([
            this.invalidatePromotionCaches(),
            this.redisService.del(`product:${product.slug}`),
        ]);

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
     * Invalidates: promotions:active, products:list:*, product:{slug}
     */
    async removeProductFromPromotion(promotionId: string, productId: string) {
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
        });

        if (!product) {
            throw new NotFoundException('Product not found');
        }

        if (product.promotionId !== promotionId) {
            throw new BadRequestException('Product does not have this promotion');
        }

        await this.prisma.product.update({
            where: { id: productId },
            data: { promotionId: null },
        });

        this.logger.info(`✅ Product removed from promotion`);

        // Invalidate caches
        await Promise.all([
            this.invalidatePromotionCaches(),
            this.redisService.del(`product:${product.slug}`),
        ]);

        return {
            message: 'Product removed from promotion successfully',
        };
    }

    /**
     * BULK ASSIGN PRODUCTS TO PROMOTION (Admin)
     * Invalidates: promotions:active, products:list:*
     */
    async bulkAssignProducts(promotionId: string, productIds: string[]) {
        const promotion = await this.prisma.promotion.findUnique({
            where: { id: promotionId, deletedAt: null },
        });

        if (!promotion) {
            throw new NotFoundException('Promotion not found');
        }

        const products = await this.prisma.product.findMany({
            where: {
                id: { in: productIds },
                deletedAt: null,
            },
            select: {
                id: true,
                name: true,
                slug: true,
                promotionId: true,
            },
        });

        if (products.length !== productIds.length) {
            const foundIds = products.map((p) => p.id);
            const missingIds = productIds.filter((id) => !foundIds.includes(id));
            throw new NotFoundException(
                `Products not found: ${missingIds.join(', ')}`,
            );
        }

        const productsWithPromotion = products.filter((p) => p.promotionId !== null);

        if (productsWithPromotion.length > 0) {
            const productNames = productsWithPromotion.map((p) => p.name).join(', ');
            throw new ConflictException(
                `${productsWithPromotion.length} product(s) already have promotions: ${productNames}`,
            );
        }

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

        // Invalidate caches for all affected product slugs + promotion
        const invalidatePromises = [
            this.invalidatePromotionCaches(),
            ...products.map(p => this.redisService.del(`product:${p.slug}`)),
        ];
        await Promise.all(invalidatePromises);

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
     * Runs every hour - MUST invalidate cache after status changes
     */
    @Cron(CronExpression.EVERY_HOUR)
    async autoUpdatePromotionStatus() {
        const now = new Date();

        const promotionsToActivate = await this.prisma.promotion.findMany({
            where: {
                isActive: false,
                deletedAt: null,
                startDate: { lte: now },
                endDate: { gte: now },
            },
        });

        const toActivate = await this.prisma.promotion.updateMany({
            where: {
                isActive: false,
                deletedAt: null,
                startDate: { lte: now },
                endDate: { gte: now },
            },
            data: { isActive: true },
        });

        for (const promo of promotionsToActivate) {
            try {
                await this.notificationService.notifyPromotionStart(
                    promo.name,
                    promo.discount,
                    promo.id,
                    'id',
                );
                this.logger.info(`🔔 Promotion activation notification sent: ${promo.name}`);
            } catch (error: any) {
                this.logger.error('❌ Failed to send promotion activation notification', {
                    promotionId: promo.id,
                    error: error.message,
                });
            }
        }

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

            // ✅ Invalidate caches when promotion statuses change
            await this.invalidatePromotionCaches();
            this.logger.info('🗑️ Promotion & product list caches invalidated by cron job');
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

        const potentialSavings = promotion.products.reduce(
            (sum, p) => sum + p.idPrice * promotion.discount * p.totalSold,
            0,
        );

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