import { z } from 'zod';

/**
 * Custom URL validator that accepts both relative and absolute URLs
 * Accepts:
 * - /uploads/products/uuid.webp (relative path)
 * - http://localhost:3000/uploads/products/uuid.webp (full URL dev)
 * - https://api.kenbike.store/uploads/products/uuid.webp (full URL prod)
 */
const imageUrlValidator = z.string().refine(
    (url) => {
        // Accept relative paths starting with /uploads/
        if (url.startsWith('/uploads/')) {
            return true;
        }
        // Accept full URLs
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    },
    { message: 'Invalid image URL. Must be a valid URL or relative path starting with /uploads/' }
);

/**
 * Gallery Image Schema
 * For product gallery images with optional captions
 */
const GalleryImageSchema = z.object({
    imageUrl: imageUrlValidator,
    caption: z.string().max(255).optional(),
});

/**
 * Variant Schema
 * For product variants (sizes, colors, etc.)
 */
const CreateVariantSchema = z.object({
    variantName: z.string().min(1, 'Variant name is required').max(100),
    sku: z.string().min(1, 'SKU is required').max(50),
    stock: z.number().int().min(0, 'Stock must be at least 0'),
    isActive: z.boolean().optional().default(true),
    imageUrls: z
        .array(imageUrlValidator)
        .max(5, 'Maximum 5 images per variant')
        .optional()
        .default([]),
});

/**
 * Main Product Schema for Creation
 */
export const CreateProductSchema = z.object({
    // Basic Information
    name: z.string().min(3, 'Name must be at least 3 characters').max(255),
    slug: z
        .string()
        .min(3)
        .max(255)
        .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens'),

    // Descriptions
    idDescription: z
        .string()
        .min(10, 'Indonesian description must be at least 10 characters')
        .max(5000),
    enDescription: z
        .string()
        .min(10, 'English description must be at least 10 characters')
        .max(5000),

    // Pricing
    idPrice: z.number().int().min(0, 'Indonesian price must be at least 0'),
    enPrice: z.number().min(0, 'USD price must be at least 0'),

    // Images
    imageUrls: z
        .array(imageUrlValidator)
        .min(1, 'At least one product image is required')
        .max(5, 'Maximum 5 product images'),

    // Dimensions & Weight
    weight: z.number().int().min(0).optional().default(0),
    height: z.number().int().min(0).optional().default(0),
    length: z.number().int().min(0).optional().default(0),
    width: z.number().int().min(0).optional().default(0),

    // Tax
    taxRate: z.number().min(0).max(1).optional().default(0.11),

    // Relations
    categoryId: z.string().uuid().optional(),
    promotionId: z.string().uuid().optional(),

    // Flags
    isFeatured: z.boolean().optional().default(false),
    isPreOrder: z.boolean().optional().default(false),
    preOrderDays: z.number().int().min(0).optional().default(0),

    // Variants (Required)
    variants: z
        .array(CreateVariantSchema)
        .min(1, 'At least one variant is required')
        .max(20, 'Maximum 20 variants allowed'),

    // Tags
    tagIds: z.array(z.string().uuid()).optional().default([]),

    // Gallery Images
    galleryImages: z
        .array(GalleryImageSchema)
        .max(20, 'Maximum 20 gallery images')
        .optional()
        .default([]),
});

export type CreateProductDto = z.infer<typeof CreateProductSchema>;