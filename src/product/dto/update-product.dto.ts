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
 * Gallery Image Schema for Updates
 * Supports create, update, and delete actions
 */
const GalleryImageSchema = z.object({
    id: z.string().uuid().optional(), // For existing images
    imageUrl: imageUrlValidator,
    caption: z.string().max(255).optional(),
    _action: z.enum(['create', 'update', 'delete']).optional(),
});

/**
 * Variant Schema for Updates
 * Supports update and delete actions
 */
const UpdateVariantSchema = z.object({
    id: z.string().uuid().optional(), // If provided, update existing variant
    variantName: z.string().min(1).max(100).optional(),
    sku: z.string().min(1).max(50).optional(),
    stock: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    imageUrls: z.array(imageUrlValidator).max(5).optional(),
    _action: z.enum(['update', 'delete']).optional(), // 'update' or 'delete'
});

/**
 * Main Product Schema for Updates
 * All fields are optional except arrays which need explicit undefined
 */
export const UpdateProductSchema = z.object({
    // Basic Information
    name: z.string().min(3).max(255).optional(),
    slug: z
        .string()
        .min(3)
        .max(255)
        .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens')
        .optional(),

    // Descriptions
    idDescription: z.string().min(10).max(5000).optional(),
    enDescription: z.string().min(10).max(5000).optional(),

    // Pricing
    idPrice: z.number().int().min(0).optional(),
    enPrice: z.number().min(0).optional(), // ✅ Changed: removed .int() for USD float

    // Images
    imageUrls: z
        .array(imageUrlValidator)
        .min(1, 'At least one product image is required')
        .max(5, 'Maximum 5 product images')
        .optional(),

    // Dimensions & Weight
    weight: z.number().int().min(0).optional(),
    height: z.number().int().min(0).optional(),
    length: z.number().int().min(0).optional(),
    width: z.number().int().min(0).optional(),

    // Tax
    taxRate: z.number().min(0).max(1).optional(),

    // Relations (nullable for removal)
    categoryId: z.string().uuid().nullable().optional(),
    promotionId: z.string().uuid().nullable().optional(),

    // Flags
    isFeatured: z.boolean().optional(),
    isActive: z.boolean().optional(),
    isPreOrder: z.boolean().optional(),
    preOrderDays: z.number().int().min(0).optional(),

    // Variants
    variants: z
        .array(UpdateVariantSchema)
        .max(20, 'Maximum 20 variants allowed')
        .optional(),

    // Tags
    tagIds: z.array(z.string().uuid()).optional(),

    // Gallery Images
    galleryImages: z
        .array(GalleryImageSchema)
        .max(20, 'Maximum 20 gallery images')
        .optional(),
});

export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;