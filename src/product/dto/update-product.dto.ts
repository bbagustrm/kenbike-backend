import { z } from 'zod';

const GalleryImageSchema = z.object({
    id: z.string().uuid().optional(), // For existing images
    imageUrl: z.string().url('Invalid image URL'),
    caption: z.string().max(255).optional(),
    _action: z.enum(['create', 'update', 'delete']).optional(),
});

const UpdateVariantSchema = z.object({
    id: z.string().uuid().optional(),
    variantName: z.string().min(1).max(100).optional(),
    sku: z.string().min(1).max(50).optional(),
    stock: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    imageUrls: z.array(z.string().url()).max(5).optional(),
    _action: z.enum(['update', 'delete']).optional(),
});

export const UpdateProductSchema = z.object({
    name: z.string().min(3).max(255).optional(),
    slug: z
        .string()
        .min(3)
        .max(255)
        .regex(/^[a-z0-9-]+$/)
        .optional(),
    idDescription: z.string().min(10).max(5000).optional(),
    enDescription: z.string().min(10).max(5000).optional(),
    idPrice: z.number().int().min(0).optional(),
    enPrice: z.number().int().min(0).optional(),
    imageUrls: z.array(z.string().url()).min(1).max(5).optional(),
    weight: z.number().int().min(0).optional(),
    height: z.number().int().min(0).optional(),
    length: z.number().int().min(0).optional(),
    width: z.number().int().min(0).optional(),
    taxRate: z.number().min(0).max(1).optional(),
    categoryId: z.string().uuid().nullable().optional(),
    promotionId: z.string().uuid().nullable().optional(),
    isFeatured: z.boolean().optional(),
    isActive: z.boolean().optional(),
    isPreOrder: z.boolean().optional(),
    preOrderDays: z.number().int().min(0).optional(),
    variants: z.array(UpdateVariantSchema).max(20).optional(),
    tagIds: z.array(z.string().uuid()).optional(),
    galleryImages: z.array(GalleryImageSchema).max(20).optional(),
});

export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;