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
import { GetCategoriesDto } from './dto/get-categories.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Prisma } from '@prisma/client';
import { ProductService } from '../product/product.service';
import { RedisService } from '../common/redis/redis.service';
import { createHash } from 'crypto';

@Injectable()
export class CategoryService implements OnModuleInit {
    constructor(
        private prisma: PrismaService,
        private redisService: RedisService,
        private productService: ProductService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    // ==========================================
    // CACHE WARMING ON STARTUP
    // ==========================================

    async onModuleInit() {
        if (!this.redisService.isCacheEnabled()) return;

        try {
            this.logger.info('🔥 Warming category cache...');

            const defaultDto: GetCategoriesDto = {
                page: 1,
                limit: 20,
                sortBy: 'name',
                order: 'asc',
                includeDeleted: false,
                isActive: undefined,
            };
            await this.getAllCategories(defaultDto, false);

            this.logger.info('✅ Category cache warmed successfully');
        } catch (error) {
            this.logger.warn('⚠️  Category cache warming failed (non-critical)', { error });
        }
    }

    // ==========================================
    // CACHE HELPERS
    // ==========================================

    private hashParams(params: any): string {
        return createHash('md5').update(JSON.stringify(params)).digest('hex');
    }

    private buildCategoryListKey(dto: GetCategoriesDto): string {
        return `categories:list:${this.hashParams(dto)}`;
    }

    /**
     * Invalidate all category-related caches
     * Also invalidates product list caches (products include category data)
     */
    async invalidateCategoryCaches(): Promise<void> {
        await Promise.all([
            this.redisService.delByPattern('categories:list:*'),
            this.redisService.delByPattern('products:list:*'),
        ]);
    }

    // ==========================================
    // READ METHODS (WITH CACHING)
    // ==========================================

    /**
     * GET ALL CATEGORIES (Public & Admin)
     * Caching: Public calls only (isAdmin = false)
     */
    async getAllCategories(dto: GetCategoriesDto, isAdmin: boolean = false) {
        // Only cache public requests
        if (!isAdmin) {
            const cacheKey = this.buildCategoryListKey(dto);
            const cached = await this.redisService.get<any>(cacheKey);
            if (cached) return cached;

            const result = await this._fetchAllCategories(dto, false);
            const ttl = this.redisService.getTTL('categories');
            await this.redisService.set(cacheKey, result, ttl);
            return result;
        }

        // Admin: always fresh data
        return this._fetchAllCategories(dto, true);
    }

    /**
     * Internal: actual DB query for getAllCategories
     */
    private async _fetchAllCategories(dto: GetCategoriesDto, isAdmin: boolean) {
        const { page, limit, search, isActive, sortBy, order, includeDeleted } = dto;

        const { page: validPage, limit: validLimit } = PaginationUtil.validateParams(page, limit);

        const where: Prisma.CategoryWhereInput = {};

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

        const total = await this.prisma.category.count({ where });

        let orderBy: any = {};
        if (sortBy === 'productCount') {
            orderBy = { createdAt: order };
        } else {
            orderBy = { [sortBy]: order };
        }

        const categories = await this.prisma.category.findMany({
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

        let sortedCategories = categories;
        if (sortBy === 'productCount') {
            sortedCategories = categories.sort((a, b) => {
                const diff = a._count.products - b._count.products;
                return order === 'asc' ? diff : -diff;
            });
        }

        const data = sortedCategories.map((category) => ({
            id: category.id,
            name: category.name,
            slug: category.slug,
            isActive: category.isActive,
            productCount: category._count.products,
            ...(isAdmin && { deletedAt: category.deletedAt }),
            createdAt: category.createdAt,
            updatedAt: category.updatedAt,
        }));

        return {
            meta: PaginationUtil.generateMeta(total, validPage, validLimit),
            data,
        };
    }

    /**
     * GET CATEGORY BY SLUG (Public)
     * No individual caching needed (low frequency endpoint)
     */
    async getCategoryBySlug(slug: string) {
        const category = await this.prisma.category.findUnique({
            where: { slug, deletedAt: null, isActive: true },
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
        });

        if (!category) {
            throw new NotFoundException('Category not found');
        }

        return {
            data: {
                id: category.id,
                name: category.name,
                slug: category.slug,
                isActive: category.isActive,
                productCount: category._count.products,
                createdAt: category.createdAt,
                updatedAt: category.updatedAt,
            },
        };
    }

    /**
     * GET CATEGORY BY ID (Admin)
     * No caching - admin always needs fresh data
     */
    async getCategoryById(id: string) {
        const category = await this.prisma.category.findUnique({
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

        if (!category) {
            throw new NotFoundException('Category not found');
        }

        return {
            data: {
                id: category.id,
                name: category.name,
                slug: category.slug,
                isActive: category.isActive,
                productCount: category._count.products,
                deletedAt: category.deletedAt,
                createdAt: category.createdAt,
                updatedAt: category.updatedAt,
            },
        };
    }

    // ==========================================
    // WRITE METHODS (WITH CACHE INVALIDATION)
    // ==========================================

    /**
     * CREATE CATEGORY (Admin)
     * Invalidates: categories:list:*
     */
    async createCategory(dto: CreateCategoryDto) {
        const existingCategory = await this.prisma.category.findUnique({
            where: { slug: dto.slug },
        });

        if (existingCategory) {
            throw new ConflictException('Category with this slug already exists');
        }

        const existingName = await this.prisma.category.findFirst({
            where: {
                name: {
                    equals: dto.name,
                    mode: 'insensitive',
                },
            },
        });

        if (existingName) {
            throw new ConflictException('Category with this name already exists');
        }

        const category = await this.prisma.category.create({
            data: {
                name: dto.name,
                slug: dto.slug,
            },
        });

        this.logger.info(`✅ Category created: ${category.name} (${category.id})`);

        // Invalidate category list caches
        await this.invalidateCategoryCaches();

        return {
            data: {
                id: category.id,
                name: category.name,
                slug: category.slug,
                isActive: category.isActive,
                createdAt: category.createdAt,
                updatedAt: category.updatedAt,
            },
        };
    }

    /**
     * UPDATE CATEGORY (Admin)
     * Invalidates: categories:list:*, products:list:*
     */
    async updateCategory(id: string, dto: UpdateCategoryDto) {
        const existingCategory = await this.prisma.category.findUnique({
            where: { id },
        });

        if (!existingCategory) {
            throw new NotFoundException('Category not found');
        }

        if (dto.slug && dto.slug !== existingCategory.slug) {
            const slugExists = await this.prisma.category.findUnique({
                where: { slug: dto.slug },
            });

            if (slugExists) {
                throw new ConflictException('Category with this slug already exists');
            }
        }

        if (dto.name && dto.name !== existingCategory.name) {
            const nameExists = await this.prisma.category.findFirst({
                where: {
                    name: {
                        equals: dto.name,
                        mode: 'insensitive',
                    },
                    id: { not: id },
                },
            });

            if (nameExists) {
                throw new ConflictException('Category with this name already exists');
            }
        }

        const category = await this.prisma.category.update({
            where: { id },
            data: {
                ...(dto.name && { name: dto.name }),
                ...(dto.slug && { slug: dto.slug }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            },
        });

        this.logger.info(`✅ Category updated: ${category.name} (${category.id})`);

        // Invalidate caches (category name/slug may have changed in product data)
        await this.invalidateCategoryCaches();

        return this.getCategoryById(category.id);
    }

    /**
     * DELETE CATEGORY (Admin) - Soft Delete
     * Invalidates: categories:list:*
     */
    async deleteCategory(id: string) {
        const category = await this.prisma.category.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        products: {
                            where: { deletedAt: null },
                        },
                    },
                },
            },
        });

        if (!category) {
            throw new NotFoundException('Category not found');
        }

        if (category.deletedAt) {
            throw new BadRequestException('Category already deleted');
        }

        if (category._count.products > 0) {
            throw new BadRequestException(
                `Cannot delete category with ${category._count.products} active products. Please reassign or delete products first.`,
            );
        }

        await this.prisma.category.update({
            where: { id },
            data: { deletedAt: new Date() },
        });

        this.logger.info(`🗑️ Category soft deleted: ${category.name} (${id})`);

        // Invalidate caches
        await this.invalidateCategoryCaches();

        return {
            message: 'Category deleted successfully',
            data: { id, deletedAt: new Date() },
        };
    }

    /**
     * RESTORE CATEGORY (Admin)
     * Invalidates: categories:list:*
     */
    async restoreCategory(id: string) {
        const category = await this.prisma.category.findUnique({
            where: { id },
        });

        if (!category) {
            throw new NotFoundException('Category not found');
        }

        if (!category.deletedAt) {
            throw new BadRequestException('Category is not deleted');
        }

        await this.prisma.category.update({
            where: { id },
            data: { deletedAt: null },
        });

        this.logger.info(`♻️ Category restored: ${category.name} (${id})`);

        // Invalidate caches
        await this.invalidateCategoryCaches();

        return this.getCategoryById(id);
    }

    /**
     * HARD DELETE CATEGORY (Admin) - Permanent Delete
     * Invalidates: categories:list:*
     */
    async hardDeleteCategory(id: string) {
        const category = await this.prisma.category.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { products: true },
                },
            },
        });

        if (!category) {
            throw new NotFoundException('Category not found');
        }

        if (category._count.products > 0) {
            throw new BadRequestException(
                `Cannot permanently delete category with ${category._count.products} products. Please remove all products first.`,
            );
        }

        await this.prisma.category.delete({
            where: { id },
        });

        this.logger.info(`💀 Category permanently deleted: ${category.name} (${id})`);

        // Invalidate caches
        await this.invalidateCategoryCaches();

        return {
            message: 'Category permanently deleted',
            data: { id },
        };
    }

    /**
     * TOGGLE CATEGORY ACTIVE STATUS (Admin)
     * Invalidates: categories:list:*, products:list:*
     */
    async toggleCategoryActive(id: string) {
        const category = await this.prisma.category.findUnique({
            where: { id },
        });

        if (!category) {
            throw new NotFoundException('Category not found');
        }

        const updated = await this.prisma.category.update({
            where: { id },
            data: {
                isActive: !category.isActive,
            },
        });

        this.logger.info(
            `🔄 Category active status toggled: ${category.name} (${updated.isActive})`,
        );

        // Invalidate caches (visibility changed, affects product queries too)
        await this.invalidateCategoryCaches();

        return {
            message: 'Category status updated',
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
     * GET PRODUCTS BY CATEGORY (Public)
     */
    async getProductsByCategory(slug: string, queryParams: any) {
        const category = await this.prisma.category.findUnique({
            where: { slug, deletedAt: null, isActive: true },
        });

        if (!category) {
            throw new NotFoundException('Category not found');
        }

        const productQueryParams = {
            ...queryParams,
            categoryId: category.id,
        };

        const productsResult = await this.productService.getAllProducts(productQueryParams);

        return {
            data: {
                category: {
                    id: category.id,
                    name: category.name,
                    slug: category.slug,
                },
                products: productsResult.data,
                meta: productsResult.meta,
            },
        };
    }

    /**
     * GET CATEGORY STATISTICS (Admin)
     */
    async getCategoryStatistics(id: string) {
        const category = await this.prisma.category.findUnique({
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

        if (!category) {
            throw new NotFoundException('Category not found');
        }

        const totalProducts = category.products.length;
        const activeProducts = category.products.filter((p) => p.isActive).length;
        const inactiveProducts = totalProducts - activeProducts;

        const totalSold = category.products.reduce((sum, p) => sum + p.totalSold, 0);
        const totalViews = category.products.reduce((sum, p) => sum + p.totalView, 0);
        const avgRating =
            category.products.reduce((sum, p) => sum + (p.avgRating || 0), 0) / totalProducts || 0;

        const topProducts = category.products
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
                category: {
                    id: category.id,
                    name: category.name,
                    slug: category.slug,
                    isActive: category.isActive,
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
     * BULK DELETE CATEGORIES (Admin)
     * Invalidates: categories:list:*, products:list:*
     */
    async bulkDeleteCategories(ids: string[]) {
        const categories = await this.prisma.category.findMany({
            where: { id: { in: ids } },
            include: {
                _count: {
                    select: {
                        products: { where: { deletedAt: null } },
                    },
                },
            },
        });

        if (categories.length === 0) {
            throw new NotFoundException('No categories found');
        }

        const categoriesWithProducts = categories.filter((c) => c._count.products > 0);
        if (categoriesWithProducts.length > 0) {
            throw new BadRequestException(
                `Cannot delete ${categoriesWithProducts.length} categories with active products`,
            );
        }

        const result = await this.prisma.category.updateMany({
            where: { id: { in: ids } },
            data: { deletedAt: new Date() },
        });

        this.logger.info(`🗑️ Bulk deleted ${result.count} categories`);

        // Invalidate caches
        await this.invalidateCategoryCaches();

        return {
            message: `${result.count} categories deleted successfully`,
            data: { count: result.count },
        };
    }

    /**
     * BULK RESTORE CATEGORIES (Admin)
     * Invalidates: categories:list:*
     */
    async bulkRestoreCategories(ids: string[]) {
        const categories = await this.prisma.category.findMany({
            where: { id: { in: ids } },
        });

        if (categories.length === 0) {
            throw new NotFoundException('No categories found');
        }

        const result = await this.prisma.category.updateMany({
            where: { id: { in: ids } },
            data: { deletedAt: null },
        });

        this.logger.info(`♻️ Bulk restored ${result.count} categories`);

        // Invalidate caches
        await this.invalidateCategoryCaches();

        return {
            message: `${result.count} categories restored successfully`,
            data: { count: result.count },
        };
    }
}