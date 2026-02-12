import { z } from 'zod';
import { Role } from '@prisma/client';

export const ChangeRoleSchema = z.object({
    role: z.nativeEnum(Role),
}).refine((data) => Object.values(Role).includes(data.role), {
    message: 'Role must be one of: USER, ADMIN, OWNER',
    path: ['role'],
});
export type ChangeRoleDto = z.infer<typeof ChangeRoleSchema>;