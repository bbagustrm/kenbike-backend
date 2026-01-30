// src/review/review.controller.ts
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
    ParseIntPipe,
    DefaultValuePipe,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { ValidationService } from '../common/validation.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { CreateReviewSchema, CreateReviewDto, UpdateReviewSchema, UpdateReviewDto } from './dto/create-review.dto';
import { QueryProductReviewsSchema, QueryProductReviewsDto } from './dto/query-review.dto';

@Controller('reviews')
export class ReviewController {
    constructor(
        private reviewService: ReviewService,
        private validationService: ValidationService,
    ) {}

    // ==========================================
    // PUBLIC ENDPOINTS
    // ==========================================

    /**
     * GET /reviews/product/:slug
     * Get reviews for a product (Public)
     */
    @Public()
    @Get('product/:slug')
    async getProductReviews(
        @Param('slug') slug: string,
        @Query() query: QueryProductReviewsDto,
    ) {
        const dto = this.validationService.validate(QueryProductReviewsSchema, query);
        return this.reviewService.getProductReviews(slug, dto);
    }

    /**
     * GET /reviews/:id
     * Get single review by ID (Public)
     */
    @Public()
    @Get(':id')
    async getReviewById(@Param('id') id: string) {
        return this.reviewService.getReviewById(id);
    }

    // ==========================================
    // USER ENDPOINTS (Authenticated)
    // ==========================================

    /**
     * GET /reviews/user/pending
     * Get orders eligible for review
     */
    @UseGuards(JwtAuthGuard)
    @Get('user/pending')
    async getPendingReviews(@CurrentUser() user: CurrentUserData) {
        return this.reviewService.getPendingReviews(user.id);
    }

    /**
     * GET /reviews/user/my-reviews
     * Get user's own reviews
     */
    @UseGuards(JwtAuthGuard)
    @Get('user/my-reviews')
    async getMyReviews(
        @CurrentUser() user: CurrentUserData,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    ) {
        return this.reviewService.getUserReviews(user.id, page, limit);
    }

    /**
     * POST /reviews
     * Create a review
     */
    @UseGuards(JwtAuthGuard)
    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createReview(
        @CurrentUser() user: CurrentUserData,
        @Body() body: CreateReviewDto,
    ) {
        const dto = this.validationService.validate(CreateReviewSchema, body);
        return this.reviewService.createReview(user.id, dto);
    }

    /**
     * PATCH /reviews/:id
     * Update a review (own review only)
     */
    @UseGuards(JwtAuthGuard)
    @Patch(':id')
    async updateReview(
        @CurrentUser() user: CurrentUserData,
        @Param('id') id: string,
        @Body() body: UpdateReviewDto,
    ) {
        const dto = this.validationService.validate(UpdateReviewSchema, body);
        return this.reviewService.updateReview(user.id, id, dto);
    }

    /**
     * DELETE /reviews/:id
     * Delete a review (own review only)
     */
    @UseGuards(JwtAuthGuard)
    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    async deleteReview(
        @CurrentUser() user: CurrentUserData,
        @Param('id') id: string,
    ) {
        return this.reviewService.deleteReview(user.id, id);
    }
}