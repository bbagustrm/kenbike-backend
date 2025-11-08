import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { ValidationService } from '../common/validation.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AddItemDto, AddItemSchema } from './dto/add-item.dto';
import { UpdateQuantityDto, UpdateQuantitySchema } from './dto/update-quantity.dto';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
    constructor(
        private cartService: CartService,
        private validationService: ValidationService,
    ) {}

    /**
     * GET /cart
     * Get current user's cart
     */
    @Get()
    async getCart(@CurrentUser('id') userId: string) {
        return this.cartService.getCart(userId);
    }

    /**
     * POST /cart/items
     * Add item to cart
     */
    @Post('items')
    @HttpCode(HttpStatus.CREATED)
    async addItem(@CurrentUser('id') userId: string, @Body() body: AddItemDto) {
        const dto = this.validationService.validate(AddItemSchema, body);
        return this.cartService.addItem(userId, dto);
    }

    /**
     * PATCH /cart/items/:id
     * Update cart item quantity
     */
    @Patch('items/:id')
    async updateItemQuantity(
        @CurrentUser('id') userId: string,
        @Param('id') itemId: string,
        @Body() body: UpdateQuantityDto,
    ) {
        const dto = this.validationService.validate(UpdateQuantitySchema, body);
        return this.cartService.updateItemQuantity(userId, itemId, dto);
    }

    /**
     * DELETE /cart/items/:id
     * Remove item from cart
     */
    @Delete('items/:id')
    @HttpCode(HttpStatus.OK)
    async removeItem(@CurrentUser('id') userId: string, @Param('id') itemId: string) {
        return this.cartService.removeItem(userId, itemId);
    }

    /**
     * DELETE /cart
     * Clear cart
     */
    @Delete()
    @HttpCode(HttpStatus.OK)
    async clearCart(@CurrentUser('id') userId: string) {
        return this.cartService.clearCart(userId);
    }
}