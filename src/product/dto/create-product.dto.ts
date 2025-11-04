import { z } from 'zod';

const VariantSchema = z.object({
    variantName: z.string().min(2).max(100),
    sku: z.string().min(3).max(50).regex(/^[a-zA-Z0-9-_]+$/),
    stock: z.number().int().min(0),
    isActive: z.boolean().optional().default(true),
    imageUrls: z.array(z.string().url()),
});

export const CreateProductSchema = z.object({
    name: z.string().min(3).max(255),
    slug: z.string().min(3).max(255).regex(/^[a-z0-9-]+$/),
    idDescription: z.string().max(15000),
    enDescription: z.string().max(15000),
    idPrice: z.number().int().min(0),
    enPrice: z.number().int().min(0),

    imageUrls: z.array(z.string().url()).min(1, 'At least one image is required'),

    weight: z.number().int().min(0),
    height: z.number().int().min(0),
    length: z.number().int().min(0),
    width: z.number().int().min(0),
    taxRate: z.number().min(0).max(1).optional().default(0),
    categoryId: z.string().uuid().optional(),
    promotionId: z.string().uuid().optional(),
    isFeatured: z.boolean().optional().default(false),
    isPreOrder: z.boolean().optional().default(false),
    preOrderDays: z.number().int().min(0).optional().default(0),
    variants: z.array(VariantSchema),
    tagIds: z.array(z.string().uuid()).optional(),
});

export type CreateProductDto = z.infer<typeof CreateProductSchema>;
export type VariantDto = z.infer<typeof VariantSchema>;