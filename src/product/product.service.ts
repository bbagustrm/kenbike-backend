import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
    Inject,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { SupabaseService } from '../common/supabase/supabase.service';
import { PaginationUtil } from '../utils/pagination.util';
import { GetProductsDto } from './dto/get-products.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductService {
    constructor(
        private prisma: PrismaService,
        private supabaseService: SupabaseService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    /**
     * GET ALL PRODUCTS (Public & Admin)
     */
    async getAllProducts(dto: GetProductsDto, isAdmin: boolean = false) {
        const {
            page,
            limit,
            search,
            categoryId,
            categorySlug,
            tagId,
            tagSlug,
            minPrice,
            maxPrice,
            isFeatured,
            isPreOrder,
            sortBy,
            order,
            includeDeleted,
            isActive,
        } = dto;

        // Validate pagination
        const { page: validPage, limit: validLimit } = PaginationUtil.validateParams(page, limit);

        // Build where clause
        const where: Prisma.ProductWhereInput = {};

        // Soft delete filter
        if (!isAdmin || !includeDeleted) {
            where.deletedAt = null;
        }

        // Active filter
        if (isActive !== undefined) {
            where.isActive = isActive;
        } else if (!isAdmin) {
            where.isActive = true; // Public only sees active products
        }

        // Search filter
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { idDescription: { contains: search, mode: 'insensitive' } },
                { enDescription: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Category filter
        if (categoryId) {
            where.categoryId = categoryId;
        } else if (categorySlug) {
            where.category = { slug: categorySlug };
        }

        // Tag filter
        if (tagId || tagSlug) {
            where.tags = {
                some: tagId
                    ? { tagId }
                    : { tag: { slug: tagSlug } },
            };
        }

        // Price range filter
        if (minPrice !== undefined || maxPrice !== undefined) {
            where.idPrice = {};
            if (minPrice !== undefined) where.idPrice.gte = minPrice;
            if (maxPrice !== undefined) where.idPrice.lte = maxPrice;
        }

        // Featured filter
        if (isFeatured !== undefined) {
            where.isFeatured = isFeatured;
        }

        // Pre-order filter
        if (isPreOrder !== undefined) {
            where.isPreOrder = isPreOrder;
        }

        // Get total count
        const total = await this.prisma.product.count({ where });

        // Get products
        const products = await this.prisma.product.findMany({
            where,
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
                promotion: {
                    select: {
                        id: true,
                        name: true,
                        discount: true,
                        startDate: true,
                        endDate: true,
                    },
                },
                tags: {
                    include: {
                        tag: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                            },
                        },
                    },
                },
                variants: {
                    where: { deletedAt: null, isActive: true },
                    select: {
                        id: true,
                        variantName: true,
                        sku: true,
                        stock: true,
                        isActive: true,
                    },
                    take: 5, // Limit variants in list view
                },
            },
            skip: PaginationUtil.getSkip(validPage, validLimit),
            take: validLimit,
            orderBy: {
                [sortBy === 'createdAt' ? 'createdAt' : sortBy]: order,
            },
        });

        // Transform response
        const data = products.map((product) => ({
            id: product.id,
            name: product.name,
            slug: product.slug,
            idDescription: product.idDescription,
            enDescription: product.enDescription,
            idPrice: product.idPrice,
            enPrice: product.enPrice,
            imageUrl: product.imageUrl,
            totalSold: product.totalSold,
            totalView: product.totalView,
            avgRating: product.avgRating,
            isFeatured: product.isFeatured,
            isPreOrder: product.isPreOrder,
            ...(isAdmin && { isActive: product.isActive }),
            ...(isAdmin && { deletedAt: product.deletedAt }),
            category: product.category,
            promotion: product.promotion,
            tags: product.tags.map((pt) => pt.tag),
            variants: product.variants,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
        }));

        return {
            meta: PaginationUtil.generateMeta(total, validPage, validLimit),
            data,
        };
    }

    /**
     * GET PRODUCT BY SLUG (Public)
     */
    async getProductBySlug(slug: string) {
        const product = await this.prisma.product.findUnique({
            where: { slug, deletedAt: null, isActive: true },
            include: {
                category: true,
                promotion: true,
                tags: {
                    include: {
                        tag: true,
                    },
                },
                variants: {
                    where: { deletedAt: null, isActive: true },
                    include: {
                        images: true,
                    },
                },
                reviews: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                firstName: true,
                                lastName: true,
                                profileImage: true,
                            },
                        },
                        images: true,
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                    take: 10, // Latest 10 reviews
                },
            },
        });

        if (!product) {
            throw new NotFoundException('Product not found');
        }

        // Increment view count (async, don't wait)
        this.incrementViewCount(product.id).catch((error) => {
            this.logger.error('Failed to increment view count', error);
        });

        return {
            data: {
                ...product,
                tags: product.tags.map((pt) => pt.tag),
                variants: product.variants.map((variant) => ({
                    id: variant.id,
                    variantName: variant.variantName,
                    sku: variant.sku,
                    stock: variant.stock,
                    isActive: variant.isActive,
                    images: variant.images,
                    createdAt: variant.createdAt,
                    updatedAt: variant.updatedAt,
                })),
            },
        };
    }

    /**
     * GET PRODUCT BY ID (Admin)
     */
    async getProductById(id: string) {
        const product = await this.prisma.product.findUnique({
            where: { id },
            include: {
                category: true,
                promotion: true,
                tags: {
                    include: {
                        tag: true,
                    },
                },
                variants: {
                    include: {
                        images: true,
                    },
                },
                reviews: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                firstName: true,
                                lastName: true,
                            },
                        },
                        images: true,
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                    take: 10,
                },
            },
        });

        if (!product) {
            throw new NotFoundException('Product not found');
        }

        return {
            data: {
                ...product,
                tags: product.tags.map((pt) => pt.tag),
            },
        };
    }

    /**
     * CREATE PRODUCT (Admin)
     */
    async createProduct(dto: CreateProductDto, mainImageFile?: Express.Multer.File) {
        // Check if slug already exists
        const existingProduct = await this.prisma.product.findUnique({
            where: { slug: dto.slug },
        });

        if (existingProduct) {
            throw new ConflictException('Product with this slug already exists');
        }

        // Check if category exists
        if (dto.categoryId) {
            const category = await this.prisma.category.findUnique({
                where: { id: dto.categoryId, deletedAt: null },
            });

            if (!category) {
                throw new BadRequestException('Category not found');
            }
        }

        // Check if promotion exists
        if (dto.promotionId) {
            const promotion = await this.prisma.promotion.findUnique({
                where: { id: dto.promotionId, deletedAt: null },
            });

            if (!promotion) {
                throw new BadRequestException('Promotion not found');
            }
        }

        // Check if tags exist
        if (dto.tagIds && dto.tagIds.length > 0) {
            const tags = await this.prisma.tag.findMany({
                where: { id: { in: dto.tagIds }, deletedAt: null },
            });

            if (tags.length !== dto.tagIds.length) {
                throw new BadRequestException('One or more tags not found');
            }
        }

        // Check if variant SKUs are unique
        if (dto.variants && dto.variants.length > 0) {
            const skus = dto.variants.map((v) => v.sku);
            const existingVariants = await this.prisma.productVariant.findMany({
                where: { sku: { in: skus } },
            });

            if (existingVariants.length > 0) {
                const duplicateSKUs = existingVariants.map((v) => v.sku);
                throw new ConflictException(
                    `SKU already exists: ${duplicateSKUs.join(', ')}`,
                );
            }
        }

        // Upload main image if provided
        let imageUrl = dto.imageUrl;
        if (mainImageFile) {
            const uploadResult = await this.supabaseService.uploadImage(
                mainImageFile,
                'products',
            );
            imageUrl = uploadResult.url;
        }

        // Create product with variants and tags in transaction
        const product = await this.prisma.$transaction(async (tx) => {
            // Create product
            const newProduct = await tx.product.create({
                data: {
                    name: dto.name,
                    slug: dto.slug,
                    idDescription: dto.idDescription,
                    enDescription: dto.enDescription,
                    idPrice: dto.idPrice,
                    enPrice: dto.enPrice,
                    imageUrl,
                    weight: dto.weight,
                    height: dto.height,
                    length: dto.length,
                    width: dto.width,
                    taxRate: dto.taxRate,
                    categoryId: dto.categoryId,
                    promotionId: dto.promotionId,
                    isFeatured: dto.isFeatured,
                    isPreOrder: dto.isPreOrder,
                    preOrderDays: dto.preOrderDays,
                },
            });

            // Create variants if provided
            if (dto.variants && dto.variants.length > 0) {
                for (const variant of dto.variants) {
                    const newVariant = await tx.productVariant.create({
                        data: {
                            productId: newProduct.id,
                            variantName: variant.variantName,
                            sku: variant.sku,
                            stock: variant.stock,
                            isActive: variant.isActive,
                        },
                    });

                    // Create variant images if provided
                    if (variant.imageUrls && variant.imageUrls.length > 0) {
                        await tx.productVariantImage.createMany({
                            data: variant.imageUrls.map((url) => ({
                                variantId: newVariant.id,
                                imageUrl: url,
                            })),
                        });
                    }
                }
            }

            // Create tags if provided
            if (dto.tagIds && dto.tagIds.length > 0) {
                await tx.productTag.createMany({
                    data: dto.tagIds.map((tagId) => ({
                        productId: newProduct.id,
                        tagId,
                    })),
                });
            }

            return newProduct;
        });

        this.logger.info(`✅ Product created: ${product.name} (${product.id})`);

        // Fetch complete product data
        return this.getProductById(product.id);
    }

    /**
     * INCREMENT VIEW COUNT (Background task)
     */
    private async incrementViewCount(productId: string): Promise<void> {
        await this.prisma.product.update({
            where: { id: productId },
            data: {
                totalView: {
                    increment: 1,
                },
            },
        });
    }

    /**
     * GET FEATURED PRODUCTS
     */
    async getFeaturedProducts(limit: number = 10) {
        const products = await this.prisma.product.findMany({
            where: {
                isFeatured: true,
                isActive: true,
                deletedAt: null,
            },
            select: {
                id: true,
                name: true,
                slug: true,
                idPrice: true,
                enPrice: true,
                imageUrl: true,
                avgRating: true,
                totalSold: true,
            },
            take: limit,
            orderBy: {
                totalView: 'desc',
            },
        });

        return { data: products };
    }

    /**
     * GET BEST SELLERS
     */
    async getBestSellers(limit: number = 10, categorySlug?: string) {
        const where: Prisma.ProductWhereInput = {
            isActive: true,
            deletedAt: null,
        };

        if (categorySlug) {
            where.category = { slug: categorySlug };
        }

        const products = await this.prisma.product.findMany({
            where,
            select: {
                id: true,
                name: true,
                slug: true,
                idPrice: true,
                enPrice: true,
                imageUrl: true,
                totalSold: true,
                avgRating: true,
            },
            take: limit,
            orderBy: {
                totalSold: 'desc',
            },
        });

        return { data: products };
    }

    /**
     * GET TRENDING PRODUCTS
     */
    async getTrendingProducts(limit: number = 10, days: number = 7) {
        // Calculate date range
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const products = await this.prisma.product.findMany({
            where: {
                isActive: true,
                deletedAt: null,
                updatedAt: {
                    gte: startDate,
                },
            },
            select: {
                id: true,
                name: true,
                slug: true,
                idPrice: true,
                enPrice: true,
                imageUrl: true,
                totalView: true,
                avgRating: true,
            },
            take: limit,
            orderBy: [
                { totalView: 'desc' },
                { avgRating: 'desc' },
            ],
        });

        // Calculate trending score (simple algorithm)
        const data = products.map((product) => ({
            ...product,
            trendingScore: (product.totalView / 100) + (product.avgRating || 0) * 2,
        }));

        // Sort by trending score
        data.sort((a, b) => b.trendingScore - a.trendingScore);

        return { data };
    }
}