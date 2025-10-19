import {
    Injectable,
    NotFoundException,
    ConflictException,
    ForbiddenException,
    Inject,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PasswordUtil } from '../utils/password.util';
import { PaginationUtil } from '../utils/pagination.util';
import { GetAllUsersDto } from './dto/get-all-users.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangeRoleDto } from './dto/change-role.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import {LocalStorageService} from "../common/storage/local-storage.service";

@Injectable()
export class UserService {
    constructor(
        private prisma: PrismaService,
        private localStorageService: LocalStorageService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    /**
     * Get all users with pagination, filter, and search
     */
    async getAllUsers(dto: GetAllUsersDto) {
        const { page, limit, role, search, sort_by, order } = dto;

        // Validate pagination params
        const { page: validPage, limit: validLimit } = PaginationUtil.validateParams(page, limit);

        // Build where clause
        const where: any = {
            deletedAt: null, // Exclude soft deleted users
        };

        if (role) {
            where.role = role;
        }

        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { username: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Get total count
        const total = await this.prisma.user.count({ where });

        // Get users
        const users = await this.prisma.user.findMany({
            where,
            select: {
                id: true,
                email: true,
                username: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
                profileImage: true,
                phoneNumber: true,
                country: true,
                createdAt: true,
            },
            skip: PaginationUtil.getSkip(validPage, validLimit),
            take: validLimit,
            orderBy: {
                [sort_by === 'created_at' ? 'createdAt' : sort_by]: order,
            },
        });

        // Transform response
        const data = users.map((user) => ({
            id: user.id,
            email: user.email,
            username: user.username,
            first_name: user.firstName,
            last_name: user.lastName,
            role: user.role,
            is_active: user.isActive,
            profile_image: user.profileImage,
            phone_number: user.phoneNumber,
            country: user.country,
            created_at: user.createdAt,
        }));

        return {
            meta: PaginationUtil.generateMeta(total, validPage, validLimit),
            data,
        };
    }

    /**
     * Get user by ID
     */
    async getUserById(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId, deletedAt: null },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                email: true,
                phoneNumber: true,
                address: true,
                country: true,
                profileImage: true,
                role: true,
                isActive: true,
                lastLogin: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return {
            data: {
                id: user.id,
                first_name: user.firstName,
                last_name: user.lastName,
                username: user.username,
                email: user.email,
                phone_number: user.phoneNumber,
                address: user.address,
                country: user.country,
                profile_image: user.profileImage,
                role: user.role,
                is_active: user.isActive,
                last_login: user.lastLogin,
                created_at: user.createdAt,
                updated_at: user.updatedAt,
            },
        };
    }

    /**
     * Create new user (Admin only)
     */
    async createUser(dto: CreateUserDto) {
        // Check if email already exists
        const existingEmail = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (existingEmail) {
            throw new ConflictException({
                message: 'User creation failed',
                errors: [
                    {
                        field: 'email',
                        message: 'Email already registered',
                    },
                ],
            });
        }

        // Check if username already exists
        const existingUsername = await this.prisma.user.findUnique({
            where: { username: dto.username },
        });

        if (existingUsername) {
            throw new ConflictException({
                message: 'User creation failed',
                errors: [
                    {
                        field: 'username',
                        message: 'Username already taken',
                    },
                ],
            });
        }

        // Hash password
        const hashedPassword = await PasswordUtil.hashPassword(dto.password);

        // Create user
        const user = await this.prisma.user.create({
            data: {
                firstName: dto.first_name,
                lastName: dto.last_name,
                username: dto.username,
                email: dto.email,
                password: hashedPassword,
                phoneNumber: dto.phone_number,
                country: dto.country,
                address: dto.address,
                role: dto.role,
            },
            select: {
                id: true,
                email: true,
                username: true,
                role: true,
                createdAt: true,
            },
        });

        this.logger.info(`New user created by admin: ${user.email}`);

        return {
            message: 'User created successfully',
            data: user,
        };
    }

    /**
     * Update user (Admin only)
     */
    async updateUser(userId: string, dto: UpdateUserDto) {
        // Check if user exists
        const existingUser = await this.prisma.user.findUnique({
            where: { id: userId, deletedAt: null },
        });

        if (!existingUser) {
            throw new NotFoundException('User not found');
        }

        // Check if email is being changed and already exists
        if (dto.email && dto.email !== existingUser.email) {
            const emailExists = await this.prisma.user.findUnique({
                where: { email: dto.email },
            });

            if (emailExists) {
                throw new ConflictException({
                    message: 'Update failed',
                    errors: [
                        {
                            field: 'email',
                            message: 'Email already registered',
                        },
                    ],
                });
            }
        }

        // Update user
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: {
                ...(dto.first_name && { firstName: dto.first_name }),
                ...(dto.last_name && { lastName: dto.last_name }),
                ...(dto.email && { email: dto.email }),
                ...(dto.phone_number && { phoneNumber: dto.phone_number }),
                ...(dto.address && { address: dto.address }),
                ...(dto.country && { country: dto.country }),
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phoneNumber: true,
                address: true,
                country: true,
                updatedAt: true,
            },
        });

        this.logger.info(`User updated by admin: ${user.email}`);

        return {
            message: 'User updated successfully',
            data: {
                id: user.id,
                first_name: user.firstName,
                last_name: user.lastName,
                email: user.email,
                phone_number: user.phoneNumber,
                address: user.address,
                country: user.country,
                updated_at: user.updatedAt,
            },
        };
    }

    /**
     * Change user role
     */
    async changeUserRole(userId: string, dto: ChangeRoleDto) {
        // Check if user exists
        const user = await this.prisma.user.findUnique({
            where: { id: userId, deletedAt: null },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Update role
        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: { role: dto.role },
            select: {
                id: true,
                email: true,
                role: true,
                updatedAt: true,
            },
        });

        this.logger.info(`User role changed: ${user.email} -> ${dto.role}`);

        return {
            message: 'User role updated successfully',
            data: updatedUser,
        };
    }

    /**
     * Change user status (suspend/activate)
     */
    async changeUserStatus(userId: string, currentUserId: string, dto: ChangeStatusDto) {
        // Check if user exists
        const user = await this.prisma.user.findUnique({
            where: { id: userId, deletedAt: null },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Prevent suspending yourself
        if (userId === currentUserId) {
            throw new ForbiddenException('Cannot change your own account status');
        }

        // Update status
        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: {
                isActive: dto.is_active,
                ...((!dto.is_active && {
                        suspendedAt: new Date(),
                        suspendedReason: dto.reason || 'No reason provided',
                    }) ||
                    (dto.is_active && {
                        suspendedAt: null,
                        suspendedReason: null,
                    })),
            },
            select: {
                id: true,
                email: true,
                isActive: true,
                suspendedReason: true,
                suspendedAt: true,
                updatedAt: true,
            },
        });

        // If suspended, revoke all tokens
        if (!dto.is_active) {
            await this.prisma.refreshToken.deleteMany({
                where: { userId },
            });
        }

        this.logger.info(`User status changed: ${user.email} -> ${dto.is_active ? 'Active' : 'Suspended'}`);

        return {
            message: 'User status updated successfully',
            data: {
                id: updatedUser.id,
                email: updatedUser.email,
                is_active: updatedUser.isActive,
                suspended_reason: updatedUser.suspendedReason,
                suspended_at: updatedUser.suspendedAt,
                updated_at: updatedUser.updatedAt,
            },
        };
    }

    /**
     * Delete user (soft or hard delete)
     */
    async deleteUser(userId: string, currentUserId: string, permanent: boolean = false) {
        // Check if user exists
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user || user.deletedAt) {
            throw new NotFoundException('User not found');
        }

        // Prevent deleting yourself
        if (userId === currentUserId) {
            throw new ForbiddenException('Cannot delete your own account');
        }

        // Prevent deleting other admins/owners
        if (user.role === 'ADMIN' || user.role === 'OWNER') {
            throw new ForbiddenException('Cannot delete other admin/owner accounts');
        }

        if (permanent) {
            // Hard delete
            await this.prisma.user.delete({
                where: { id: userId },
            });
            this.logger.info(`User permanently deleted: ${user.email}`);
        } else {
            // Soft delete
            await this.prisma.user.update({
                where: { id: userId },
                data: { deletedAt: new Date() },
            });
            this.logger.info(`User soft deleted: ${user.email}`);
        }

        // Revoke all tokens
        await this.prisma.refreshToken.deleteMany({
            where: { userId },
        });

        return {
            message: 'User deleted successfully',
        };
    }

    /**
     * Force logout user from all devices
     */
    async forceLogoutUser(userId: string) {
        // Check if user exists
        const user = await this.prisma.user.findUnique({
            where: { id: userId, deletedAt: null },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Delete all refresh tokens
        await this.prisma.refreshToken.deleteMany({
            where: { userId },
        });

        this.logger.info(`User force logged out: ${user.email}`);

        return {
            message: 'User has been logged out from all devices',
        };
    }
}