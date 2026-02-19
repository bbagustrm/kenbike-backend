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
import { GetTagsDto } from './dto/get-tags.dto';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Prisma } from '@prisma/client';
import { ProductService } from '../product/product.service';
import { RedisService } from '../common/redis/redis.service';
import { createHash } from 'crypto';

@Injectable()
export class TagService implements OnModuleInit {
    constructor(
        private prisma: PrismaService,
        private productService: ProductService,
        private redisService: RedisService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    // ==========================================
    // CACHE WARMING ON STARTUP
    // ==========================================

    async onModuleInit() {
        if (!this.redisService.isCacheEnabled()) return;

        try {
            this.logger.info('🔥 Warming tag cache...');

            const defaultDto: GetTagsDto = {
                page: 1,
                limit: 20,
                sortBy: 'name',
                order: 'asc',
                includeDeleted: false,
                isActive: undefined,
            };
            await this.getAllTags(defaultDto, false);

            this.logger.info('✅ Tag cache warmed successfully');
        } catch (error) {
            this.logger.warn('⚠️  Tag cache warming failed (non-critical)', { error });
        }
    }

    // ==========================================
    // CACHE HELPERS
    // ==========================================

    private hashParams(params: any): string {
        return createHash('md5').update(JSON.stringify(params)).digest('hex');
    }

    private buildTagListKey(dto: GetTagsDto): string {
        return `tags:list:${this.hashParams(dto)}`;
    }

    /**
     * Invalidate all tag-related caches
     * Tags don't affect product list cache (products embed tag data but
     * tag mutations are rare — still invalidate products:list for consistency)
     */
    async invalidateTagCaches(): Promise<void> {
        await this.redisService.delByPattern('tags:list:*');
    }

    // ==========================================
    // READ METHODS (WITH CACHING)
    // ==========================================

    /**
     * GET ALL TAGS (Public & Admin)
     * Caching: Public calls only (isAdmin = false)
     */
    async getAllTags(dto: GetTagsDto, isAdmin: boolean = false) {
        if (!isAdmin) {
            const cacheKey = this.buildTagListKey(dto);
            const cached = await this.redisService.get<any>(cacheKey);
            if (cached) return cached;

            const result = await this._fetchAllTags(dto, false);
            const ttl = this.redisService.getTTL('tags');
            await this.redisService.set(cacheKey, result, ttl);
            return result;
        }

        return this._fetchAllTags(dto, true);
    }

    /**
     * Internal: actual DB query for getAllTags
     */
    private async _fetchAllTags(dto: GetTagsDto, isAdmin: boolean) {
        const { page, limit, search, isActive, sortBy, order, includeDeleted } = dto;

        const { page: validPage, limit: validLimit } = PaginationUtil.validateParams(page, limit);

        const where: Prisma.TagWhereInput = {};

        if (!isAdmin || !includeDeleted) {
            where.deletedAt = null;
        }

        if (!isAdmin) {
            where.isActive = true;
        } else if (isActive !== undefined) {
            where.isActive = isActive;
        }

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { slug: { contains: search, mode: 'insensitive' } },
            ];
        }

        const total = await this.prisma.tag.count({ where });

        let orderBy: any = {};
        if (sortBy === 'productCount') {
            orderBy = { createdAt: order };
        } else {
            orderBy = { [sortBy]: order };
        }

        const tags = await this.prisma.tag.findMany({
            where,
            include: {
                _count: {
                    select: {
                        products: {
                            where: {
                                product: {
                                    deletedAt: null,
                                    ...(isAdmin ? {} : { isActive: true }),
                                },
                            },
                        },
                    },
                },
            },
            skip: PaginationUtil.getSkip(validPage, validLimit),
            take: validLimit,
            orderBy,
        });

        let sortedTags = tags;
        if (sortBy === 'productCount') {
            sortedTags = tags.sort((a, b) => {
                const diff = a._count.products - b._count.products;
                return order === 'asc' ? diff : -diff;
            });
        }

        const data = sortedTags.map((tag) => ({
            id: tag.id,
            name: tag.name,
            slug: tag.slug,
            isActive: tag.isActive,
            productCount: tag._count.products,
            ...(isAdmin && { deletedAt: tag.deletedAt }),
            createdAt: tag.createdAt,
            updatedAt: tag.updatedAt,
        }));

        return {
            meta: PaginationUtil.generateMeta(total, validPage, validLimit),
            data,
        };
    }

    /**
     * GET TAG BY SLUG (Public)
     */
    async getTagBySlug(slug: string) {
        const tag = await this.prisma.tag.findUnique({
            where: { slug, deletedAt: null, isActive: true },
            include: {
                _count: {
                    select: {
                        products: {
                            where: {
                                product: {
                                    deletedAt: null,
                                    isActive: true,
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!tag) {
            throw new NotFoundException('Tag not found');
        }

        return {
            data: {
                id: tag.id,
                name: tag.name,
                slug: tag.slug,
                isActive: tag.isActive,
                productCount: tag._count.products,
                createdAt: tag.createdAt,
                updatedAt: tag.updatedAt,
            },
        };
    }

    /**
     * GET TAG BY ID (Admin)
     */
    async getTagById(id: string) {
        const tag = await this.prisma.tag.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        products: {
                            where: {
                                product: {
                                    deletedAt: null,
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!tag) {
            throw new NotFoundException('Tag not found');
        }

        return {
            data: {
                id: tag.id,
                name: tag.name,
                slug: tag.slug,
                isActive: tag.isActive,
                productCount: tag._count.products,
                deletedAt: tag.deletedAt,
                createdAt: tag.createdAt,
                updatedAt: tag.updatedAt,
            },
        };
    }

    // ==========================================
    // WRITE METHODS (WITH CACHE INVALIDATION)
    // ==========================================

    /**
     * CREATE TAG (Admin)
     * Invalidates: tags:list:*
     */
    async createTag(dto: CreateTagDto) {
        const existingTag = await this.prisma.tag.findUnique({
            where: { slug: dto.slug },
        });

        if (existingTag) {
            throw new ConflictException('Tag with this slug already exists');
        }

        const existingName = await this.prisma.tag.findFirst({
            where: {
                name: {
                    equals: dto.name,
                    mode: 'insensitive',
                },
            },
        });

        if (existingName) {
            throw new ConflictException('Tag with this name already exists');
        }

        const tag = await this.prisma.tag.create({
            data: {
                name: dto.name,
                slug: dto.slug,
            },
        });

        this.logger.info(`✅ Tag created: ${tag.name} (${tag.id})`);

        // Invalidate tag list caches
        await this.invalidateTagCaches();

        return {
            data: {
                id: tag.id,
                name: tag.name,
                slug: tag.slug,
                isActive: tag.isActive,
                createdAt: tag.createdAt,
                updatedAt: tag.updatedAt,
            },
        };
    }

    /**
     * UPDATE TAG (Admin)
     * Invalidates: tags:list:*
     */
    async updateTag(id: string, dto: UpdateTagDto) {
        const existingTag = await this.prisma.tag.findUnique({
            where: { id },
        });

        if (!existingTag) {
            throw new NotFoundException('Tag not found');
        }

        if (dto.slug && dto.slug !== existingTag.slug) {
            const slugExists = await this.prisma.tag.findUnique({
                where: { slug: dto.slug },
            });

            if (slugExists) {
                throw new ConflictException('Tag with this slug already exists');
            }
        }

        if (dto.name && dto.name !== existingTag.name) {
            const nameExists = await this.prisma.tag.findFirst({
                where: {
                    name: {
                        equals: dto.name,
                        mode: 'insensitive',
                    },
                    id: { not: id },
                },
            });

            if (nameExists) {
                throw new ConflictException('Tag with this name already exists');
            }
        }

        const tag = await this.prisma.tag.update({
            where: { id },
            data: {
                ...(dto.name && { name: dto.name }),
                ...(dto.slug && { slug: dto.slug }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            },
        });

        this.logger.info(`✅ Tag updated: ${tag.name} (${tag.id})`);

        // Invalidate tag list caches
        await this.invalidateTagCaches();

        return this.getTagById(tag.id);
    }

    /**
     * DELETE TAG (Admin) - Soft Delete
     * Invalidates: tags:list:*
     */
    async deleteTag(id: string) {
        const tag = await this.prisma.tag.findUnique({
            where: { id },
        });

        if (!tag) {
            throw new NotFoundException('Tag not found');
        }

        if (tag.deletedAt) {
            throw new BadRequestException('Tag already deleted');
        }

        await this.prisma.tag.update({
            where: { id },
            data: { deletedAt: new Date() },
        });

        this.logger.info(`🗑️ Tag soft deleted: ${tag.name} (${id})`);

        // Invalidate caches
        await this.invalidateTagCaches();

        return {
            message: 'Tag deleted successfully',
            data: { id, deletedAt: new Date() },
        };
    }

    /**
     * RESTORE TAG (Admin)
     * Invalidates: tags:list:*
     */
    async restoreTag(id: string) {
        const tag = await this.prisma.tag.findUnique({
            where: { id },
        });

        if (!tag) {
            throw new NotFoundException('Tag not found');
        }

        if (!tag.deletedAt) {
            throw new BadRequestException('Tag is not deleted');
        }

        await this.prisma.tag.update({
            where: { id },
            data: { deletedAt: null },
        });

        this.logger.info(`♻️ Tag restored: ${tag.name} (${id})`);

        // Invalidate caches
        await this.invalidateTagCaches();

        return this.getTagById(id);
    }

    /**
     * HARD DELETE TAG (Admin) - Permanent Delete
     * Invalidates: tags:list:*
     */
    async hardDeleteTag(id: string) {
        const tag = await this.prisma.tag.findUnique({
            where: { id },
        });

        if (!tag) {
            throw new NotFoundException('Tag not found');
        }

        await this.prisma.tag.delete({
            where: { id },
        });

        this.logger.info(`💀 Tag permanently deleted: ${tag.name} (${id})`);

        // Invalidate caches
        await this.invalidateTagCaches();

        return {
            message: 'Tag permanently deleted',
            data: { id },
        };
    }

    /**
     * TOGGLE TAG ACTIVE STATUS (Admin)
     * Invalidates: tags:list:*
     */
    async toggleTagActive(id: string) {
        const tag = await this.prisma.tag.findUnique({
            where: { id },
        });

        if (!tag) {
            throw new NotFoundException('Tag not found');
        }

        const updated = await this.prisma.tag.update({
            where: { id },
            data: {
                isActive: !tag.isActive,
            },
        });

        this.logger.info(`🔄 Tag active status toggled: ${tag.name} (${updated.isActive})`);

        // Invalidate caches
        await this.invalidateTagCaches();

        return {
            message: 'Tag status updated',
            data: {
                id: updated.id,
                isActive: updated.isActive,
            },
        };
    }

    // ==========================================
    // OTHER METHODS (NO CACHING NEEDED)
    // ==========================================

    /**
     * GET PRODUCTS BY TAG (Public)
     */
    async getProductsByTag(slug: string, queryParams: any) {
        const tag = await this.prisma.tag.findUnique({
            where: { slug, deletedAt: null, isActive: true },
        });

        if (!tag) {
            throw new NotFoundException('Tag not found');
        }

        const productsQuery = {
            ...queryParams,
            tagId: tag.id,
        };

        const productsResult = await this.productService.getAllProducts(productsQuery, false);

        return {
            data: {
                tag: {
                    id: tag.id,
                    name: tag.name,
                    slug: tag.slug,
                },
                products: productsResult,
            },
        };
    }

    /**
     * GET TAG STATISTICS (Admin)
     */
    async getTagStatistics(id: string) {
        const tag = await this.prisma.tag.findUnique({
            where: { id },
            include: {
                products: {
                    where: {
                        product: {
                            deletedAt: null,
                        },
                    },
                    include: {
                        product: {
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
                },
            },
        });

        if (!tag) {
            throw new NotFoundException('Tag not found');
        }

        const products = tag.products.map((pt) => pt.product);
        const totalProducts = products.length;
        const activeProducts = products.filter((p) => p.isActive).length;
        const inactiveProducts = totalProducts - activeProducts;

        const totalSold = products.reduce((sum, p) => sum + p.totalSold, 0);
        const totalViews = products.reduce((sum, p) => sum + p.totalView, 0);
        const avgRating =
            products.reduce((sum, p) => sum + (p.avgRating || 0), 0) / totalProducts || 0;

        const topProducts = products
            .sort((a, b) => b.totalSold - a.totalSold)
            .slice(0, 5)
            .map((p) => ({
                id: p.id,
                name: p.name,
                slug: p.slug,
                totalSold: p.totalSold,
                totalView: p.totalView,
                avgRating: p.avgRating,
            }));

        return {
            data: {
                tag: {
                    id: tag.id,
                    name: tag.name,
                    slug: tag.slug,
                    isActive: tag.isActive,
                },
                statistics: {
                    totalProducts,
                    activeProducts,
                    inactiveProducts,
                    totalSold,
                    totalViews,
                    avgRating: parseFloat(avgRating.toFixed(2)),
                },
                topProducts,
            },
        };
    }

    /**
     * GET POPULAR TAGS (Public)
     */
    async getPopularTags(limit: number = 10) {
        const tags = await this.prisma.tag.findMany({
            where: {
                isActive: true,
                deletedAt: null,
            },
            include: {
                _count: {
                    select: {
                        products: {
                            where: {
                                product: {
                                    deletedAt: null,
                                    isActive: true,
                                },
                            },
                        },
                    },
                },
            },
            take: limit * 2,
        });

        const sortedTags = tags
            .sort((a, b) => b._count.products - a._count.products)
            .slice(0, limit)
            .map((tag) => ({
                id: tag.id,
                name: tag.name,
                slug: tag.slug,
                productCount: tag._count.products,
            }));

        return {
            data: sortedTags,
        };
    }

    /**
     * BULK DELETE TAGS (Admin)
     * Invalidates: tags:list:*
     */
    async bulkDeleteTags(ids: string[]) {
        const tags = await this.prisma.tag.findMany({
            where: { id: { in: ids } },
        });

        if (tags.length === 0) {
            throw new NotFoundException('No tags found');
        }

        const result = await this.prisma.tag.updateMany({
            where: { id: { in: ids } },
            data: { deletedAt: new Date() },
        });

        this.logger.info(`🗑️ Bulk deleted ${result.count} tags`);

        // Invalidate caches
        await this.invalidateTagCaches();

        return {
            message: `${result.count} tags deleted successfully`,
            data: { count: result.count },
        };
    }

    /**
     * BULK RESTORE TAGS (Admin)
     * Invalidates: tags:list:*
     */
    async bulkRestoreTags(ids: string[]) {
        const tags = await this.prisma.tag.findMany({
            where: { id: { in: ids } },
        });

        if (tags.length === 0) {
            throw new NotFoundException('No tags found');
        }

        const result = await this.prisma.tag.updateMany({
            where: { id: { in: ids } },
            data: { deletedAt: null },
        });

        this.logger.info(`♻️ Bulk restored ${result.count} tags`);

        // Invalidate caches
        await this.invalidateTagCaches();

        return {
            message: `${result.count} tags restored successfully`,
            data: { count: result.count },
        };
    }
}