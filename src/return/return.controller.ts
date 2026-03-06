// src/return/return.controller.ts

import {
    Controller,
    Get,
    Post,
    Patch,
    Body,
    Param,
    Query,
    UseGuards,
    Req,
} from '@nestjs/common';
import { ReturnService } from './return.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ValidationService } from '../common/validation.service';
import { CreateReturnSchema } from './dto/create-return.dto';
import { ConfirmItemSentSchema } from './dto/confirm-item-sent.dto';
import { CancelReturnSchema } from './dto/cancel-return.dto';
import { ApproveReturnSchema } from './dto/approve-return.dto';
import { RejectReturnSchema } from './dto/reject-return.dto';
import { MarkItemReceivedSchema } from './dto/mark-item-received.dto';
import { MarkRefundedSchema } from './dto/mark-refunded.dto';
import { QueryReturnsSchema } from './dto/query-returns.dto';

@Controller()
export class ReturnController {
    constructor(
        private returnService: ReturnService,
        private validationService: ValidationService,
    ) {}

    // ============================================
    // USER ENDPOINTS
    // ============================================

    @Post('returns')
    @UseGuards(JwtAuthGuard)
    async createReturn(@Req() req: any, @Body() body: any) {
        const dto = this.validationService.validate(CreateReturnSchema, body);
        return this.returnService.createReturn(req.user.id, dto);
    }

    @Get('returns/my')
    @UseGuards(JwtAuthGuard)
    async getMyReturns(@Req() req: any, @Query() query: any) {
        const dto = this.validationService.validate(QueryReturnsSchema, query);
        return this.returnService.getUserReturns(req.user.id, dto);
    }

    @Get('returns/order/:orderNumber')
    @UseGuards(JwtAuthGuard)
    async getReturnByOrder(@Req() req: any, @Param('orderNumber') orderNumber: string) {
        return this.returnService.getReturnByOrderNumber(req.user.id, orderNumber);
    }

    @Post('returns/:id/confirm-sent')
    @UseGuards(JwtAuthGuard)
    async confirmItemSent(@Req() req: any, @Param('id') id: string, @Body() body: any) {
        const dto = this.validationService.validate(ConfirmItemSentSchema, body);
        return this.returnService.confirmItemSent(req.user.id, id, dto);
    }

    @Post('returns/:id/cancel')
    @UseGuards(JwtAuthGuard)
    async cancelReturn(@Req() req: any, @Param('id') id: string, @Body() body: any) {
        const dto = this.validationService.validate(CancelReturnSchema, body);
        return this.returnService.cancelReturn(req.user.id, id, dto);
    }

    // ============================================
    // ADMIN ENDPOINTS
    // ============================================

    @Get('admin/returns')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN', 'OWNER')
    async getAllReturns(@Query() query: any) {
        const dto = this.validationService.validate(QueryReturnsSchema, query);
        return this.returnService.getAllReturns(dto);
    }

    @Get('admin/returns/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN', 'OWNER')
    async getReturnDetail(@Param('id') id: string) {
        return this.returnService.getReturnDetailAdmin(id);
    }

    @Patch('admin/returns/:id/approve')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN', 'OWNER')
    async approveReturn(@Req() req: any, @Param('id') id: string, @Body() body: any) {
        const dto = this.validationService.validate(ApproveReturnSchema, body);
        return this.returnService.approveReturn(req.user.id, req.user.email, id, dto);
    }

    @Patch('admin/returns/:id/reject')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN', 'OWNER')
    async rejectReturn(@Req() req: any, @Param('id') id: string, @Body() body: any) {
        const dto = this.validationService.validate(RejectReturnSchema, body);
        return this.returnService.rejectReturn(req.user.email, id, dto);
    }

    @Patch('admin/returns/:id/received')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN', 'OWNER')
    async markItemReceived(@Req() req: any, @Param('id') id: string, @Body() body: any) {
        const dto = this.validationService.validate(MarkItemReceivedSchema, body);
        return this.returnService.markItemReceived(req.user.email, id, dto);
    }

    @Patch('admin/returns/:id/refunded')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN', 'OWNER')
    async markRefunded(@Req() req: any, @Param('id') id: string, @Body() body: any) {
        const dto = this.validationService.validate(MarkRefundedSchema, body);
        return this.returnService.markRefunded(req.user.email, id, dto);
    }
}