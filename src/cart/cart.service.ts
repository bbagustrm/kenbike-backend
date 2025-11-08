import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Inject,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AddItemDto } from './dto/add-item.dto';
import { UpdateQuantityDto } from './dto/update-quantity.dto';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CartService {
    private readonly maxCartItems: number;

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {
        this.maxCartItems = parseInt(
            this.configService.get<string>('CART_MAX_ITEMS') || '30',
            10,
        );
    }

    /**
     * GET CART
     * Get user's cart with all items
     */
    async getCart(userId: string) {
        // Find or create cart
        let cart = await this.prisma.cart.findUnique({
            where: { userId },
            include: {
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                                idPrice: true,
                                enPrice: true,
                                isActive: true,
                                deletedAt: true,
                                images: {
                                    orderBy: { order: 'asc' },
                                    take: 1,
                                    select: {
                                        imageUrl: true,
                                    },
                                },
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
                                        isActive: true,
                                    },
                                },
                            },
                        },
                        variant: {
                            select: {
                                id: true,
                                variantName: true,
                                sku: true,
                                stock: true,
                                isActive: true,
                                deletedAt: true,
                                images: {
                                    take: 1,
                                    select: {
                                        imageUrl: true,
                                    },
                                },
                            },
                        },
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                },
            },
        });

        // Create cart if doesn't exist
        if (!cart) {
            cart = await this.prisma.cart.create({
                data: { userId },
                include: {
                    items: {
                        include: {
                            product: {
                                select: {
                                    id: true,
                                    name: true,
                                    slug: true,
                                    idPrice: true,
                                    enPrice: true,
                                    isActive: true,
                                    deletedAt: true,
                                    images: {
                                        orderBy: { order: 'asc' },
                                        take: 1,
                                        select: {
                                            imageUrl: true,
                                        },
                                    },
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
                                            isActive: true,
                                        },
                                    },
                                },
                            },
                            variant: {
                                select: {
                                    id: true,
                                    variantName: true,
                                    sku: true,
                                    stock: true,
                                    isActive: true,
                                    deletedAt: true,
                                    images: {
                                        take: 1,
                                        select: {
                                            imageUrl: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });
        }

        // Transform response
        const items = cart.items.map((item) => ({
            id: item.id,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            product: {
                id: item.product.id,
                name: item.product.name,
                slug: item.product.slug,
                idPrice: item.product.idPrice,
                enPrice: item.product.enPrice,
                imageUrl: item.product.images[0]?.imageUrl || null,
                isActive: item.product.isActive,
                isDeleted: item.product.deletedAt !== null,
                category: item.product.category,
                promotion: item.product.promotion,
            },
            variant: {
                id: item.variant.id,
                variantName: item.variant.variantName,
                sku: item.variant.sku,
                stock: item.variant.stock,
                isActive: item.variant.isActive,
                isDeleted: item.variant.deletedAt !== null,
                imageUrl: item.variant.images[0]?.imageUrl || null,
            },
            subtotal: item.product.idPrice * item.quantity,
            isAvailable:
                item.product.isActive &&
                item.product.deletedAt === null &&
                item.variant.isActive &&
                item.variant.deletedAt === null &&
                item.variant.stock >= item.quantity,
            createdAt: item.createdAt,
        }));

        // Calculate summary
        const summary = this.calculateCartSummary(items);

        return {
            data: {
                id: cart.id,
                userId: cart.userId,
                items,
                summary,
                createdAt: cart.createdAt,
                updatedAt: cart.updatedAt,
            },
        };
    }

    /**
     * ADD ITEM TO CART
     */
    async addItem(userId: string, dto: AddItemDto) {
        // Validate variant exists and is active
        const variant = await this.prisma.productVariant.findUnique({
            where: { id: dto.variantId },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        idPrice: true,
                        enPrice: true,
                        isActive: true,
                        deletedAt: true,
                        images: {
                            orderBy: { order: 'asc' },
                            take: 1,
                        },
                    },
                },
            },
        });

        if (!variant || variant.deletedAt) {
            throw new NotFoundException('Product variant not found');
        }

        if (!variant.isActive) {
            throw new BadRequestException({
                message: 'Cannot add item to cart',
                errors: [
                    {
                        field: 'variantId',
                        message: 'Product variant is not active',
                    },
                ],
            });
        }

        if (!variant.product.isActive || variant.product.deletedAt) {
            throw new BadRequestException({
                message: 'Cannot add item to cart',
                errors: [
                    {
                        field: 'variantId',
                        message: 'Product is not available',
                    },
                ],
            });
        }

        // Check stock availability
        if (variant.stock < dto.quantity) {
            throw new BadRequestException({
                message: 'Insufficient stock',
                errors: [
                    {
                        field: 'quantity',
                        message: `Requested quantity (${dto.quantity}) exceeds available stock (${variant.stock})`,
                    },
                ],
            });
        }

        // Get or create cart
        let cart = await this.prisma.cart.findUnique({
            where: { userId },
            include: {
                items: true,
            },
        });

        if (!cart) {
            cart = await this.prisma.cart.create({
                data: { userId },
                include: {
                    items: true,
                },
            });
        }

        // Check max items limit
        if (cart.items.length >= this.maxCartItems) {
            throw new BadRequestException({
                message: 'Cart limit reached',
                errors: [
                    {
                        field: 'cart',
                        message: `Cannot add more than ${this.maxCartItems} items to cart`,
                    },
                ],
            });
        }

        // Check if item already in cart
        const existingItem = await this.prisma.cartItem.findUnique({
            where: {
                cartId_variantId: {
                    cartId: cart.id,
                    variantId: dto.variantId,
                },
            },
        });

        let cartItem: { id: string; createdAt: Date; updatedAt: Date; productId: string; variantId: string; cartId: string; quantity: number; };

        if (existingItem) {
            // Update quantity
            const newQuantity = existingItem.quantity + dto.quantity;

            if (variant.stock < newQuantity) {
                throw new BadRequestException({
                    message: 'Insufficient stock',
                    errors: [
                        {
                            field: 'quantity',
                            message: `Total quantity (${newQuantity}) exceeds available stock (${variant.stock})`,
                        },
                    ],
                });
            }

            cartItem = await this.prisma.cartItem.update({
                where: { id: existingItem.id },
                data: { quantity: newQuantity },
            });

            this.logger.info(`📦 Cart item quantity updated: ${variant.sku} -> ${newQuantity}`);
        } else {
            // Create new item
            cartItem = await this.prisma.cartItem.create({
                data: {
                    cartId: cart.id,
                    productId: variant.productId,
                    variantId: dto.variantId,
                    quantity: dto.quantity,
                },
            });

            this.logger.info(`➕ Item added to cart: ${variant.sku}`);
        }

        return {
            message: 'Item added to cart successfully',
            data: {
                id: cartItem.id,
                cartId: cartItem.cartId,
                productId: cartItem.productId,
                variantId: cartItem.variantId,
                quantity: cartItem.quantity,
                product: {
                    id: variant.product.id,
                    name: variant.product.name,
                    idPrice: variant.product.idPrice,
                    enPrice: variant.product.enPrice,
                    imageUrl: variant.product.images[0]?.imageUrl || null,
                },
                variant: {
                    id: variant.id,
                    variantName: variant.variantName,
                    sku: variant.sku,
                    stock: variant.stock,
                },
                subtotal: variant.product.idPrice * cartItem.quantity,
                createdAt: cartItem.createdAt,
            },
        };
    }

    /**
     * UPDATE CART ITEM QUANTITY
     */
    async updateItemQuantity(userId: string, itemId: string, dto: UpdateQuantityDto) {
        const item = await this.prisma.cartItem.findUnique({
            where: { id: itemId },
            include: {
                cart: true,
                variant: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                idPrice: true,
                                enPrice: true,
                            },
                        },
                    },
                },
            },
        });

        if (!item || item.cart.userId !== userId) {
            throw new NotFoundException('Cart item not found');
        }

        // If quantity is 0, delete the item
        if (dto.quantity === 0) {
            await this.prisma.cartItem.delete({
                where: { id: itemId },
            });

            this.logger.info(`🗑️ Cart item removed: ${item.variant.sku}`);

            return {
                message: 'Cart item removed successfully',
            };
        }

        // Check stock availability
        if (item.variant.stock < dto.quantity) {
            throw new BadRequestException({
                message: 'Insufficient stock',
                errors: [
                    {
                        field: 'quantity',
                        message: `Requested quantity (${dto.quantity}) exceeds available stock (${item.variant.stock})`,
                    },
                ],
            });
        }

        // Update quantity
        const updated = await this.prisma.cartItem.update({
            where: { id: itemId },
            data: { quantity: dto.quantity },
        });

        this.logger.info(
            `🔄 Cart item quantity updated: ${item.variant.sku} -> ${dto.quantity}`,
        );

        return {
            message: 'Cart item updated successfully',
            data: {
                id: updated.id,
                quantity: updated.quantity,
                subtotal: item.variant.product.idPrice * updated.quantity,
                variant: {
                    id: item.variant.id,
                    stock: item.variant.stock,
                },
                updatedAt: updated.updatedAt,
            },
        };
    }

    /**
     * REMOVE ITEM FROM CART
     */
    async removeItem(userId: string, itemId: string) {
        const item = await this.prisma.cartItem.findUnique({
            where: { id: itemId },
            include: {
                cart: true,
                variant: true,
            },
        });

        if (!item || item.cart.userId !== userId) {
            throw new NotFoundException('Cart item not found');
        }

        await this.prisma.cartItem.delete({
            where: { id: itemId },
        });

        this.logger.info(`🗑️ Cart item removed: ${item.variant.sku}`);

        return {
            message: 'Item removed from cart successfully',
        };
    }

    /**
     * CLEAR CART
     */
    async clearCart(userId: string) {
        const cart = await this.prisma.cart.findUnique({
            where: { userId },
        });

        if (!cart) {
            return {
                message: 'Cart is already empty',
                data: { removedItems: 0 },
            };
        }

        const deleted = await this.prisma.cartItem.deleteMany({
            where: { cartId: cart.id },
        });

        this.logger.info(`🧹 Cart cleared: ${deleted.count} items removed`);

        return {
            message: 'Cart cleared successfully',
            data: { removedItems: deleted.count },
        };
    }

    /**
     * CALCULATE CART SUMMARY
     */
    private calculateCartSummary(items: any[]) {
        const totalItems = items.length;
        const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
        const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
        const unavailableItems = items.filter((item) => !item.isAvailable).length;

        return {
            totalItems,
            totalQuantity,
            subtotal,
            unavailableItems,
            hasUnavailableItems: unavailableItems > 0,
        };
    }
}