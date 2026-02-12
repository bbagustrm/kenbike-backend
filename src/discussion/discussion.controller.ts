// src/discussion/discussion.controller.ts
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
    Req,
} from '@nestjs/common';
import { Request } from 'express';
import { DiscussionService } from './discussion.service';
import { ValidationService } from '../common/validation.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import {
    CreateDiscussionSchema,
    CreateDiscussionDto,
    UpdateDiscussionSchema,
    UpdateDiscussionDto,
    CreateDiscussionReplySchema,
    CreateDiscussionReplyDto,
    UpdateDiscussionReplySchema,
    UpdateDiscussionReplyDto,
} from './dto/create-discussion.dto';
import {
    QueryProductDiscussionsSchema,
    QueryProductDiscussionsDto,
    AdminQueryDiscussionSchema,
    AdminQueryDiscussionDto,
} from './dto/query-discussion.dto';

@Controller('discussions')
export class DiscussionController {
    constructor(
        private discussionService: DiscussionService,
        private validationService: ValidationService,
    ) {}

    // ==========================================
    // PUBLIC ENDPOINTS
    // ==========================================

    /**
     * GET /discussions/product/:slug
     * Get discussions for a product (Public)
     * If user is logged in, includes isLiked status
     */
    @Public()
    @Get('product/:slug')
    async getProductDiscussions(
        @Param('slug') slug: string,
        @Query() query: QueryProductDiscussionsDto,
        @Req() req: Request,
    ) {
        const dto = this.validationService.validate(QueryProductDiscussionsSchema, query);
        // Get userId from request if authenticated (optional)
        const userId = (req as any).user?.id;
        return this.discussionService.getProductDiscussions(slug, dto, userId);
    }

    /**
     * GET /discussions/:id
     * Get single discussion by ID (Public)
     */
    @Public()
    @Get(':id')
    async getDiscussionById(
        @Param('id') id: string,
        @Req() req: Request,
    ) {
        const userId = (req as any).user?.id;
        return this.discussionService.getDiscussionById(id, userId);
    }

    // ==========================================
    // USER ENDPOINTS (Authenticated)
    // ==========================================

    /**
     * GET /discussions/user/my-questions
     * Get user's own questions
     */
    @UseGuards(JwtAuthGuard)
    @Get('user/my-questions')
    async getMyQuestions(
        @CurrentUser() user: CurrentUserData,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    ) {
        return this.discussionService.getUserDiscussions(user.id, page, limit);
    }

    /**
     * POST /discussions
     * Create a question
     */
    @UseGuards(JwtAuthGuard)
    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createDiscussion(
        @CurrentUser() user: CurrentUserData,
        @Body() body: CreateDiscussionDto,
    ) {
        const dto = this.validationService.validate(CreateDiscussionSchema, body);
        return this.discussionService.createDiscussion(user.id, dto);
    }

    /**
     * PATCH /discussions/:id
     * Update a question (own question only)
     */
    @UseGuards(JwtAuthGuard)
    @Patch(':id')
    async updateDiscussion(
        @CurrentUser() user: CurrentUserData,
        @Param('id') id: string,
        @Body() body: UpdateDiscussionDto,
    ) {
        const dto = this.validationService.validate(UpdateDiscussionSchema, body);
        return this.discussionService.updateDiscussion(user.id, id, dto);
    }

    /**
     * DELETE /discussions/:id
     * Delete a question (own question or admin)
     */
    @UseGuards(JwtAuthGuard)
    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    async deleteDiscussion(
        @CurrentUser() user: CurrentUserData,
        @Param('id') id: string,
    ) {
        return this.discussionService.deleteDiscussion(user.id, user.role as Role, id);
    }

    /**
     * POST /discussions/:id/reply
     * Reply to a question
     */
    @UseGuards(JwtAuthGuard)
    @Post(':id/reply')
    @HttpCode(HttpStatus.CREATED)
    async createReply(
        @CurrentUser() user: CurrentUserData,
        @Param('id') discussionId: string,
        @Body() body: CreateDiscussionReplyDto,
    ) {
        const dto = this.validationService.validate(CreateDiscussionReplySchema, body);
        return this.discussionService.createReply(user.id, discussionId, dto);
    }

    /**
     * PATCH /discussions/replies/:id
     * Update a reply (own reply only)
     */
    @UseGuards(JwtAuthGuard)
    @Patch('replies/:id')
    async updateReply(
        @CurrentUser() user: CurrentUserData,
        @Param('id') replyId: string,
        @Body() body: UpdateDiscussionReplyDto,
    ) {
        const dto = this.validationService.validate(UpdateDiscussionReplySchema, body);
        return this.discussionService.updateReply(user.id, replyId, dto);
    }

    /**
     * DELETE /discussions/replies/:id
     * Delete a reply (own reply or admin)
     */
    @UseGuards(JwtAuthGuard)
    @Delete('replies/:id')
    @HttpCode(HttpStatus.OK)
    async deleteReply(
        @CurrentUser() user: CurrentUserData,
        @Param('id') replyId: string,
    ) {
        return this.discussionService.deleteReply(user.id, user.role as Role, replyId);
    }

    /**
     * POST /discussions/:id/like
     * Toggle like on a question
     */
    @UseGuards(JwtAuthGuard)
    @Post(':id/like')
    @HttpCode(HttpStatus.OK)
    async toggleDiscussionLike(
        @CurrentUser() user: CurrentUserData,
        @Param('id') discussionId: string,
    ) {
        return this.discussionService.toggleDiscussionLike(user.id, discussionId);
    }

    /**
     * POST /discussions/replies/:id/like
     * Toggle like on a reply
     */
    @UseGuards(JwtAuthGuard)
    @Post('replies/:id/like')
    @HttpCode(HttpStatus.OK)
    async toggleReplyLike(
        @CurrentUser() user: CurrentUserData,
        @Param('id') replyId: string,
    ) {
        return this.discussionService.toggleReplyLike(user.id, replyId);
    }
}

// ==========================================
// ADMIN CONTROLLER
// ==========================================

@Controller('admin/discussions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OWNER)
export class AdminDiscussionController {
    constructor(
        private discussionService: DiscussionService,
        private validationService: ValidationService,
    ) {}

    /**
     * GET /admin/discussions
     * Get all discussions with filters
     */
    @Get()
    async getAllDiscussions(@Query() query: AdminQueryDiscussionDto) {
        const dto = this.validationService.validate(AdminQueryDiscussionSchema, query);
        return this.discussionService.getAllDiscussions(dto);
    }

    /**
     * GET /admin/discussions/:id
     * Get single discussion by ID
     */
    @Get(':id')
    async getDiscussionById(@Param('id') id: string) {
        return this.discussionService.getDiscussionById(id);
    }

    /**
     * DELETE /admin/discussions/:id
     * Delete a discussion (admin can delete any)
     */
    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    async deleteDiscussion(
        @CurrentUser() admin: CurrentUserData,
        @Param('id') id: string,
    ) {
        return this.discussionService.deleteDiscussion(admin.id, admin.role as Role, id);
    }

    /**
     * DELETE /admin/discussions/replies/:id
     * Delete a reply (admin can delete any)
     */
    @Delete('replies/:id')
    @HttpCode(HttpStatus.OK)
    async deleteReply(
        @CurrentUser() admin: CurrentUserData,
        @Param('id') replyId: string,
    ) {
        return this.discussionService.deleteReply(admin.id, admin.role as Role, replyId);
    }
}