import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
    Inject,
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

@Injectable()
export class TagService {
    constructor(
        private prisma: PrismaService,
        private productService: ProductService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    /**
     * GET ALL TAGS (Public & Admin)
     */
    async getAllTags(dto: GetTagsDto, isAdmin: boolean = false) {
        const { page, limit, search, isActive, sortBy, order, includeDeleted } = dto;

        // Validate pagination
        const { page: validPage, limit: validLimit } = PaginationUtil.validateParams(page, limit);

        // Build where clause
        const where: Prisma.TagWhereInput = {};

        // Soft delete filter
        if (!isAdmin || !includeDeleted) {
            where.deletedAt = null;
        }

        // Active filter
        if (!isAdmin) {
            where.isActive = true; // Public only
        } else if (isActive !== undefined) {
            where.isActive = isActive; // Admin optional filter
        }

        // Search filter
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { slug: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Get total count
        const total = await this.prisma.tag.count({ where });

        // Prepare orderBy
        let orderBy: any = {};
        if (sortBy === 'productCount') {
            orderBy = { createdAt: order };
        } else {
            orderBy = { [sortBy]: order };
        }

        // Get tags
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

        // Sort by product count if needed
        let sortedTags = tags;
        if (sortBy === 'productCount') {
            sortedTags = tags.sort((a, b) => {
                const diff = a._count.products - b._count.products;
                return order === 'asc' ? diff : -diff;
            });
        }

        // Transform response
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

    /**
     * CREATE TAG (Admin)
     */
    async createTag(dto: CreateTagDto) {
        // Check if slug already exists
        const existingTag = await this.prisma.tag.findUnique({
            where: { slug: dto.slug },
        });

        if (existingTag) {
            throw new ConflictException('Tag with this slug already exists');
        }

        // Check if name already exists
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

        // Create tag
        const tag = await this.prisma.tag.create({
            data: {
                name: dto.name,
                slug: dto.slug,
            },
        });

        this.logger.info(`✅ Tag created: ${tag.name} (${tag.id})`);

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
     */
    async updateTag(id: string, dto: UpdateTagDto) {
        // Check if tag exists
        const existingTag = await this.prisma.tag.findUnique({
            where: { id },
        });

        if (!existingTag) {
            throw new NotFoundException('Tag not found');
        }

        // Check if slug is being changed and already exists
        if (dto.slug && dto.slug !== existingTag.slug) {
            const slugExists = await this.prisma.tag.findUnique({
                where: { slug: dto.slug },
            });

            if (slugExists) {
                throw new ConflictException('Tag with this slug already exists');
            }
        }

        // Check if name is being changed and already exists
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

        // Update tag
        const tag = await this.prisma.tag.update({
            where: { id },
            data: {
                ...(dto.name && { name: dto.name }),
                ...(dto.slug && { slug: dto.slug }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            },
        });

        this.logger.info(`✅ Tag updated: ${tag.name} (${tag.id})`);

        return this.getTagById(tag.id);
    }

    /**
     * DELETE TAG (Admin) - Soft Delete
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

        // Soft delete tag (ProductTag junction will remain)
        await this.prisma.tag.update({
            where: { id },
            data: { deletedAt: new Date() },
        });

        this.logger.info(`🗑️ Tag soft deleted: ${tag.name} (${id})`);

        return {
            message: 'Tag deleted successfully',
            data: { id, deletedAt: new Date() },
        };
    }

    /**
     * RESTORE TAG (Admin)
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

        // Restore tag
        await this.prisma.tag.update({
            where: { id },
            data: { deletedAt: null },
        });

        this.logger.info(`♻️ Tag restored: ${tag.name} (${id})`);

        return this.getTagById(id);
    }

    /**
     * HARD DELETE TAG (Admin) - Permanent Delete
     */
    async hardDeleteTag(id: string) {
        const tag = await this.prisma.tag.findUnique({
            where: { id },
        });

        if (!tag) {
            throw new NotFoundException('Tag not found');
        }

        // Hard delete from database (cascade will delete ProductTag records)
        await this.prisma.tag.delete({
            where: { id },
        });

        this.logger.info(`💀 Tag permanently deleted: ${tag.name} (${id})`);

        return {
            message: 'Tag permanently deleted',
            data: { id },
        };
    }

    /**
     * TOGGLE TAG ACTIVE STATUS (Admin)
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

        return {
            message: 'Tag status updated',
            data: {
                id: updated.id,
                isActive: updated.isActive,
            },
        };
    }

    /**
     * GET PRODUCTS BY TAG (Public)
     */
    async getProductsByTag(slug: string, queryParams: any) {
        // 1. Validasi keberadaan tag (kode ini tidak berubah)
        const tag = await this.prisma.tag.findUnique({
            where: { slug, deletedAt: null, isActive: true },
        });

        if (!tag) {
            throw new NotFoundException('Tag not found');
        }

        // 2. Siapkan parameter untuk ProductService
        // Kita tambahkan filter tagId ke dalam queryParams yang ada
        const productsQuery = {
            ...queryParams,
            tagId: tag.id, // Ini adalah filter kunci
        };

        // 3. Panggil ProductService untuk mengambil produk
        // `false` menandakan ini adalah panggilan publik (hanya produk aktif)
        const productsResult = await this.productService.getAllProducts(productsQuery, false);

        // 4. Gabungkan hasilnya
        return {
            data: {
                tag: {
                    id: tag.id,
                    name: tag.name,
                    slug: tag.slug,
                },
                products: productsResult, // Langsung masukkan hasil dari ProductService
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

        // Calculate statistics
        const products = tag.products.map((pt) => pt.product);
        const totalProducts = products.length;
        const activeProducts = products.filter((p) => p.isActive).length;
        const inactiveProducts = totalProducts - activeProducts;

        const totalSold = products.reduce((sum, p) => sum + p.totalSold, 0);
        const totalViews = products.reduce((sum, p) => sum + p.totalView, 0);
        const avgRating =
            products.reduce((sum, p) => sum + (p.avgRating || 0), 0) / totalProducts || 0;

        // Get top products
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
            take: limit * 2, // Fetch more to sort
        });

        // Sort by product count
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

        return {
            message: `${result.count} tags deleted successfully`,
            data: { count: result.count },
        };
    }

    /**
     * BULK RESTORE TAGS (Admin)
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

        return {
            message: `${result.count} tags restored successfully`,
            data: { count: result.count },
        };
    }
}