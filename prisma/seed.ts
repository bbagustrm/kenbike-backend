import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * ============================================
 * COMPREHENSIVE DATABASE SEEDER
 * ============================================
 * Seeds all tables with realistic test data
 */

async function main() {
    console.log('🌱 Starting database seeding...\n');

    // ============================================
    // 1. SEED USERS
    // ============================================
    console.log('👥 Seeding users...');

    const hashedPassword = await bcrypt.hash('password123', 10);

    const users = await Promise.all([
        prisma.user.upsert({
            where: { email: 'owner@kenbike.com' },
            update: {},
            create: {
                firstName: 'Super',
                lastName: 'Admin',
                username: 'superadmin',
                email: 'owner@kenbike.com',
                password: hashedPassword,
                phoneNumber: '+6281234567890',
                role: Role.OWNER,
                country: 'ID',
                province: 'Jawa Tengah',
                city: 'Pati',
                district: 'Juwana',
                postalCode: '59185',
                address: 'Jl Mangkudipuro No 269',
                isProfileComplete: true,
                isEmailVerified: true,
            },
        }),
        prisma.user.upsert({
            where: { email: 'admin@kenbike.com' },
            update: {},
            create: {
                firstName: 'Admin',
                lastName: 'Kenbike',
                username: 'admin',
                email: 'admin@kenbike.com',
                password: hashedPassword,
                phoneNumber: '+6281234567891',
                role: Role.ADMIN,
                country: 'ID',
                isProfileComplete: true,
                isEmailVerified: true,
            },
        }),
        prisma.user.upsert({
            where: { email: 'user@example.com' },
            update: {},
            create: {
                firstName: 'John',
                lastName: 'Doe',
                username: 'johndoe',
                email: 'user@example.com',
                password: hashedPassword,
                phoneNumber: '+6281234567892',
                role: Role.USER,
                country: 'ID',
                province: 'DKI Jakarta',
                city: 'Jakarta Selatan',
                district: 'Kebayoran Baru',
                postalCode: '12180',
                address: 'Jl. Senopati No. 123',
                isProfileComplete: true,
                isEmailVerified: true,
            },
        }),
    ]);

    console.log(`✅ Created ${users.length} users\n`);

    // ============================================
    // 2. SEED CATEGORIES
    // ============================================
    console.log('📂 Seeding categories...');

    const categories = await Promise.all([
        prisma.category.upsert({
            where: { slug: 'road-bikes' },
            update: {},
            create: {
                name: 'Road Bikes',
                slug: 'road-bikes',
                isActive: true,
            },
        }),
        prisma.category.upsert({
            where: { slug: 'mountain-bikes' },
            update: {},
            create: {
                name: 'Mountain Bikes',
                slug: 'mountain-bikes',
                isActive: true,
            },
        }),
        prisma.category.upsert({
            where: { slug: 'gravel-bikes' },
            update: {},
            create: {
                name: 'Gravel Bikes',
                slug: 'gravel-bikes',
                isActive: true,
            },
        }),
        prisma.category.upsert({
            where: { slug: 'accessories' },
            update: {},
            create: {
                name: 'Accessories',
                slug: 'accessories',
                isActive: true,
            },
        }),
    ]);

    console.log(`✅ Created ${categories.length} categories\n`);

    // ============================================
    // 3. SEED TAGS
    // ============================================
    console.log('🏷️  Seeding tags...');

    const tags = await Promise.all([
        prisma.tag.upsert({
            where: { slug: 'best-seller' },
            update: {},
            create: { name: 'Best Seller', slug: 'best-seller', isActive: true },
        }),
        prisma.tag.upsert({
            where: { slug: 'new-arrival' },
            update: {},
            create: { name: 'New Arrival', slug: 'new-arrival', isActive: true },
        }),
        prisma.tag.upsert({
            where: { slug: 'limited-edition' },
            update: {},
            create: { name: 'Limited Edition', slug: 'limited-edition', isActive: true },
        }),
    ]);

    console.log(`✅ Created ${tags.length} tags\n`);

    // ============================================
    // 4. SEED PROMOTIONS
    // ============================================
    console.log('💰 Seeding promotions...');

    const now = new Date();
    const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days

    // Check if promotion already exists
    const existingPromo = await prisma.promotion.findFirst({
        where: { name: 'Summer Sale 2026' },
    });

    let promotion;
    if (existingPromo) {
        promotion = existingPromo;
        console.log('✅ Promotion already exists (skipped)');
    } else {
        promotion = await prisma.promotion.create({
            data: {
                name: 'Summer Sale 2026',
                discount: 0.15, // 15% off
                startDate: now,
                endDate: futureDate,
                isActive: true,
            },
        });
        console.log('✅ Created 1 promotion');
    }

    const promotions = [promotion];
    console.log('');

    // ============================================
    // 5. SEED PRODUCTS
    // ============================================
    console.log('🚴 Seeding products...');

    const product1 = await prisma.product.upsert({
        where: { slug: 'canyon-ultimate-cf-slx-9' },
        update: {},
        create: {
            name: 'Canyon Ultimate CF SLX 9',
            slug: 'canyon-ultimate-cf-slx-9',
            idDescription: 'Sepeda balap carbon fiber tingkat profesional dengan Shimano Ultegra Di2',
            enDescription: 'Professional-grade carbon fiber road bike with Shimano Ultegra Di2',
            idPrice: 85000000,
            enPrice: 5414.0, // ~$5414 USD
            totalSold: 15,
            totalView: 250,
            avgRating: 4.8,
            weight: 7500, // 7.5 kg
            height: 55,
            length: 175,
            width: 45,
            taxRate: 0.11,
            categoryId: categories[0].id, // Road Bikes
            promotionId: promotions[0].id,
            isActive: true,
            isFeatured: true,
        },
    });

    const product2 = await prisma.product.upsert({
        where: { slug: 'specialized-stumpjumper-expert' },
        update: {},
        create: {
            name: 'Specialized Stumpjumper Expert',
            slug: 'specialized-stumpjumper-expert',
            idDescription: 'MTB full suspension dengan teknologi SWAT dan Brain suspension',
            enDescription: 'Full suspension MTB with SWAT technology and Brain suspension',
            idPrice: 95000000,
            enPrice: 6051.0,
            totalSold: 8,
            totalView: 180,
            avgRating: 4.9,
            weight: 12500, // 12.5 kg
            height: 60,
            length: 185,
            width: 65,
            taxRate: 0.11,
            categoryId: categories[1].id, // Mountain Bikes
            isActive: true,
            isFeatured: true,
        },
    });

    const product3 = await prisma.product.upsert({
        where: { slug: 'trek-domane-sl-6' },
        update: {},
        create: {
            name: 'Trek Domane SL 6',
            slug: 'trek-domane-sl-6',
            idDescription: 'Endurance road bike dengan IsoSpeed untuk kenyamanan maksimal',
            enDescription: 'Endurance road bike with IsoSpeed for maximum comfort',
            idPrice: 72000000,
            enPrice: 4586.0,
            totalSold: 12,
            totalView: 320,
            avgRating: 4.7,
            weight: 8200,
            height: 56,
            length: 178,
            width: 46,
            taxRate: 0.11,
            categoryId: categories[0].id, // Road Bikes
            isActive: true,
        },
    });

    console.log(`✅ Created 3 products\n`);

    // ============================================
    // 6. SEED PRODUCT VARIANTS
    // ============================================
    console.log('🎨 Seeding product variants...');

    const variants = await Promise.all([
        // Canyon Ultimate variants
        prisma.productVariant.upsert({
            where: { sku: 'CANYON-ULT-M-BLK' },
            update: {},
            create: {
                productId: product1.id,
                variantName: 'Size M - Stealth Black',
                sku: 'CANYON-ULT-M-BLK',
                stock: 5,
                isActive: true,
            },
        }),
        prisma.productVariant.upsert({
            where: { sku: 'CANYON-ULT-L-BLK' },
            update: {},
            create: {
                productId: product1.id,
                variantName: 'Size L - Stealth Black',
                sku: 'CANYON-ULT-L-BLK',
                stock: 3,
                isActive: true,
            },
        }),
        // Specialized Stumpjumper variants
        prisma.productVariant.upsert({
            where: { sku: 'SPEC-STUMP-M-RED' },
            update: {},
            create: {
                productId: product2.id,
                variantName: 'Size M - Gloss Red',
                sku: 'SPEC-STUMP-M-RED',
                stock: 4,
                isActive: true,
            },
        }),
        // Trek Domane variants
        prisma.productVariant.upsert({
            where: { sku: 'TREK-DOM-M-BLU' },
            update: {},
            create: {
                productId: product3.id,
                variantName: 'Size M - Matte Blue',
                sku: 'TREK-DOM-M-BLU',
                stock: 6,
                isActive: true,
            },
        }),
    ]);

    console.log(`✅ Created ${variants.length} product variants\n`);

    // ============================================
    // 7. SEED PRODUCT TAGS
    // ============================================
    console.log('🔗 Seeding product tags...');

    await prisma.productTag.createMany({
        data: [
            {
                productId: product1.id,
                tagId: tags[0].id, // Best Seller
            },
            {
                productId: product2.id,
                tagId: tags[1].id, // New Arrival
            },
        ],
        skipDuplicates: true, // Skip if already exists
    });

    console.log(`✅ Linked products to tags\n`);

    // ============================================
    // 8. SEED SHIPPING ZONES
    // ============================================
    console.log('🌍 Seeding shipping zones...');

    const shippingZones = [
        {
            name: 'Zone 1 - Southeast Asia',
            countries: ['SG', 'MY', 'TH', 'PH', 'VN', 'BN', 'KH', 'LA', 'MM', 'TL'],
            baseRate: 15.0, // USD
            perKgRate: 5.0, // USD per kg
            minDays: 5,
            maxDays: 10,
            isActive: true,
        },
        {
            name: 'Zone 2 - East Asia',
            countries: ['CN', 'HK', 'TW', 'KR', 'JP', 'MO'],
            baseRate: 20.0,
            perKgRate: 7.5,
            minDays: 7,
            maxDays: 14,
            isActive: true,
        },
        {
            name: 'Zone 3 - Oceania',
            countries: ['AU', 'NZ', 'PG', 'FJ'],
            baseRate: 30.0,
            perKgRate: 12.5,
            minDays: 10,
            maxDays: 21,
            isActive: true,
        },
        {
            name: 'Zone 4 - Europe',
            countries: ['GB', 'FR', 'DE', 'IT', 'ES', 'NL', 'BE', 'CH'],
            baseRate: 35.0,
            perKgRate: 15.0,
            minDays: 14,
            maxDays: 28,
            isActive: true,
        },
        {
            name: 'Zone 5 - Americas',
            countries: ['US', 'CA', 'MX', 'BR', 'AR'],
            baseRate: 40.0,
            perKgRate: 17.5,
            minDays: 14,
            maxDays: 30,
            isActive: true,
        },
    ];

    for (const zone of shippingZones) {
        await prisma.shippingZone.upsert({
            where: { name: zone.name },
            update: zone,
            create: zone,
        });
    }

    console.log(`✅ Created ${shippingZones.length} shipping zones\n`);

    // ============================================
    // SUMMARY
    // ============================================
    console.log('✨ Database seeding completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   - ${users.length} users (1 OWNER, 1 ADMIN, 1 USER)`);
    console.log(`   - ${categories.length} categories`);
    console.log(`   - ${tags.length} tags`);
    console.log(`   - ${promotions.length} promotions`);
    console.log(`   - 3 products`);
    console.log(`   - ${variants.length} product variants`);
    console.log(`   - ${shippingZones.length} shipping zones`);
    console.log('\n🔐 Default credentials:');
    console.log('   Owner: owner@kenbike.com / password123');
    console.log('   Admin: admin@kenbike.com / password123');
    console.log('   User:  user@example.com / password123\n');
}

main()
    .catch((e) => {
        console.error('❌ Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });