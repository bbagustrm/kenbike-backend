// src/return/return.service.ts

import {
    Injectable,
    Inject,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { PrismaService } from '../common/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { EmailService } from '../common/email.service';
import { PaginationUtil } from '../utils/pagination.util';
import { CreateReturnDto } from './dto/create-return.dto';
import { ConfirmItemSentDto } from './dto/confirm-item-sent.dto';
import { CancelReturnDto } from './dto/cancel-return.dto';
import { ApproveReturnDto } from './dto/approve-return.dto';
import { RejectReturnDto } from './dto/reject-return.dto';
import { MarkItemReceivedDto } from './dto/mark-item-received.dto';
import { MarkRefundedDto } from './dto/mark-refunded.dto';
import { QueryReturnsDto } from './dto/query-returns.dto';

const RETURN_WINDOW_DAYS = 7;

@Injectable()
export class ReturnService {
    constructor(
        private prisma: PrismaService,
        private notificationService: NotificationService,
        private emailService: EmailService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    // ============================================
    // USER METHODS
    // ============================================

    async createReturn(userId: string, dto: CreateReturnDto) {
        this.logger.info('📦 Creating return request', {
            userId,
            orderNumber: dto.order_number,
        });

        const order = await this.prisma.order.findUnique({
            where: { orderNumber: dto.order_number },
        });

        if (!order) throw new NotFoundException('Order not found');
        if (order.userId !== userId) throw new ForbiddenException('Access denied');

        if (order.status !== 'COMPLETED') {
            throw new BadRequestException('Return can only be requested for completed orders');
        }

        if (!order.completedAt) {
            throw new BadRequestException('Order completion date not found');
        }

        const daysSinceCompleted = Math.floor(
            (Date.now() - order.completedAt.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysSinceCompleted > RETURN_WINDOW_DAYS) {
            throw new BadRequestException(
                `Return window has expired. Returns are only accepted within ${RETURN_WINDOW_DAYS} days of order completion.`,
            );
        }

        const existingReturn = await this.prisma.return.findUnique({
            where: { orderId: order.id },
        });

        if (existingReturn) {
            const nonCancellableStatuses = [
                'REQUESTED', 'APPROVED', 'ITEM_SENT', 'ITEM_RECEIVED', 'REFUNDED',
            ];
            if (nonCancellableStatuses.includes(existingReturn.status)) {
                throw new BadRequestException(
                    `A return request already exists for this order (status: ${existingReturn.status})`,
                );
            }
        }

        const returnRequest = await this.prisma.$transaction(async (tx) => {
            if (existingReturn) {
                await tx.returnImage.deleteMany({ where: { returnId: existingReturn.id } });
                await tx.return.delete({ where: { id: existingReturn.id } });
            }

            const newReturn = await tx.return.create({
                data: {
                    orderId: order.id,
                    userId,
                    reason: dto.reason,
                    description: dto.description,
                    refundBankName: dto.refund_bank_name,
                    refundAccountNumber: dto.refund_account_number,
                    refundAccountName: dto.refund_account_name,
                },
            });

            if (dto.image_urls.length > 0) {
                await tx.returnImage.createMany({
                    data: dto.image_urls.map((url) => ({
                        returnId: newReturn.id,
                        imageUrl: url,
                    })),
                });
            }

            return newReturn;
        });

        try {
            await this.notificationService.notifyReturnStatusChange(
                userId,
                order.orderNumber,
                returnRequest.id,
                'REQUESTED',
                'user',
                'id',
            );
        } catch (error: any) {
            this.logger.error('❌ Failed to send return notification to user', { error: error.message });
        }

        try {
            await this.notificationService.notifyReturnToAdmins(
                order.orderNumber,
                returnRequest.id,
                dto.reason,
            );
        } catch (error: any) {
            this.logger.error('❌ Failed to notify admins about new return', { error: error.message });
        }

        this.logger.info('✅ Return request created', {
            returnId: returnRequest.id,
            orderNumber: dto.order_number,
        });

        return {
            message: 'Return request submitted successfully',
            data: this.formatReturn(returnRequest),
        };
    }

    async getReturnByOrderNumber(userId: string, orderNumber: string) {
        const order = await this.prisma.order.findUnique({ where: { orderNumber } });

        if (!order) throw new NotFoundException('Order not found');
        if (order.userId !== userId) throw new ForbiddenException('Access denied');

        const returnRequest = await this.prisma.return.findUnique({
            where: { orderId: order.id },
            include: { images: true },
        });

        if (!returnRequest) throw new NotFoundException('No return request found for this order');

        return { data: this.formatReturnDetail(returnRequest) };
    }

    async getUserReturns(userId: string, dto: QueryReturnsDto) {
        const { page, limit, status } = dto;
        const { page: validPage, limit: validLimit } = PaginationUtil.validateParams(page, limit);

        const where: any = { userId };
        if (status) where.status = status;

        const total = await this.prisma.return.count({ where });

        const returns = await this.prisma.return.findMany({
            where,
            include: {
                images: true,
                order: { select: { orderNumber: true, total: true, currency: true } },
            },
            skip: PaginationUtil.getSkip(validPage, validLimit),
            take: validLimit,
            orderBy: { createdAt: 'desc' },
        });

        return {
            meta: PaginationUtil.generateMeta(total, validPage, validLimit),
            data: returns.map((r) => this.formatReturnDetail(r)),
        };
    }

    async confirmItemSent(userId: string, returnId: string, dto: ConfirmItemSentDto) {
        const returnRequest = await this.prisma.return.findUnique({
            where: { id: returnId },
            include: { order: true },
        });

        if (!returnRequest) throw new NotFoundException('Return request not found');
        if (returnRequest.userId !== userId) throw new ForbiddenException('Access denied');

        if (returnRequest.status !== 'APPROVED') {
            throw new BadRequestException(
                `Cannot confirm item sent for return with status: ${returnRequest.status}. Return must be APPROVED first.`,
            );
        }

        const updated = await this.prisma.return.update({
            where: { id: returnId },
            data: {
                status: 'ITEM_SENT',
                returnCourier: dto.return_courier,
                returnTrackingNumber: dto.return_tracking_number,
                itemSentAt: new Date(),
            },
        });

        try {
            await this.notificationService.notifyReturnToAdmins(
                returnRequest.order.orderNumber,
                returnId,
                'ITEM_SENT',
            );
        } catch (error: any) {
            this.logger.error('❌ Failed to notify admins about item sent', { error: error.message });
        }

        this.logger.info('✅ Return item sent confirmed', { returnId });

        return {
            message: 'Item shipment confirmed successfully',
            data: this.formatReturn(updated),
        };
    }

    async cancelReturn(userId: string, returnId: string, dto: CancelReturnDto) {
        const returnRequest = await this.prisma.return.findUnique({ where: { id: returnId } });

        if (!returnRequest) throw new NotFoundException('Return request not found');
        if (returnRequest.userId !== userId) throw new ForbiddenException('Access denied');

        const cancellableStatuses = ['REQUESTED', 'APPROVED'];
        if (!cancellableStatuses.includes(returnRequest.status)) {
            throw new BadRequestException(
                `Cannot cancel return with status: ${returnRequest.status}. Return can only be cancelled before item is sent.`,
            );
        }

        const updated = await this.prisma.return.update({
            where: { id: returnId },
            data: {
                status: 'CANCELLED',
                cancelReason: dto.cancel_reason || null,
                cancelledAt: new Date(),
            },
        });

        this.logger.info('✅ Return cancelled by user', { returnId, userId });

        return {
            message: 'Return request cancelled successfully',
            data: this.formatReturn(updated),
        };
    }

    // ============================================
    // ADMIN METHODS
    // ============================================

    async getAllReturns(dto: QueryReturnsDto) {
        const { page, limit, status, search } = dto;
        const { page: validPage, limit: validLimit } = PaginationUtil.validateParams(page, limit);

        const where: any = {};
        if (status) where.status = status;
        if (search) {
            where.order = { orderNumber: { contains: search, mode: 'insensitive' } };
        }

        const total = await this.prisma.return.count({ where });

        const returns = await this.prisma.return.findMany({
            where,
            include: {
                images: true,
                order: {
                    select: {
                        orderNumber: true,
                        total: true,
                        currency: true,
                        paymentMethod: true,
                    },
                },
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        phoneNumber: true,
                    },
                },
            },
            skip: PaginationUtil.getSkip(validPage, validLimit),
            take: validLimit,
            orderBy: { createdAt: 'desc' },
        });

        return {
            meta: PaginationUtil.generateMeta(total, validPage, validLimit),
            data: returns.map((r) => this.formatReturnAdmin(r)),
        };
    }

    async getReturnDetailAdmin(returnId: string) {
        const returnRequest = await this.prisma.return.findUnique({
            where: { id: returnId },
            include: {
                images: true,
                order: {
                    include: {
                        items: {
                            select: {
                                productName: true,
                                variantName: true,
                                quantity: true,
                                pricePerItem: true,
                                subtotal: true,
                                productImage: true,
                            },
                        },
                    },
                },
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        phoneNumber: true,
                    },
                },
            },
        });

        if (!returnRequest) throw new NotFoundException('Return request not found');

        return { data: this.formatReturnAdmin(returnRequest) };
    }

    async approveReturn(adminId: string, adminEmail: string, returnId: string, dto: ApproveReturnDto) {
        const returnRequest = await this.prisma.return.findUnique({
            where: { id: returnId },
            include: { order: true },
        });

        if (!returnRequest) throw new NotFoundException('Return request not found');

        if (returnRequest.status !== 'REQUESTED') {
            throw new BadRequestException(`Cannot approve return with status: ${returnRequest.status}`);
        }

        const updated = await this.prisma.return.update({
            where: { id: returnId },
            data: {
                status: 'APPROVED',
                adminNotes: dto.admin_notes || null,
                reviewedAt: new Date(),
                reviewedBy: adminEmail,
                refundAmount: returnRequest.order.total,
            },
        });

        try {
            await this.notificationService.notifyReturnStatusChange(
                returnRequest.userId,
                returnRequest.order.orderNumber,
                returnId,
                'APPROVED',
                'user',
                'id',
            );
        } catch (error: any) {
            this.logger.error('❌ Failed to send return approved notification', { error: error.message });
        }

        this.logger.info('✅ Return approved', { returnId, adminEmail });

        return {
            message: 'Return request approved successfully',
            data: this.formatReturn(updated),
        };
    }

    async rejectReturn(adminEmail: string, returnId: string, dto: RejectReturnDto) {
        const returnRequest = await this.prisma.return.findUnique({
            where: { id: returnId },
            include: { order: true },
        });

        if (!returnRequest) throw new NotFoundException('Return request not found');

        if (returnRequest.status !== 'REQUESTED') {
            throw new BadRequestException(`Cannot reject return with status: ${returnRequest.status}`);
        }

        const updated = await this.prisma.return.update({
            where: { id: returnId },
            data: {
                status: 'REJECTED',
                adminNotes: dto.admin_notes,
                reviewedAt: new Date(),
                reviewedBy: adminEmail,
            },
        });

        try {
            await this.notificationService.notifyReturnStatusChange(
                returnRequest.userId,
                returnRequest.order.orderNumber,
                returnId,
                'REJECTED',
                'user',
                'id',
            );
        } catch (error: any) {
            this.logger.error('❌ Failed to send return rejected notification', { error: error.message });
        }

        this.logger.info('✅ Return rejected', { returnId, adminEmail });

        return {
            message: 'Return request rejected',
            data: this.formatReturn(updated),
        };
    }

    async markItemReceived(adminEmail: string, returnId: string, dto: MarkItemReceivedDto) {
        const returnRequest = await this.prisma.return.findUnique({
            where: { id: returnId },
            include: { order: true },
        });

        if (!returnRequest) throw new NotFoundException('Return request not found');

        if (returnRequest.status !== 'ITEM_SENT') {
            throw new BadRequestException(`Cannot mark item as received for return with status: ${returnRequest.status}`);
        }

        const updated = await this.prisma.return.update({
            where: { id: returnId },
            data: {
                status: 'ITEM_RECEIVED',
                receivedNotes: dto.received_notes || null,
                receivedAt: new Date(),
                receivedBy: adminEmail,
            },
        });

        try {
            await this.notificationService.notifyReturnStatusChange(
                returnRequest.userId,
                returnRequest.order.orderNumber,
                returnId,
                'ITEM_RECEIVED',
                'user',
                'id',
            );
        } catch (error: any) {
            this.logger.error('❌ Failed to send item received notification', { error: error.message });
        }

        this.logger.info('✅ Return item marked as received', { returnId, adminEmail });

        return {
            message: 'Item received successfully',
            data: this.formatReturn(updated),
        };
    }

    async markRefunded(adminEmail: string, returnId: string, dto: MarkRefundedDto) {
        const returnRequest = await this.prisma.return.findUnique({
            where: { id: returnId },
            include: { order: true },
        });

        if (!returnRequest) throw new NotFoundException('Return request not found');

        if (returnRequest.status !== 'ITEM_RECEIVED') {
            throw new BadRequestException(`Cannot mark as refunded for return with status: ${returnRequest.status}`);
        }

        const updated = await this.prisma.return.update({
            where: { id: returnId },
            data: {
                status: 'REFUNDED',
                refundMethod: dto.refund_method,
                refundProof: dto.refund_proof,
                refundNotes: dto.refund_notes || null,
                refundedAt: new Date(),
                refundedBy: adminEmail,
            },
        });

        try {
            await this.notificationService.notifyReturnRefunded(
                returnRequest.userId,
                returnRequest.order.orderNumber,
                returnId,
                returnRequest.refundAmount || returnRequest.order.total,
                returnRequest.order.currency,
                dto.refund_method,
                'id',
            );
        } catch (error: any) {
            this.logger.error('❌ Failed to send refunded notification', { error: error.message });
        }

        this.logger.info('✅ Return marked as refunded', { returnId, adminEmail });

        return {
            message: 'Refund marked successfully',
            data: this.formatReturn(updated),
        };
    }

    // ============================================
    // FORMATTERS
    // ============================================

    private formatReturn(r: any) {
        return {
            id: r.id,
            order_id: r.orderId,
            status: r.status,
            reason: r.reason,
            description: r.description,
            refund_bank_name: r.refundBankName,
            refund_account_number: r.refundAccountNumber,
            refund_account_name: r.refundAccountName,
            return_courier: r.returnCourier,
            return_tracking_number: r.returnTrackingNumber,
            item_sent_at: r.itemSentAt,
            admin_notes: r.adminNotes,
            reviewed_at: r.reviewedAt,
            refund_amount: r.refundAmount,
            refund_method: r.refundMethod,
            refund_proof: r.refundProof,
            refund_notes: r.refundNotes,
            refunded_at: r.refundedAt,
            cancel_reason: r.cancelReason,
            cancelled_at: r.cancelledAt,
            created_at: r.createdAt,
            updated_at: r.updatedAt,
        };
    }

    private formatReturnDetail(r: any) {
        return {
            ...this.formatReturn(r),
            images: r.images?.map((img: any) => img.imageUrl) || [],
            order: r.order
                ? {
                    order_number: r.order.orderNumber,
                    total: r.order.total,
                    currency: r.order.currency,
                }
                : undefined,
        };
    }

    private formatReturnAdmin(r: any) {
        return {
            ...this.formatReturnDetail(r),
            reviewed_by: r.reviewedBy,
            received_at: r.receivedAt,
            received_by: r.receivedBy,
            received_notes: r.receivedNotes,
            refunded_by: r.refundedBy,
            user: r.user
                ? {
                    id: r.user.id,
                    email: r.user.email,
                    name: `${r.user.firstName} ${r.user.lastName}`,
                    phone: r.user.phoneNumber,
                }
                : undefined,
            order: r.order
                ? {
                    order_number: r.order.orderNumber,
                    total: r.order.total,
                    currency: r.order.currency,
                    payment_method: r.order.paymentMethod,
                    items: r.order.items?.map((item: any) => ({
                        product_name: item.productName,
                        variant_name: item.variantName,
                        quantity: item.quantity,
                        price_per_item: item.pricePerItem,
                        subtotal: item.subtotal,
                        product_image: item.productImage,
                    })),
                }
                : undefined,
        };
    }
}