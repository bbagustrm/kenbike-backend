import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
    Inject,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PaginationUtil } from '../utils/pagination.util';
import { GetProductsDto } from './dto/get-products.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Prisma } from '@prisma/client';
import { UpdateProductDto } from "./dto/update-product.dto";
import { LocalStorageService } from '../common/storage/local-storage.service';

@Injectable()
export class ProductService {
    constructor(
        private prisma: PrismaService,
        private localStorageService: LocalStorageService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    /**
     * GET ALL PRODUCTS (Public & Admin)
     * Updated to support hasPromotion filter
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
            hasPromotion,
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
        if (!isAdmin) {
            where.isActive = true; // Public only sees active products
        } else if (isActive !== undefined) {
            where.isActive = isActive; // Admin can optionally filter by isActive
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

        // Promotion filter (NEW)
        if (hasPromotion !== undefined) {
            if (hasPromotion) {
                // Only products with promotion
                where.promotionId = { not: null };
            } else {
                // Only products without promotion
                where.promotionId = null;
            }
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
                        isActive: true,
                    },
                },
                promotion: {
                    select: {
                        id: true,
                        name: true,
                        discount: true,
                        startDate: true,
                        endDate: true,
                        isActive: true,
                    },
                },
                tags: {
                    include: {
                        tag: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                                isActive: true,
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
                    take: 5,
                },
                images: {
                    orderBy: { order: 'asc' },
                    take: 5,
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

            imageUrl: product.images[0]?.imageUrl || null,
            images: product.images, // include all images

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
                    include: { tag: true },
                },
                variants: {
                    where: { deletedAt: null, isActive: true },
                    include: { images: true },
                },
                images: {
                    orderBy: { order: 'asc' },
                },
                gallery: true,
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
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
            },
        });

        if (!product) {
            throw new NotFoundException('Product not found');
        }

        // Increment view count
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
                images: {
                    orderBy: {
                        order: 'asc',
                    },
                },
                gallery: true,
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
        let imageUrls = dto.imageUrls;
        if (mainImageFile) {
            const uploadResult = await this.localStorageService.uploadImage(
                mainImageFile,
                'products',
            );
            if (!imageUrls.includes(uploadResult.url)) {
                imageUrls = [uploadResult.url, ...imageUrls];
            }
        }

        // Create product with images in transaction
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

            // ✅ TAMBAHKAN: Create product images
            if (imageUrls && imageUrls.length > 0) {
                await tx.productImage.createMany({
                    data: imageUrls.map((url, index) => ({
                        productId: newProduct.id,
                        imageUrl: url,
                        order: index, // 0 = primary image
                    })),
                });
            }

            // Create variants (existing code)
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

            // Create tags (existing code)
            if (dto.tagIds && dto.tagIds.length > 0) {
                await tx.productTag.createMany({
                    data: dto.tagIds.map((tagId) => ({
                        productId: newProduct.id,
                        tagId,
                    })),
                });
            }

            if (dto.galleryImages && dto.galleryImages.length > 0) {
                await tx.galleryImage.createMany({
                    data: dto.galleryImages.map((gallery) => ({
                        productId: newProduct.id,
                        imageUrl: gallery.imageUrl,
                        caption: gallery.caption,
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
                avgRating: true,
                totalSold: true,
                category: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        isActive: true,
                    },
                },
                promotion: {
                    select: {
                        id: true,
                        name: true,
                        discount: true,
                        startDate: true,
                        endDate: true,
                        isActive: true,
                    },
                },
                tags: {
                    include: {
                        tag: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                                isActive: true,
                            },
                        },
                    },
                },
                variants: {
                    where: {
                        deletedAt: null,
                        isActive: true
                    },
                    select: {
                        id: true,
                        variantName: true,
                        sku: true,
                        stock: true,
                        isActive: true,
                    },
                    take: 5,
                },
                images: {
                    orderBy: { order: 'asc' },
                    take: 5,
                },
            },
            take: limit,
            orderBy: {
                totalView: 'desc',
            },
        });

        const data = products.map((product) => ({
            ...product,
            imageUrl: product.images[0]?.imageUrl || null,
            tags: product.tags.map((pt) => pt.tag),
        }));

        return { data };
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
                totalSold: true,
                avgRating: true,
                category: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        isActive: true,
                    },
                },
                promotion: {
                    select: {
                        id: true,
                        name: true,
                        discount: true,
                        startDate: true,
                        endDate: true,
                        isActive: true,
                    },
                },
                tags: {
                    include: {
                        tag: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                                isActive: true,
                            },
                        },
                    },
                },
                variants: {
                    where: {
                        deletedAt: null,
                        isActive: true
                    },
                    select: {
                        id: true,
                        variantName: true,
                        sku: true,
                        stock: true,
                        isActive: true,
                    },
                    take: 5,
                },
                images: {
                    orderBy: { order: 'asc' },
                    take: 5,
                },
            },
            take: limit,
            orderBy: {
                totalSold: 'desc',
            },
        });

        const data = products.map((product) => ({
            ...product,
            imageUrl: product.images[0]?.imageUrl || null,
            tags: product.tags.map((pt) => pt.tag),
        }));

        return { data };
    }

    /**
     * GET TRENDING PRODUCTS
     */
    async getTrendingProducts(limit: number = 10, days: number = 7) {
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
                totalView: true,
                avgRating: true,
                category: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        isActive: true,
                    },
                },
                promotion: {
                    select: {
                        id: true,
                        name: true,
                        discount: true,
                        startDate: true,
                        endDate: true,
                        isActive: true,
                    },
                },
                tags: {
                    include: {
                        tag: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                                isActive: true,
                            },
                        },
                    },
                },
                variants: {
                    where: {
                        deletedAt: null,
                        isActive: true
                    },
                    select: {
                        id: true,
                        variantName: true,
                        sku: true,
                        stock: true,
                        isActive: true,
                    },
                    take: 5,
                },
                images: {
                    orderBy: { order: 'asc' },
                    take: 5,
                },
            },
            take: limit * 2,
            orderBy: [
                { totalView: 'desc' },
                { avgRating: 'desc' },
            ],
        });

        const productsWithFlatTags = products.map((product) => ({
            ...product,
            imageUrl: product.images[0]?.imageUrl || null,
            tags: product.tags.map((pt) => pt.tag),
        }));

        const dataWithScore = productsWithFlatTags.map((product) => ({
            ...product,
            trendingScore: (product.totalView / 100) + (product.avgRating || 0) * 2,
        }));

        dataWithScore.sort((a, b) => b.trendingScore - a.trendingScore);

        const finalData = dataWithScore.slice(0, limit);

        return { data: finalData };
    }


    async updateProduct(
        id: string,
        dto: UpdateProductDto,
        mainImageFile?: Express.Multer.File,
    ) {
        // Check if product exists
        const existingProduct = await this.prisma.product.findUnique({
            where: { id },
            include: {
                variants: true,
                tags: true,
                images: true,
                gallery: true,
            },
        });

        if (!existingProduct) {
            throw new NotFoundException('Product not found');
        }

        if (dto.variants && dto.variants.length > 0) {
            const incomingSkus = dto.variants
                .filter(v => v.sku && v._action !== 'delete')
                .map(v => v.sku!);

            const uniqueSkus = new Set(incomingSkus);

            if (incomingSkus.length !== uniqueSkus.size) {
                const duplicates = incomingSkus.filter((item, index) => incomingSkus.indexOf(item) !== index);
                throw new ConflictException(
                    `Duplicate SKUs found in the request: ${[...new Set(duplicates)].join(', ')}`,
                );
            }
        }

        // Check if slug is being changed and already exists
        if (dto.slug && dto.slug !== existingProduct.slug) {
            const slugExists = await this.prisma.product.findUnique({
                where: { slug: dto.slug },
            });

            if (slugExists) {
                throw new ConflictException('Product with this slug already exists');
            }
        }

        // Check if category exists
        if (dto.categoryId !== undefined) {
            if (dto.categoryId === null) {
                // Allow removing category
            } else {
                const category = await this.prisma.category.findUnique({
                    where: { id: dto.categoryId, deletedAt: null },
                });

                if (!category) {
                    throw new BadRequestException('Category not found');
                }
            }
        }

        // Check if promotion exists
        if (dto.promotionId !== undefined) {
            if (dto.promotionId === null) {
                // Allow removing promotion
            } else {
                const promotion = await this.prisma.promotion.findUnique({
                    where: { id: dto.promotionId, deletedAt: null },
                });

                if (!promotion) {
                    throw new BadRequestException('Promotion not found');
                }
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

        // Check variant SKUs uniqueness against other products
        if (dto.variants && dto.variants.length > 0) {
            const skusToCheck = dto.variants
                .filter((v) => v.sku && v._action !== 'delete')
                .map((v) => v.sku!);

            if (skusToCheck.length > 0) {
                const existingVariants = await this.prisma.productVariant.findMany({
                    where: {
                        sku: { in: skusToCheck },
                        productId: { not: id }, // Exclude current product's variants
                    },
                });

                if (existingVariants.length > 0) {
                    const duplicateSKUs = existingVariants.map((v) => v.sku);
                    throw new ConflictException(
                        `SKU already exists in another product: ${duplicateSKUs.join(', ')}`,
                    );
                }
            }
        }


        let imageUrls = dto.imageUrls;
        if (mainImageFile) {
            const uploadResult = await this.localStorageService.uploadImage(
                mainImageFile,
                'products',
            );
            // Prepend new image ke array
            if (imageUrls) {
                imageUrls = [uploadResult.url, ...imageUrls];
            } else {
                imageUrls = [uploadResult.url];
            }
        }

        // Update product in transaction
        const product = await this.prisma.$transaction(async (tx) => {
            // Update product
            const updatedProduct = await tx.product.update({
                where: { id },
                data: {
                    ...(dto.name && { name: dto.name }),
                    ...(dto.slug && { slug: dto.slug }),
                    ...(dto.idDescription !== undefined && { idDescription: dto.idDescription }),
                    ...(dto.enDescription !== undefined && { enDescription: dto.enDescription }),
                    ...(dto.idPrice !== undefined && { idPrice: dto.idPrice }),
                    ...(dto.enPrice !== undefined && { enPrice: dto.enPrice }),
                    // imageUrl DIHAPUS
                    ...(dto.weight !== undefined && { weight: dto.weight }),
                    ...(dto.height !== undefined && { height: dto.height }),
                    ...(dto.length !== undefined && { length: dto.length }),
                    ...(dto.width !== undefined && { width: dto.width }),
                    ...(dto.taxRate !== undefined && { taxRate: dto.taxRate }),
                    ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
                    ...(dto.promotionId !== undefined && { promotionId: dto.promotionId }),
                    ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
                    ...(dto.isActive !== undefined && { isActive: dto.isActive }),
                    ...(dto.isPreOrder !== undefined && { isPreOrder: dto.isPreOrder }),
                    ...(dto.preOrderDays !== undefined && { preOrderDays: dto.preOrderDays }),
                },
            });

            // ✅ TAMBAHKAN: Handle product images update
            if (imageUrls !== undefined) {
                // Delete old images from storage
                const oldImages = existingProduct.images;
                for (const oldImage of oldImages) {
                    await this.localStorageService
                        .deleteImage(oldImage.imageUrl)
                        .catch(() => {
                            this.logger.warn('Failed to delete old product image');
                        });
                }

                // Delete old images from database
                await tx.productImage.deleteMany({
                    where: { productId: id },
                });

                // Create new images
                if (imageUrls.length > 0) {
                    await tx.productImage.createMany({
                        data: imageUrls.map((url, index) => ({
                            productId: id,
                            imageUrl: url,
                            order: index,
                        })),
                    });
                }
            }

            // Handle variants (existing code with modifications)
            if (dto.variants && dto.variants.length > 0) {
                for (const variant of dto.variants) {
                    if (variant.id) {
                        if (variant._action === 'delete') {
                            await tx.productVariant.update({
                                where: { id: variant.id },
                                data: { deletedAt: new Date() },
                            });
                        } else {
                            await tx.productVariant.update({
                                where: { id: variant.id },
                                data: {
                                    ...(variant.variantName && { variantName: variant.variantName }),
                                    ...(variant.sku && { sku: variant.sku }),
                                    ...(variant.stock !== undefined && { stock: variant.stock }),
                                    ...(variant.isActive !== undefined && { isActive: variant.isActive }),
                                },
                            });

                            if (variant.imageUrls && variant.imageUrls.length > 0) {
                                await tx.productVariantImage.deleteMany({
                                    where: { variantId: variant.id },
                                });
                                await tx.productVariantImage.createMany({
                                    data: variant.imageUrls.map((url) => ({
                                        variantId: variant.id!,
                                        imageUrl: url,
                                    })),
                                });
                            }
                        }
                    } else {
                        // Create new variant
                        if (variant.variantName && variant.sku && variant.stock !== undefined) {
                            const newVariant = await tx.productVariant.create({
                                data: {
                                    productId: updatedProduct.id,
                                    variantName: variant.variantName,
                                    sku: variant.sku,
                                    stock: variant.stock,
                                    isActive: variant.isActive ?? true,
                                },
                            });

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
                }
            }

            // Handle tags (existing code)
            if (dto.tagIds !== undefined) {
                await tx.productTag.deleteMany({
                    where: { productId: id },
                });

                if (dto.tagIds.length > 0) {
                    await tx.productTag.createMany({
                        data: dto.tagIds.map((tagId) => ({
                            productId: id,
                            tagId,
                        })),
                    });
                }
            }

            if (dto.galleryImages !== undefined) {
                // Get existing gallery IDs
                const existingGalleryIds = existingProduct.gallery.map(g => g.id);

                // Get IDs that should be kept (from dto)
                const keepGalleryIds = dto.galleryImages
                    .filter(g => g.id && g._action !== 'delete')
                    .map(g => g.id!);

                // Delete gallery images that are not in the new list
                const galleryIdsToDelete = existingGalleryIds.filter(
                    gId => !keepGalleryIds.includes(gId)
                );

                if (galleryIdsToDelete.length > 0) {
                    // Delete from storage
                    const galleriesToDelete = existingProduct.gallery.filter(
                        g => galleryIdsToDelete.includes(g.id)
                    );

                    for (const gallery of galleriesToDelete) {
                        await this.localStorageService
                            .deleteImage(gallery.imageUrl)
                            .catch(() => {
                                this.logger.warn('Failed to delete gallery image from storage');
                            });
                    }

                    // Delete from database
                    await tx.galleryImage.deleteMany({
                        where: { id: { in: galleryIdsToDelete } },
                    });
                }

                // Process each gallery image
                for (const gallery of dto.galleryImages) {
                    if (gallery._action === 'delete' && gallery.id) {
                        // Delete specific image
                        const galleryToDelete = existingProduct.gallery.find(
                            g => g.id === gallery.id
                        );

                        if (galleryToDelete) {
                            await this.localStorageService
                                .deleteImage(galleryToDelete.imageUrl)
                                .catch(() => {
                                    this.logger.warn('Failed to delete gallery image');
                                });
                        }

                        await tx.galleryImage.delete({
                            where: { id: gallery.id },
                        });
                    } else if (gallery._action === 'update' && gallery.id) {
                        // Update existing gallery image
                        await tx.galleryImage.update({
                            where: { id: gallery.id },
                            data: {
                                imageUrl: gallery.imageUrl,
                                caption: gallery.caption,
                            },
                        });
                    } else if (gallery._action === 'create' || !gallery.id) {
                        // Create new gallery image
                        await tx.galleryImage.create({
                            data: {
                                productId: id,
                                imageUrl: gallery.imageUrl,
                                caption: gallery.caption,
                            },
                        });
                    }
                }
            }

            return updatedProduct;
        });

        this.logger.info(`✅ Product updated: ${product.name} (${product.id})`);
        return this.getProductById(product.id);
    }

    /**
     * DELETE PRODUCT (Admin) - Soft Delete
     */
    async deleteProduct(id: string) {
        const product = await this.prisma.product.findUnique({
            where: { id },
        });

        if (!product) {
            throw new NotFoundException('Product not found');
        }

        if (product.deletedAt) {
            throw new BadRequestException('Product already deleted');
        }

        // Soft delete product and its variants
        await this.prisma.$transaction([
            this.prisma.product.update({
                where: { id },
                data: { deletedAt: new Date() },
            }),
            this.prisma.productVariant.updateMany({
                where: { productId: id },
                data: { deletedAt: new Date() },
            }),
        ]);

        this.logger.info(`🗑️ Product soft deleted: ${product.name} (${id})`);

        return {
            message: 'Product deleted successfully',
            data: { id, deletedAt: new Date() },
        };
    }

    /**
     * RESTORE PRODUCT (Admin)
     */
    async restoreProduct(id: string) {
        const product = await this.prisma.product.findUnique({
            where: { id },
        });

        if (!product) {
            throw new NotFoundException('Product not found');
        }

        if (!product.deletedAt) {
            throw new BadRequestException('Product is not deleted');
        }

        // Restore product and its variants
        await this.prisma.$transaction([
            this.prisma.product.update({
                where: { id },
                data: { deletedAt: null },
            }),
            this.prisma.productVariant.updateMany({
                where: { productId: id },
                data: { deletedAt: null },
            }),
        ]);

        this.logger.info(`♻️ Product restored: ${product.name} (${id})`);

        return this.getProductById(id);
    }

    /**
     * HARD DELETE PRODUCT (Admin) - Permanent Delete
     */
    async hardDeleteProduct(id: string) {
        const product = await this.prisma.product.findUnique({
            where: { id },
            include: {
                variants: {
                    include: {
                        images: true,
                    },
                },
                images: true,
                gallery: true,
            },
        });

        if (!product) {
            throw new NotFoundException('Product not found');
        }

        const imageDeletionPromises: Promise<any>[] = [];

        for (const image of product.images) {
            imageDeletionPromises.push(
                this.localStorageService.deleteImage(image.imageUrl).catch(() => {
                    this.logger.warn('Failed to delete product image');
                }),
            );
        }

        // Delete variant images (existing code)
        for (const variant of product.variants) {
            for (const image of variant.images) {
                imageDeletionPromises.push(
                    this.localStorageService.deleteImage(image.imageUrl).catch(() => {
                        this.logger.warn('Failed to delete variant image');
                    }),
                );
            }
        }

        for (const gallery of product.gallery) {
            imageDeletionPromises.push(
                this.localStorageService.deleteImage(gallery.imageUrl).catch(() => {
                    this.logger.warn('Failed to delete gallery image');
                }),
            );
        }

        await Promise.all(imageDeletionPromises);

        // Hard delete from database (cascades will handle related records)
        await this.prisma.product.delete({
            where: { id },
        });

        this.logger.info(`💀 Product permanently deleted: ${product.name} (${id})`);

        return {
            message: 'Product permanently deleted',
            data: { id },
        };
    }

    /**
     * TOGGLE PRODUCT ACTIVE STATUS (Admin)
     */
    async toggleProductActive(id: string) {
        const product = await this.prisma.product.findUnique({
            where: { id },
        });

        if (!product) {
            throw new NotFoundException('Product not found');
        }

        const updated = await this.prisma.product.update({
            where: { id },
            data: {
                isActive: !product.isActive,
            },
        });

        this.logger.info(
            `🔄 Product active status toggled: ${product.name} (${updated.isActive})`,
        );

        return {
            message: 'Product status updated',
            data: {
                id: updated.id,
                isActive: updated.isActive,
            },
        };
    }

    /**
     * TOGGLE PRODUCT FEATURED STATUS (Admin)
     */
    async toggleProductFeatured(id: string) {
        const product = await this.prisma.product.findUnique({
            where: { id },
        });

        if (!product) {
            throw new NotFoundException('Product not found');
        }

        const updated = await this.prisma.product.update({
            where: { id },
            data: {
                isFeatured: !product.isFeatured,
            },
        });

        this.logger.info(
            `⭐ Product featured status toggled: ${product.name} (${updated.isFeatured})`,
        );

        return {
            message: 'Product featured status updated',
            data: {
                id: updated.id,
                isFeatured: updated.isFeatured,
            },
        };
    }

    /**
     * BULK DELETE PRODUCTS (Admin)
     */
    async bulkDeleteProducts(ids: string[]) {
        const products = await this.prisma.product.findMany({
            where: { id: { in: ids } },
        });

        if (products.length === 0) {
            throw new NotFoundException('No products found');
        }

        const result = await this.prisma.$transaction([
            this.prisma.product.updateMany({
                where: { id: { in: ids } },
                data: { deletedAt: new Date() },
            }),
            this.prisma.productVariant.updateMany({
                where: { productId: { in: ids } },
                data: { deletedAt: new Date() },
            }),
        ]);

        this.logger.info(`🗑️ Bulk deleted ${result[0].count} products`);

        return {
            message: `${result[0].count} products deleted successfully`,
            data: { count: result[0].count },
        };
    }

    /**
     * BULK RESTORE PRODUCTS (Admin)
     */
    async bulkRestoreProducts(ids: string[]) {
        const products = await this.prisma.product.findMany({
            where: { id: { in: ids } },
        });

        if (products.length === 0) {
            throw new NotFoundException('No products found');
        }

        const result = await this.prisma.$transaction([
            this.prisma.product.updateMany({
                where: { id: { in: ids } },
                data: { deletedAt: null },
            }),
            this.prisma.productVariant.updateMany({
                where: { productId: { in: ids } },
                data: { deletedAt: null },
            }),
        ]);

        this.logger.info(`♻️ Bulk restored ${result[0].count} products`);

        return {
            message: `${result[0].count} products restored successfully`,
            data: { count: result[0].count },
        };
    }
}