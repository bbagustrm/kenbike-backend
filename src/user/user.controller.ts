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
    ParseBoolPipe,
    UseInterceptors,
} from '@nestjs/common';
import { UserService } from './user.service';
import { ValidationService } from '../common/validation.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { GetAllUsersDto, GetAllUsersSchema } from './dto/get-all-users.dto';
import { CreateUserDto, CreateUserSchema } from './dto/create-user.dto';
import { UpdateUserDto, UpdateUserSchema } from './dto/update-user.dto';
import { ChangeRoleDto, ChangeRoleSchema } from './dto/change-role.dto';
import { ChangeStatusDto, ChangeStatusSchema } from './dto/change-status.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OWNER)
export class UserController {
    constructor(
        private userService: UserService,
        private validationService: ValidationService,
    ) {}

    /**
     * GET /admin/users
     * Get all users with pagination, filter, and search
     */
    @Get()
    async getAllUsers(@Query() query: GetAllUsersDto) {
        const dto = this.validationService.validate(GetAllUsersSchema, query);
        return this.userService.getAllUsers(dto);
    }

    /**
     * GET /admin/users/:id
     * Get user detail by ID
     */
    @Get(':id')
    async getUserById(@Param('id') userId: string) {
        return this.userService.getUserById(userId);
    }

    /**
     * POST /admin/users
     * Create new user (Admin only)
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createUser(@Body() body: CreateUserDto) {
        const dto = this.validationService.validate(CreateUserSchema, body);
        return this.userService.createUser(dto);
    }

    /**
     * PATCH /admin/users/:id
     * Update user (Admin only)
     */
    @Patch(':id')
    @UseInterceptors(
        FileInterceptor('profile_image', {
            limits: {
                fileSize: 2 * 1024 * 1024, // 2MB
            },
        }),
    )
    async updateUser(@Param('id') userId: string, @Body() body: UpdateUserDto) {
        const dto = this.validationService.validate(UpdateUserSchema, body);
        return this.userService.updateUser(userId, dto);
    }

    /**
     * PATCH /admin/users/:id/role
     * Change user role (Admin only)
     */
    @Patch(':id/role')
    async changeUserRole(@Param('id') userId: string, @Body() body: ChangeRoleDto) {
        const dto = this.validationService.validate(ChangeRoleSchema, body);
        return this.userService.changeUserRole(userId, dto);
    }

    /**
     * PATCH /admin/users/:id/status
     * Change user status - suspend/activate (Admin only)
     */
    @Patch(':id/status')
    async changeUserStatus(
        @Param('id') userId: string,
        @CurrentUser('id') currentUserId: string,
        @Body() body: ChangeStatusDto,
    ) {
        const dto = this.validationService.validate(ChangeStatusSchema, body);
        return this.userService.changeUserStatus(userId, currentUserId, dto);
    }

    /**
     * DELETE /admin/users/:id
     * Delete user (soft or hard delete) (Admin only)
     */
    @Delete(':id')
    async deleteUser(
        @Param('id') userId: string,
        @CurrentUser('id') currentUserId: string,
        @Query('permanent', new ParseBoolPipe({ optional: true })) permanent?: boolean,
    ) {
        return this.userService.deleteUser(userId, currentUserId, permanent || false);
    }

    /**
     * POST /admin/users/:id/restore
     * Restore soft deleted user (Admin only)
     */
    @Post(':id/restore')
    @HttpCode(HttpStatus.OK)
    async restoreUser(@Param('id') userId: string) {
        return this.userService.restoreUser(userId);
    }

    /**
     * POST /admin/users/:id/force-logout
     * Force logout user from all devices (Admin only)
     */
    @Post(':id/force-logout')
    @HttpCode(HttpStatus.OK)
    async forceLogoutUser(@Param('id') userId: string) {
        return this.userService.forceLogoutUser(userId);
    }
}