// src/review/admin-review.controller.ts
import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { ValidationService } from '../common/validation.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import {
    CreateReviewReplySchema,
    CreateReviewReplyDto,
    UpdateReviewReplySchema,
    UpdateReviewReplyDto,
} from './dto/create-review-reply.dto';
import { AdminQueryReviewSchema, AdminQueryReviewDto } from './dto/query-review.dto';

@Controller('admin/reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OWNER)
export class AdminReviewController {
    constructor(
        private reviewService: ReviewService,
        private validationService: ValidationService,
    ) {}

    // ==========================================
    // ADMIN ENDPOINTS
    // ==========================================

    /**
     * GET /admin/reviews
     * Get all reviews with filters
     */
    @Get()
    async getAllReviews(@Query() query: AdminQueryReviewDto) {
        const dto = this.validationService.validate(AdminQueryReviewSchema, query);
        return this.reviewService.getAllReviews(dto);
    }

    /**
     * GET /admin/reviews/:id
     * Get single review by ID
     */
    @Get(':id')
    async getReviewById(@Param('id') id: string) {
        return this.reviewService.getReviewById(id);
    }

    /**
     * POST /admin/reviews/:id/reply
     * Reply to a review
     */
    @Post(':id/reply')
    @HttpCode(HttpStatus.CREATED)
    async replyToReview(
        @CurrentUser() admin: CurrentUserData,
        @Param('id') reviewId: string,
        @Body() body: CreateReviewReplyDto,
    ) {
        const dto = this.validationService.validate(CreateReviewReplySchema, body);
        return this.reviewService.replyToReview(admin.id, reviewId, dto);
    }

    /**
     * PATCH /admin/reviews/replies/:id
     * Update a reply
     */
    @Patch('replies/:id')
    async updateReply(
        @CurrentUser() admin: CurrentUserData,
        @Param('id') replyId: string,
        @Body() body: UpdateReviewReplyDto,
    ) {
        const dto = this.validationService.validate(UpdateReviewReplySchema, body);
        return this.reviewService.updateReply(admin.id, replyId, dto);
    }

    /**
     * DELETE /admin/reviews/replies/:id
     * Delete a reply
     */
    @Delete('replies/:id')
    @HttpCode(HttpStatus.OK)
    async deleteReply(
        @CurrentUser() admin: CurrentUserData,
        @Param('id') replyId: string,
    ) {
        return this.reviewService.deleteReply(admin.id, replyId);
    }

    /**
     * DELETE /admin/reviews/:id
     * Delete a review (admin can delete any review)
     */
    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    async deleteReview(
        @CurrentUser() admin: CurrentUserData,
        @Param('id') reviewId: string,
    ) {
        return this.reviewService.adminDeleteReview(admin.id, reviewId);
    }
}