// src/discussion/discussion.service.ts
import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    Inject,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PaginationUtil } from '../utils/pagination.util';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Prisma, Role } from '@prisma/client';
import {
    CreateDiscussionDto,
    UpdateDiscussionDto,
    CreateDiscussionReplyDto,
    UpdateDiscussionReplyDto,
} from './dto/create-discussion.dto';
import { QueryProductDiscussionsDto, AdminQueryDiscussionDto } from './dto/query-discussion.dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class DiscussionService {
    constructor(
        private prisma: PrismaService,
        private notificationService: NotificationService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    // ==========================================
    // PUBLIC METHODS
    // ==========================================

    /**
     * Get discussions for a product (Public)
     */
    async getProductDiscussions(productSlug: string, dto: QueryProductDiscussionsDto, userId?: string) {
        const { page, limit, sortBy, order } = dto;
        const { page: validPage, limit: validLimit } = PaginationUtil.validateParams(page, limit);

        const product = await this.prisma.product.findUnique({
            where: { slug: productSlug, deletedAt: null, isActive: true },
            select: { id: true, name: true },
        });

        if (!product) {
            throw new NotFoundException('Product not found');
        }

        const where: Prisma.DiscussionWhereInput = {
            productId: product.id,
        };

        const total = await this.prisma.discussion.count({ where });

        const discussions = await this.prisma.discussion.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                        profileImage: true,
                        role: true,
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
                                profileImage: true,
                                role: true,
                            },
                        },
                        likes: {
                            select: { userId: true },
                        },
                        _count: {
                            select: { likes: true },
                        },
                    },
                    orderBy: { createdAt: 'asc' },
                },
                likes: {
                    select: { userId: true },
                },
                _count: {
                    select: { likes: true, replies: true },
                },
            },
            skip: PaginationUtil.getSkip(validPage, validLimit),
            take: validLimit,
            orderBy: sortBy === 'likesCount'
                ? { likes: { _count: order } }
                : { [sortBy]: order },
        });

        const data = discussions.map((discussion) => ({
            id: discussion.id,
            question: discussion.question,
            user: {
                id: discussion.user.id,
                username: discussion.user.username,
                name: `${discussion.user.firstName} ${discussion.user.lastName}`.trim(),
                profileImage: discussion.user.profileImage,
                role: discussion.user.role,
                isAdmin: discussion.user.role === Role.ADMIN || discussion.user.role === Role.OWNER,
            },
            likesCount: discussion._count.likes,
            repliesCount: discussion._count.replies,
            isLiked: userId ? discussion.likes.some((like) => like.userId === userId) : false,
            replies: discussion.replies.map((reply) => ({
                id: reply.id,
                content: reply.content,
                user: {
                    id: reply.user.id,
                    username: reply.user.username,
                    name: `${reply.user.firstName} ${reply.user.lastName}`.trim(),
                    profileImage: reply.user.profileImage,
                    role: reply.user.role,
                    isAdmin: reply.user.role === Role.ADMIN || reply.user.role === Role.OWNER,
                },
                likesCount: reply._count.likes,
                isLiked: userId ? reply.likes.some((like) => like.userId === userId) : false,
                createdAt: reply.createdAt,
                updatedAt: reply.updatedAt,
            })),
            createdAt: discussion.createdAt,
            updatedAt: discussion.updatedAt,
        }));

        return {
            meta: PaginationUtil.generateMeta(total, validPage, validLimit),
            data,
        };
    }

    /**
     * Get single discussion by ID (Public)
     */
    async getDiscussionById(id: string, userId?: string) {
        const discussion = await this.prisma.discussion.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                        profileImage: true,
                        role: true,
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
                                profileImage: true,
                                role: true,
                            },
                        },
                        likes: {
                            select: { userId: true },
                        },
                        _count: {
                            select: { likes: true },
                        },
                    },
                    orderBy: { createdAt: 'asc' },
                },
                likes: {
                    select: { userId: true },
                },
                _count: {
                    select: { likes: true, replies: true },
                },
            },
        });

        if (!discussion) {
            throw new NotFoundException('Discussion not found');
        }

        const data = {
            id: discussion.id,
            question: discussion.question,
            product: discussion.product,
            user: {
                id: discussion.user.id,
                username: discussion.user.username,
                name: `${discussion.user.firstName} ${discussion.user.lastName}`.trim(),
                profileImage: discussion.user.profileImage,
                role: discussion.user.role,
                isAdmin: discussion.user.role === Role.ADMIN || discussion.user.role === Role.OWNER,
            },
            likesCount: discussion._count.likes,
            repliesCount: discussion._count.replies,
            isLiked: userId ? discussion.likes.some((like) => like.userId === userId) : false,
            replies: discussion.replies.map((reply) => ({
                id: reply.id,
                content: reply.content,
                user: {
                    id: reply.user.id,
                    username: reply.user.username,
                    name: `${reply.user.firstName} ${reply.user.lastName}`.trim(),
                    profileImage: reply.user.profileImage,
                    role: reply.user.role,
                    isAdmin: reply.user.role === Role.ADMIN || reply.user.role === Role.OWNER,
                },
                likesCount: reply._count.likes,
                isLiked: userId ? reply.likes.some((like) => like.userId === userId) : false,
                createdAt: reply.createdAt,
                updatedAt: reply.updatedAt,
            })),
            createdAt: discussion.createdAt,
            updatedAt: discussion.updatedAt,
        };

        return { data };
    }

    // ==========================================
    // USER METHODS
    // ==========================================

    /**
     * Create a discussion/question (User)
     */
    async createDiscussion(userId: string, dto: CreateDiscussionDto) {
        const { productId, question } = dto;

        const product = await this.prisma.product.findUnique({
            where: { id: productId, deletedAt: null, isActive: true },
        });

        if (!product) {
            throw new NotFoundException('Product not found');
        }

        const discussion = await this.prisma.discussion.create({
            data: {
                userId,
                productId,
                question,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                        profileImage: true,
                        role: true,
                    },
                },
            },
        });

        this.logger.info(`✅ Discussion created: ${discussion.id} for product ${productId} by user ${userId}`);

        return {
            message: 'Question submitted successfully',
            data: {
                id: discussion.id,
                question: discussion.question,
                user: {
                    id: discussion.user.id,
                    username: discussion.user.username,
                    name: `${discussion.user.firstName} ${discussion.user.lastName}`.trim(),
                    profileImage: discussion.user.profileImage,
                    role: discussion.user.role,
                },
                likesCount: 0,
                repliesCount: 0,
                isLiked: false,
                replies: [],
                createdAt: discussion.createdAt,
            },
        };
    }

    /**
     * Update a discussion (User - own discussion only)
     */
    async updateDiscussion(userId: string, discussionId: string, dto: UpdateDiscussionDto) {
        const discussion = await this.prisma.discussion.findUnique({
            where: { id: discussionId },
        });

        if (!discussion) {
            throw new NotFoundException('Discussion not found');
        }

        if (discussion.userId !== userId) {
            throw new ForbiddenException('You can only update your own questions');
        }

        const updated = await this.prisma.discussion.update({
            where: { id: discussionId },
            data: { question: dto.question },
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
                _count: {
                    select: { likes: true, replies: true },
                },
            },
        });

        this.logger.info(`✅ Discussion updated: ${discussionId} by user ${userId}`);

        return {
            message: 'Question updated successfully',
            data: updated,
        };
    }

    /**
     * Delete a discussion (User - own discussion only, or Admin)
     */
    async deleteDiscussion(userId: string, userRole: Role, discussionId: string) {
        const discussion = await this.prisma.discussion.findUnique({
            where: { id: discussionId },
        });

        if (!discussion) {
            throw new NotFoundException('Discussion not found');
        }

        const isOwner = discussion.userId === userId;
        const isAdmin = userRole === Role.ADMIN || userRole === Role.OWNER;

        if (!isOwner && !isAdmin) {
            throw new ForbiddenException('You can only delete your own questions');
        }

        await this.prisma.discussion.delete({
            where: { id: discussionId },
        });

        this.logger.info(`🗑️ Discussion deleted: ${discussionId} by user ${userId}`);

        return {
            message: 'Question deleted successfully',
        };
    }

    /**
     * ✅ Reply to a discussion (User) with NOTIFICATION
     */
    async createReply(userId: string, discussionId: string, dto: CreateDiscussionReplyDto) {
        // Get discussion with product and user info
        const discussion = await this.prisma.discussion.findUnique({
            where: { id: discussionId },
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

        if (!discussion) {
            throw new NotFoundException('Discussion not found');
        }

        // Get replier info
        const replier = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                firstName: true,
                lastName: true,
                username: true,
            },
        });

        const reply = await this.prisma.discussionReply.create({
            data: {
                discussionId,
                userId,
                content: dto.content,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                        profileImage: true,
                        role: true,
                    },
                },
            },
        });

        if (discussion.user.id !== userId) {
            try {
                const replierName = replier
                    ? `${replier.firstName} ${replier.lastName}`.trim() || replier.username
                    : 'Pengguna';

                await this.notificationService.notifyDiscussionReply(
                    discussion.user.id,
                    discussion.product.name,
                    discussion.product.slug,
                    discussionId,
                    replierName,
                    'id', // Default Indonesian locale
                );
            } catch (error: any) {
                this.logger.error('❌ Failed to send discussion reply notification', {
                    discussionId,
                    error: error.message,
                });
            }
        }

        this.logger.info(`✅ Discussion reply created: ${reply.id} for discussion ${discussionId} by user ${userId}`);

        return {
            message: 'Reply submitted successfully',
            data: {
                id: reply.id,
                content: reply.content,
                user: {
                    id: reply.user.id,
                    username: reply.user.username,
                    name: `${reply.user.firstName} ${reply.user.lastName}`.trim(),
                    profileImage: reply.user.profileImage,
                    role: reply.user.role,
                    isAdmin: reply.user.role === Role.ADMIN || reply.user.role === Role.OWNER,
                },
                likesCount: 0,
                isLiked: false,
                createdAt: reply.createdAt,
            },
        };
    }

    /**
     * Update a reply (User - own reply only)
     */
    async updateReply(userId: string, replyId: string, dto: UpdateDiscussionReplyDto) {
        const reply = await this.prisma.discussionReply.findUnique({
            where: { id: replyId },
        });

        if (!reply) {
            throw new NotFoundException('Reply not found');
        }

        if (reply.userId !== userId) {
            throw new ForbiddenException('You can only update your own replies');
        }

        const updated = await this.prisma.discussionReply.update({
            where: { id: replyId },
            data: { content: dto.content },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                        profileImage: true,
                        role: true,
                    },
                },
                _count: {
                    select: { likes: true },
                },
            },
        });

        this.logger.info(`✅ Discussion reply updated: ${replyId} by user ${userId}`);

        return {
            message: 'Reply updated successfully',
            data: updated,
        };
    }

    /**
     * Delete a reply (User - own reply only, or Admin)
     */
    async deleteReply(userId: string, userRole: Role, replyId: string) {
        const reply = await this.prisma.discussionReply.findUnique({
            where: { id: replyId },
        });

        if (!reply) {
            throw new NotFoundException('Reply not found');
        }

        const isOwner = reply.userId === userId;
        const isAdmin = userRole === Role.ADMIN || userRole === Role.OWNER;

        if (!isOwner && !isAdmin) {
            throw new ForbiddenException('You can only delete your own replies');
        }

        await this.prisma.discussionReply.delete({
            where: { id: replyId },
        });

        this.logger.info(`🗑️ Discussion reply deleted: ${replyId} by user ${userId}`);

        return {
            message: 'Reply deleted successfully',
        };
    }

    /**
     * Toggle like on a discussion (User)
     */
    async toggleDiscussionLike(userId: string, discussionId: string) {
        const discussion = await this.prisma.discussion.findUnique({
            where: { id: discussionId },
        });

        if (!discussion) {
            throw new NotFoundException('Discussion not found');
        }

        const existingLike = await this.prisma.discussionLike.findUnique({
            where: {
                userId_discussionId: {
                    userId,
                    discussionId,
                },
            },
        });

        if (existingLike) {
            await this.prisma.discussionLike.delete({
                where: { id: existingLike.id },
            });

            const count = await this.prisma.discussionLike.count({
                where: { discussionId },
            });

            return {
                message: 'Like removed',
                data: { isLiked: false, likesCount: count },
            };
        } else {
            await this.prisma.discussionLike.create({
                data: {
                    userId,
                    discussionId,
                },
            });

            const count = await this.prisma.discussionLike.count({
                where: { discussionId },
            });

            return {
                message: 'Liked successfully',
                data: { isLiked: true, likesCount: count },
            };
        }
    }

    /**
     * Toggle like on a reply (User)
     */
    async toggleReplyLike(userId: string, replyId: string) {
        const reply = await this.prisma.discussionReply.findUnique({
            where: { id: replyId },
        });

        if (!reply) {
            throw new NotFoundException('Reply not found');
        }

        const existingLike = await this.prisma.discussionLike.findUnique({
            where: {
                userId_discussionReplyId: {
                    userId,
                    discussionReplyId: replyId,
                },
            },
        });

        if (existingLike) {
            await this.prisma.discussionLike.delete({
                where: { id: existingLike.id },
            });

            const count = await this.prisma.discussionLike.count({
                where: { discussionReplyId: replyId },
            });

            return {
                message: 'Like removed',
                data: { isLiked: false, likesCount: count },
            };
        } else {
            await this.prisma.discussionLike.create({
                data: {
                    userId,
                    discussionReplyId: replyId,
                },
            });

            const count = await this.prisma.discussionLike.count({
                where: { discussionReplyId: replyId },
            });

            return {
                message: 'Liked successfully',
                data: { isLiked: true, likesCount: count },
            };
        }
    }

    /**
     * Get user's discussions
     */
    async getUserDiscussions(userId: string, page: number = 1, limit: number = 10) {
        const { page: validPage, limit: validLimit } = PaginationUtil.validateParams(page, limit);

        const total = await this.prisma.discussion.count({
            where: { userId },
        });

        const discussions = await this.prisma.discussion.findMany({
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
                _count: {
                    select: { likes: true, replies: true },
                },
            },
            skip: PaginationUtil.getSkip(validPage, validLimit),
            take: validLimit,
            orderBy: { createdAt: 'desc' },
        });

        const data = discussions.map((d) => ({
            ...d,
            product: {
                ...d.product,
                imageUrl: d.product.images[0]?.imageUrl || null,
            },
            likesCount: d._count.likes,
            repliesCount: d._count.replies,
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
     * Get all discussions (Admin)
     */
    async getAllDiscussions(dto: AdminQueryDiscussionDto) {
        const { page, limit, productId, userId, hasReplies, search, sortBy, order } = dto;
        const { page: validPage, limit: validLimit } = PaginationUtil.validateParams(page, limit);

        const where: Prisma.DiscussionWhereInput = {};

        if (productId) {
            where.productId = productId;
        }

        if (userId) {
            where.userId = userId;
        }

        if (hasReplies !== undefined) {
            where.replies = hasReplies ? { some: {} } : { none: {} };
        }

        if (search) {
            where.OR = [
                { question: { contains: search, mode: 'insensitive' } },
                { user: { username: { contains: search, mode: 'insensitive' } } },
                { product: { name: { contains: search, mode: 'insensitive' } } },
            ];
        }

        const total = await this.prisma.discussion.count({ where });

        const discussions = await this.prisma.discussion.findMany({
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
                _count: {
                    select: { likes: true, replies: true },
                },
            },
            skip: PaginationUtil.getSkip(validPage, validLimit),
            take: validLimit,
            orderBy: sortBy === 'likesCount'
                ? { likes: { _count: order } }
                : { [sortBy]: order },
        });

        const data = discussions.map((d) => ({
            ...d,
            likesCount: d._count.likes,
            repliesCount: d._count.replies,
        }));

        return {
            meta: PaginationUtil.generateMeta(total, validPage, validLimit),
            data,
        };
    }
}