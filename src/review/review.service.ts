// src/review/review.service.ts
import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    ConflictException,
    Inject,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PaginationUtil } from '../utils/pagination.util';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Prisma, OrderStatus } from '@prisma/client';
import { CreateReviewDto, UpdateReviewDto } from './dto/create-review.dto';
import { CreateReviewReplyDto, UpdateReviewReplyDto } from './dto/create-review-reply.dto';
import { QueryProductReviewsDto, AdminQueryReviewDto } from './dto/query-review.dto';
import { NotificationService } from '../notification/notification.service'; // ✅ NEW

@Injectable()
export class ReviewService {
    constructor(
        private prisma: PrismaService,
        private notificationService: NotificationService, // ✅ NEW
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    // ==========================================
    // PUBLIC METHODS
    // ==========================================

    /**
     * Get reviews for a product (Public)
     */
    async getProductReviews(productSlug: string, dto: QueryProductReviewsDto) {
        const { page, limit, rating, sortBy, order } = dto;
        const { page: validPage, limit: validLimit } = PaginationUtil.validateParams(page, limit);

        // Find product by slug
        const product = await this.prisma.product.findUnique({
            where: { slug: productSlug, deletedAt: null, isActive: true },
            select: { id: true, name: true, avgRating: true },
        });

        if (!product) {
            throw new NotFoundException('Product not found');
        }

        // Build where clause
        const where: Prisma.ReviewWhereInput = {
            productId: product.id,
        };

        if (rating) {
            where.rating = rating;
        }

        // Get total count
        const total = await this.prisma.review.count({ where });

        // Get reviews with user info and replies
        const reviews = await this.prisma.review.findMany({
            where,
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
                replies: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                firstName: true,
                                lastName: true,
                                role: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'asc' },
                },
                images: true,
            },
            skip: PaginationUtil.getSkip(validPage, validLimit),
            take: validLimit,
            orderBy: { [sortBy]: order },
        });

        // Calculate rating distribution
        const ratingDistribution = await this.prisma.review.groupBy({
            by: ['rating'],
            where: { productId: product.id },
            _count: { rating: true },
        });

        const distribution = {
            1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
        };
        ratingDistribution.forEach((r) => {
            distribution[r.rating as keyof typeof distribution] = r._count.rating;
        });

        // Transform response
        const data = reviews.map((review) => ({
            id: review.id,
            rating: review.rating,
            comment: review.comment,
            isVerified: review.isVerified,
            user: {
                id: review.user.id,
                username: review.user.username,
                name: `${review.user.firstName} ${review.user.lastName}`.trim(),
                profileImage: review.user.profileImage,
            },
            replies: review.replies.map((reply) => ({
                id: reply.id,
                content: reply.content,
                user: {
                    id: reply.user.id,
                    username: reply.user.username,
                    name: `${reply.user.firstName} ${reply.user.lastName}`.trim(),
                    role: reply.user.role,
                },
                createdAt: reply.createdAt,
            })),
            images: review.images,
            createdAt: review.createdAt,
            updatedAt: review.updatedAt,
        }));

        return {
            summary: {
                avgRating: product.avgRating || 0,
                totalReviews: total,
                distribution,
            },
            meta: PaginationUtil.generateMeta(total, validPage, validLimit),
            data,
        };
    }

    /**
     * Get single review by ID (Public)
     */
    async getReviewById(id: string) {
        const review = await this.prisma.review.findUnique({
            where: { id },
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
                product: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
                replies: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                firstName: true,
                                lastName: true,
                                role: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'asc' },
                },
                images: true,
            },
        });

        if (!review) {
            throw new NotFoundException('Review not found');
        }

        return { data: review };
    }

    // ==========================================
    // USER METHODS
    // ==========================================

    /**
     * Get orders eligible for review (User)
     */
    async getPendingReviews(userId: string) {
        const orders = await this.prisma.order.findMany({
            where: {
                userId,
                status: OrderStatus.COMPLETED,
            },
            include: {
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                                images: {
                                    take: 1,
                                    orderBy: { order: 'asc' },
                                },
                            },
                        },
                    },
                },
                reviews: {
                    select: {
                        productId: true,
                    },
                },
            },
            orderBy: { completedAt: 'desc' },
        });

        const pendingReviews: Array<{
            orderId: string;
            orderNumber: string;
            completedAt: Date | null;
            product: {
                id: string;
                name: string;
                slug: string;
                imageUrl: string | null;
            };
        }> = [];

        for (const order of orders) {
            const reviewedProductIds = order.reviews.map((r) => r.productId);

            for (const item of order.items) {
                if (!item.product || reviewedProductIds.includes(item.product.id)) {
                    continue;
                }

                const alreadyAdded = pendingReviews.some(
                    (p) => p.orderId === order.id && p.product.id === item.product!.id,
                );

                if (!alreadyAdded) {
                    pendingReviews.push({
                        orderId: order.id,
                        orderNumber: order.orderNumber,
                        completedAt: order.completedAt,
                        product: {
                            id: item.product.id,
                            name: item.product.name,
                            slug: item.product.slug,
                            imageUrl: item.product.images[0]?.imageUrl || null,
                        },
                    });
                }
            }
        }

        return { data: pendingReviews };
    }

    /**
     * Create a review (User)
     */
    async createReview(userId: string, dto: CreateReviewDto) {
        const { productId, orderId, rating, comment } = dto;

        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: {
                    select: { productId: true },
                },
            },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.userId !== userId) {
            throw new ForbiddenException('You can only review products from your own orders');
        }

        if (order.status !== OrderStatus.COMPLETED) {
            throw new BadRequestException('You can only review products from completed orders');
        }

        const productInOrder = order.items.some((item) => item.productId === productId);
        if (!productInOrder) {
            throw new BadRequestException('This product is not in the specified order');
        }

        const product = await this.prisma.product.findUnique({
            where: { id: productId, deletedAt: null },
        });

        if (!product) {
            throw new NotFoundException('Product not found');
        }

        const existingReview = await this.prisma.review.findUnique({
            where: {
                userId_productId_orderId: {
                    userId,
                    productId,
                    orderId,
                },
            },
        });

        if (existingReview) {
            throw new ConflictException('You have already reviewed this product for this order');
        }

        const review = await this.prisma.$transaction(async (tx) => {
            const newReview = await tx.review.create({
                data: {
                    userId,
                    productId,
                    orderId,
                    rating,
                    comment,
                    isVerified: true,
                },
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
                },
            });

            const avgResult = await tx.review.aggregate({
                where: { productId },
                _avg: { rating: true },
            });

            await tx.product.update({
                where: { id: productId },
                data: { avgRating: avgResult._avg.rating || 0 },
            });

            return newReview;
        });

        this.logger.info(`✅ Review created: ${review.id} for product ${productId} by user ${userId}`);

        return {
            message: 'Review submitted successfully',
            data: review,
        };
    }

    /**
     * Update a review (User - own review only)
     */
    async updateReview(userId: string, reviewId: string, dto: UpdateReviewDto) {
        const review = await this.prisma.review.findUnique({
            where: { id: reviewId },
        });

        if (!review) {
            throw new NotFoundException('Review not found');
        }

        if (review.userId !== userId) {
            throw new ForbiddenException('You can only update your own reviews');
        }

        const updated = await this.prisma.$transaction(async (tx) => {
            const updatedReview = await tx.review.update({
                where: { id: reviewId },
                data: {
                    ...(dto.rating !== undefined && { rating: dto.rating }),
                    ...(dto.comment !== undefined && { comment: dto.comment }),
                },
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
                    replies: true,
                },
            });

            if (dto.rating !== undefined) {
                const avgResult = await tx.review.aggregate({
                    where: { productId: review.productId },
                    _avg: { rating: true },
                });

                await tx.product.update({
                    where: { id: review.productId },
                    data: { avgRating: avgResult._avg.rating || 0 },
                });
            }

            return updatedReview;
        });

        this.logger.info(`✅ Review updated: ${reviewId} by user ${userId}`);

        return {
            message: 'Review updated successfully',
            data: updated,
        };
    }

    /**
     * Delete a review (User - own review only)
     */
    async deleteReview(userId: string, reviewId: string) {
        const review = await this.prisma.review.findUnique({
            where: { id: reviewId },
        });

        if (!review) {
            throw new NotFoundException('Review not found');
        }

        if (review.userId !== userId) {
            throw new ForbiddenException('You can only delete your own reviews');
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.review.delete({
                where: { id: reviewId },
            });

            const avgResult = await tx.review.aggregate({
                where: { productId: review.productId },
                _avg: { rating: true },
            });

            await tx.product.update({
                where: { id: review.productId },
                data: { avgRating: avgResult._avg.rating || 0 },
            });
        });

        this.logger.info(`🗑️ Review deleted: ${reviewId} by user ${userId}`);

        return {
            message: 'Review deleted successfully',
        };
    }

    /**
     * Get user's own reviews
     */
    async getUserReviews(userId: string, page: number = 1, limit: number = 10) {
        const { page: validPage, limit: validLimit } = PaginationUtil.validateParams(page, limit);

        const total = await this.prisma.review.count({
            where: { userId },
        });

        const reviews = await this.prisma.review.findMany({
            where: { userId },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        images: {
                            take: 1,
                            orderBy: { order: 'asc' },
                        },
                    },
                },
                replies: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                firstName: true,
                                lastName: true,
                                role: true,
                            },
                        },
                    },
                },
            },
            skip: PaginationUtil.getSkip(validPage, validLimit),
            take: validLimit,
            orderBy: { createdAt: 'desc' },
        });

        const data = reviews.map((review) => ({
            ...review,
            product: {
                ...review.product,
                imageUrl: review.product.images[0]?.imageUrl || null,
            },
        }));

        return {
            meta: PaginationUtil.generateMeta(total, validPage, validLimit),
            data,
        };
    }

    // ==========================================
    // ADMIN METHODS
    // ==========================================

    /**
     * Get all reviews (Admin)
     */
    async getAllReviews(dto: AdminQueryReviewDto) {
        const { page, limit, productId, userId, rating, hasReply, search, sortBy, order } = dto;
        const { page: validPage, limit: validLimit } = PaginationUtil.validateParams(page, limit);

        const where: Prisma.ReviewWhereInput = {};

        if (productId) {
            where.productId = productId;
        }

        if (userId) {
            where.userId = userId;
        }

        if (rating) {
            where.rating = rating;
        }

        if (hasReply !== undefined) {
            where.replies = hasReply ? { some: {} } : { none: {} };
        }

        if (search) {
            where.OR = [
                { comment: { contains: search, mode: 'insensitive' } },
                { user: { username: { contains: search, mode: 'insensitive' } } },
                { product: { name: { contains: search, mode: 'insensitive' } } },
            ];
        }

        const total = await this.prisma.review.count({ where });

        const reviews = await this.prisma.review.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                product: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
                order: {
                    select: {
                        id: true,
                        orderNumber: true,
                    },
                },
                replies: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                role: true,
                            },
                        },
                    },
                },
                _count: {
                    select: { replies: true },
                },
            },
            skip: PaginationUtil.getSkip(validPage, validLimit),
            take: validLimit,
            orderBy: { [sortBy]: order },
        });

        return {
            meta: PaginationUtil.generateMeta(total, validPage, validLimit),
            data: reviews,
        };
    }

    /**
     * ✅ Reply to a review (Admin/Owner) with NOTIFICATION
     */
    async replyToReview(adminId: string, reviewId: string, dto: CreateReviewReplyDto) {
        // Get review with product and user info
        const review = await this.prisma.review.findUnique({
            where: { id: reviewId },
            include: {
                product: {
                    select: {
                        name: true,
                        slug: true,
                    },
                },
                user: {
                    select: {
                        id: true,
                    },
                },
            },
        });

        if (!review) {
            throw new NotFoundException('Review not found');
        }

        // Get admin info for notification
        const admin = await this.prisma.user.findUnique({
            where: { id: adminId },
            select: {
                firstName: true,
                lastName: true,
                username: true,
            },
        });

        const reply = await this.prisma.reviewReply.create({
            data: {
                reviewId,
                userId: adminId,
                content: dto.content,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                        role: true,
                    },
                },
            },
        });

        // ✅ NEW: Send notification to review owner
        try {
            const replierName = admin
                ? `${admin.firstName} ${admin.lastName}`.trim() || admin.username
                : 'Admin';

            await this.notificationService.notifyReviewReply(
                review.user.id,
                review.product.name,
                review.product.slug,
                reviewId,
                replierName,
                'id', // Default Indonesian locale
            );
        } catch (error: any) {
            this.logger.error('❌ Failed to send review reply notification', {
                reviewId,
                error: error.message,
            });
        }

        this.logger.info(`✅ Review reply created: ${reply.id} for review ${reviewId} by admin ${adminId}`);

        return {
            message: 'Reply submitted successfully',
            data: reply,
        };
    }

    /**
     * Update a reply (Admin/Owner - own reply only)
     */
    async updateReply(adminId: string, replyId: string, dto: UpdateReviewReplyDto) {
        const reply = await this.prisma.reviewReply.findUnique({
            where: { id: replyId },
        });

        if (!reply) {
            throw new NotFoundException('Reply not found');
        }

        if (reply.userId !== adminId) {
            throw new ForbiddenException('You can only update your own replies');
        }

        const updated = await this.prisma.reviewReply.update({
            where: { id: replyId },
            data: { content: dto.content },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                        role: true,
                    },
                },
            },
        });

        this.logger.info(`✅ Review reply updated: ${replyId} by admin ${adminId}`);

        return {
            message: 'Reply updated successfully',
            data: updated,
        };
    }

    /**
     * Delete a reply (Admin/Owner)
     */
    async deleteReply(adminId: string, replyId: string) {
        const reply = await this.prisma.reviewReply.findUnique({
            where: { id: replyId },
        });

        if (!reply) {
            throw new NotFoundException('Reply not found');
        }

        await this.prisma.reviewReply.delete({
            where: { id: replyId },
        });

        this.logger.info(`🗑️ Review reply deleted: ${replyId} by admin ${adminId}`);

        return {
            message: 'Reply deleted successfully',
        };
    }

    /**
     * Delete a review (Admin - can delete any review)
     */
    async adminDeleteReview(adminId: string, reviewId: string) {
        const review = await this.prisma.review.findUnique({
            where: { id: reviewId },
        });

        if (!review) {
            throw new NotFoundException('Review not found');
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.review.delete({
                where: { id: reviewId },
            });

            const avgResult = await tx.review.aggregate({
                where: { productId: review.productId },
                _avg: { rating: true },
            });

            await tx.product.update({
                where: { id: review.productId },
                data: { avgRating: avgResult._avg.rating || 0 },
            });
        });

        this.logger.info(`🗑️ Review deleted by admin: ${reviewId} by admin ${adminId}`);

        return {
            message: 'Review deleted successfully',
        };
    }
}