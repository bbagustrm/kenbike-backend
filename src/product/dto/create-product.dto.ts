import { z } from 'zod';

// ✅ Add Gallery Image Schema
const GalleryImageSchema = z.object({
    imageUrl: z.string().url('Invalid image URL'),
    caption: z.string().max(255).optional(),
});

const VariantImageSchema = z.object({
    imageUrl: z.string().url('Invalid image URL'),
});

const CreateVariantSchema = z.object({
    variantName: z.string().min(1, 'Variant name is required').max(100),
    sku: z.string().min(1, 'SKU is required').max(50),
    stock: z.number().int().min(0, 'Stock must be at least 0'),
    isActive: z.boolean().optional().default(true),
    imageUrls: z.array(z.string().url()).max(5, 'Maximum 5 images per variant').optional().default([]),
});

export const CreateProductSchema = z.object({
    name: z.string().min(3, 'Name must be at least 3 characters').max(255),
    slug: z
        .string()
        .min(3)
        .max(255)
        .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens'),
    idDescription: z.string().min(10, 'Indonesian description must be at least 10 characters').max(5000),
    enDescription: z.string().min(10, 'English description must be at least 10 characters').max(5000),
    idPrice: z.number().int().min(0, 'Indonesian price must be at least 0'),
    enPrice: z.number().int().min(0, 'English price must be at least 0'),
    imageUrls: z.array(z.string().url()).min(1, 'At least one product image is required').max(5, 'Maximum 5 product images'),
    weight: z.number().int().min(0).optional().default(0),
    height: z.number().int().min(0).optional().default(0),
    length: z.number().int().min(0).optional().default(0),
    width: z.number().int().min(0).optional().default(0),
    taxRate: z.number().min(0).max(1).optional().default(0.11),
    categoryId: z.string().uuid().optional(),
    promotionId: z.string().uuid().optional(),
    isFeatured: z.boolean().optional().default(false),
    isPreOrder: z.boolean().optional().default(false),
    preOrderDays: z.number().int().min(0).optional().default(0),
    variants: z
        .array(CreateVariantSchema)
        .min(1, 'At least one variant is required')
        .max(20, 'Maximum 20 variants allowed'),
    tagIds: z.array(z.string().uuid()).optional().default([]),
    galleryImages: z
        .array(GalleryImageSchema)
        .max(20, 'Maximum 20 gallery images')
        .optional()
        .default([]),
});

export type CreateProductDto = z.infer<typeof CreateProductSchema>;