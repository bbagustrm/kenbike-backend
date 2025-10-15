import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
    Inject,
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

@Injectable()
export class CategoryService {
    constructor(
        private prisma: PrismaService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
        private productService: ProductService,
    ) {}

    /**
     * GET ALL CATEGORIES (Public & Admin)
     */
    async getAllCategories(dto: GetCategoriesDto, isAdmin: boolean = false) {
        const { page, limit, search, isActive, sortBy, order, includeDeleted } = dto;

        // Validate pagination
        const { page: validPage, limit: validLimit } = PaginationUtil.validateParams(page, limit);

        // Build where clause
        const where: Prisma.CategoryWhereInput = {};

        // Soft delete filter
        if (!isAdmin || !includeDeleted) {
            where.deletedAt = null;
        }

        // Active filter
        if (isActive !== undefined) {
            where.isActive = isActive;
        } else if (!isAdmin) {
            where.isActive = true; // Public only sees active categories
        }

        // Search filter
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { slug: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Get total count
        const total = await this.prisma.category.count({ where });

        // Prepare orderBy based on sortBy
        let orderBy: any = {};
        if (sortBy === 'productCount') {
            // We'll sort by product count after fetching
            orderBy = { createdAt: order };
        } else {
            orderBy = { [sortBy]: order };
        }

        // Get categories
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

        // Sort by product count if needed
        let sortedCategories = categories;
        if (sortBy === 'productCount') {
            sortedCategories = categories.sort((a, b) => {
                const diff = a._count.products - b._count.products;
                return order === 'asc' ? diff : -diff;
            });
        }

        // Transform response
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

    /**
     * CREATE CATEGORY (Admin)
     */
    async createCategory(dto: CreateCategoryDto) {
        // Check if slug already exists
        const existingCategory = await this.prisma.category.findUnique({
            where: { slug: dto.slug },
        });

        if (existingCategory) {
            throw new ConflictException('Category with this slug already exists');
        }

        // Check if name already exists
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

        // Create category
        const category = await this.prisma.category.create({
            data: {
                name: dto.name,
                slug: dto.slug,
            },
        });

        this.logger.info(`✅ Category created: ${category.name} (${category.id})`);

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
     */
    async updateCategory(id: string, dto: UpdateCategoryDto) {
        // Check if category exists
        const existingCategory = await this.prisma.category.findUnique({
            where: { id },
        });

        if (!existingCategory) {
            throw new NotFoundException('Category not found');
        }

        // Check if slug is being changed and already exists
        if (dto.slug && dto.slug !== existingCategory.slug) {
            const slugExists = await this.prisma.category.findUnique({
                where: { slug: dto.slug },
            });

            if (slugExists) {
                throw new ConflictException('Category with this slug already exists');
            }
        }

        // Check if name is being changed and already exists
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

        // Update category
        const category = await this.prisma.category.update({
            where: { id },
            data: {
                ...(dto.name && { name: dto.name }),
                ...(dto.slug && { slug: dto.slug }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            },
        });

        this.logger.info(`✅ Category updated: ${category.name} (${category.id})`);

        return this.getCategoryById(category.id);
    }

    /**
     * DELETE CATEGORY (Admin) - Soft Delete
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

        // Check if category has products
        if (category._count.products > 0) {
            throw new BadRequestException(
                `Cannot delete category with ${category._count.products} active products. Please reassign or delete products first.`,
            );
        }

        // Soft delete category
        await this.prisma.category.update({
            where: { id },
            data: { deletedAt: new Date() },
        });

        this.logger.info(`🗑️ Category soft deleted: ${category.name} (${id})`);

        return {
            message: 'Category deleted successfully',
            data: { id, deletedAt: new Date() },
        };
    }

    /**
     * RESTORE CATEGORY (Admin)
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

        // Restore category
        await this.prisma.category.update({
            where: { id },
            data: { deletedAt: null },
        });

        this.logger.info(`♻️ Category restored: ${category.name} (${id})`);

        return this.getCategoryById(id);
    }

    /**
     * HARD DELETE CATEGORY (Admin) - Permanent Delete
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

        // Check if category has any products (even deleted ones)
        if (category._count.products > 0) {
            throw new BadRequestException(
                `Cannot permanently delete category with ${category._count.products} products. Please remove all products first.`,
            );
        }

        // Hard delete from database
        await this.prisma.category.delete({
            where: { id },
        });

        this.logger.info(`💀 Category permanently deleted: ${category.name} (${id})`);

        return {
            message: 'Category permanently deleted',
            data: { id },
        };
    }

    /**
     * TOGGLE CATEGORY ACTIVE STATUS (Admin)
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

        return {
            message: 'Category status updated',
            data: {
                id: updated.id,
                isActive: updated.isActive,
            },
        };
    }

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

        // Calculate statistics
        const totalProducts = category.products.length;
        const activeProducts = category.products.filter((p) => p.isActive).length;
        const inactiveProducts = totalProducts - activeProducts;

        const totalSold = category.products.reduce((sum, p) => sum + p.totalSold, 0);
        const totalViews = category.products.reduce((sum, p) => sum + p.totalView, 0);
        const avgRating =
            category.products.reduce((sum, p) => sum + (p.avgRating || 0), 0) / totalProducts || 0;

        // Get top products
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
     */
    async bulkDeleteCategories(ids: string[]) {
        // Check all categories exist
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

        // Check if any category has products
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

        return {
            message: `${result.count} categories deleted successfully`,
            data: { count: result.count },
        };
    }

    /**
     * BULK RESTORE CATEGORIES (Admin)
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

        return {
            message: `${result.count} categories restored successfully`,
            data: { count: result.count },
        };
    }
}