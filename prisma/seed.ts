import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * ============================================
 * ENHANCED DATABASE SEEDER FOR PERFORMANCE TESTING
 * ============================================
 * Creates 60+ products with realistic distribution
 * Perfect for Redis caching baseline testing
 */

async function main() {
    console.log('🌱 Starting ENHANCED database seeding for performance testing...\n');

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
    // 2. SEED CATEGORIES (6 categories)
    // ============================================
    console.log('📂 Seeding categories...');

    const categories = await Promise.all([
        prisma.category.upsert({
            where: { slug: 'road-bikes' },
            update: {},
            create: { name: 'Road Bikes', slug: 'road-bikes', isActive: true },
        }),
        prisma.category.upsert({
            where: { slug: 'mountain-bikes' },
            update: {},
            create: { name: 'Mountain Bikes', slug: 'mountain-bikes', isActive: true },
        }),
        prisma.category.upsert({
            where: { slug: 'gravel-bikes' },
            update: {},
            create: { name: 'Gravel Bikes', slug: 'gravel-bikes', isActive: true },
        }),
        prisma.category.upsert({
            where: { slug: 'city-bikes' },
            update: {},
            create: { name: 'City Bikes', slug: 'city-bikes', isActive: true },
        }),
        prisma.category.upsert({
            where: { slug: 'electric-bikes' },
            update: {},
            create: { name: 'Electric Bikes', slug: 'electric-bikes', isActive: true },
        }),
        prisma.category.upsert({
            where: { slug: 'accessories' },
            update: {},
            create: { name: 'Accessories', slug: 'accessories', isActive: true },
        }),
    ]);

    console.log(`✅ Created ${categories.length} categories\n`);

    // ============================================
    // 3. SEED TAGS (5 tags)
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
        prisma.tag.upsert({
            where: { slug: 'premium' },
            update: {},
            create: { name: 'Premium', slug: 'premium', isActive: true },
        }),
        prisma.tag.upsert({
            where: { slug: 'budget-friendly' },
            update: {},
            create: { name: 'Budget Friendly', slug: 'budget-friendly', isActive: true },
        }),
    ]);

    console.log(`✅ Created ${tags.length} tags\n`);

    // ============================================
    // 4. SEED PROMOTIONS
    // ============================================
    console.log('💰 Seeding promotions...');

    // Check if promotion already exists (no unique field other than id, so use findFirst)
    let promotion = await prisma.promotion.findFirst({
        where: { name: 'Summer Sale 2026' },
    });

    if (!promotion) {
        promotion = await prisma.promotion.create({
            data: {
                name: 'Summer Sale 2026',
                discount: 0.15,
                startDate: new Date('2026-02-01'),
                endDate: new Date('2026-03-31'),
                isActive: true,
            },
        });
        console.log('✅ Created 1 promotion');
    } else {
        console.log('✅ Promotion already exists (skipped)');
    }

    console.log('');

    // ============================================
    // 5. SEED SHIPPING ZONES
    // ============================================
    console.log('🌍 Seeding shipping zones...');

    const shippingZones = [
        {
            name: 'Zone 1 - Southeast Asia',
            countries: ['SG', 'MY', 'TH', 'PH', 'VN', 'BN', 'KH', 'LA', 'MM', 'TL'],
            baseRate: 15.0,
            perKgRate: 5.0,
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
    // 6. SEED 60+ PRODUCTS WITH VARIANTS
    // ============================================
    console.log('🚴 Seeding 60+ products (this may take a minute)...');

    const brands = ['Canyon', 'Specialized', 'Trek', 'Giant', 'Scott', 'Cannondale', 'Merida', 'BMC', 'Colnago', 'Pinarello'];
    const colors = ['Black', 'White', 'Red', 'Blue', 'Silver', 'Green', 'Orange', 'Yellow'];
    const sizes = ['XS', 'S', 'M', 'L', 'XL'];

    const productCategories = [
        { category: categories[0], name: 'Road Bikes', count: 20, priceMin: 50000000, priceMax: 150000000 },
        { category: categories[1], name: 'Mountain Bikes', count: 15, priceMin: 60000000, priceMax: 180000000 },
        { category: categories[2], name: 'Gravel Bikes', count: 12, priceMin: 55000000, priceMax: 140000000 },
        { category: categories[3], name: 'City Bikes', count: 10, priceMin: 30000000, priceMax: 80000000 },
        { category: categories[4], name: 'Electric Bikes', count: 8, priceMin: 80000000, priceMax: 250000000 },
        { category: categories[5], name: 'Accessories', count: 5, priceMin: 500000, priceMax: 10000000 },
    ];

    let totalProducts = 0;
    let featuredCount = 0;

    for (const prodCat of productCategories) {
        console.log(`  📦 Creating ${prodCat.count} ${prodCat.name}...`);

        for (let i = 1; i <= prodCat.count; i++) {
            const brand = brands[Math.floor(Math.random() * brands.length)];
            const model = `${prodCat.name.replace(' ', '-')} Model ${i}`;
            const name = `${brand} ${prodCat.name.split(' ')[0]} ${i}`;
            const slug = `${brand.toLowerCase()}-${prodCat.name.toLowerCase().replace(/\s+/g, '-')}-${i}`;

            const idPrice = Math.floor(Math.random() * (prodCat.priceMax - prodCat.priceMin) + prodCat.priceMin);
            const enPrice = parseFloat((idPrice / 15700).toFixed(2));

            const totalSold = Math.floor(Math.random() * 50);
            const totalView = Math.floor(Math.random() * 500) + 100;
            const avgRating = parseFloat((Math.random() * 1.5 + 3.5).toFixed(1));

            const isFeatured = totalProducts < 10; // First 10 products are featured
            const hasPromotion = Math.random() > 0.7; // 30% chance

            try {
                const product = await prisma.product.upsert({
                    where: { slug },
                    update: {},
                    create: {
                        name,
                        slug,
                        idDescription: `${name} adalah sepeda berkualitas tinggi dengan teknologi terkini untuk performa maksimal.`,
                        enDescription: `${name} is a high-quality bicycle with cutting-edge technology for maximum performance.`,
                        idPrice,
                        enPrice,
                        totalSold,
                        totalView,
                        avgRating,
                        weight: Math.floor(Math.random() * 5000) + 8000, // 8-13 kg
                        height: Math.floor(Math.random() * 30) + 50,
                        length: Math.floor(Math.random() * 50) + 150,
                        width: Math.floor(Math.random() * 20) + 40,
                        taxRate: 0.11,
                        categoryId: prodCat.category.id,
                        promotionId: hasPromotion ? promotion.id : null,
                        isFeatured,
                        isPreOrder: Math.random() > 0.85, // 15% pre-order
                        preOrderDays: Math.random() > 0.85 ? 30 : null,
                        isActive: true,
                    },
                });

                // Create 2-3 variants per product
                const variantCount = Math.floor(Math.random() * 2) + 2; // 2 or 3 variants
                for (let v = 0; v < variantCount; v++) {
                    const size = sizes[Math.floor(Math.random() * sizes.length)];
                    const color = colors[Math.floor(Math.random() * colors.length)];
                    const sku = `${brand.substring(0, 4).toUpperCase()}-${i}-${size}-${color.substring(0, 3).toUpperCase()}`;

                    await prisma.productVariant.upsert({
                        where: { sku },
                        update: {},
                        create: {
                            productId: product.id,
                            variantName: `Size ${size} - ${color}`,
                            sku,
                            stock: Math.floor(Math.random() * 20) + 5,
                            isActive: true,
                        },
                    });
                }

                // Assign random tags (1-2 tags per product)
                const numTags = Math.floor(Math.random() * 2) + 1;
                const randomTags = [...tags].sort(() => 0.5 - Math.random()).slice(0, numTags);

                for (const tag of randomTags) {
                    await prisma.productTag.upsert({
                        where: {
                            productId_tagId: {
                                productId: product.id,
                                tagId: tag.id,
                            },
                        },
                        update: {},
                        create: {
                            productId: product.id,
                            tagId: tag.id,
                        },
                    });
                }

                totalProducts++;
                if (isFeatured) featuredCount++;

            } catch (error) {
                console.error(`  ✗ Failed to create product: ${name}`, error.message);
            }
        }
    }

    console.log(`✅ Created ${totalProducts} products (${featuredCount} featured)\n`);

    // ============================================
    // SUMMARY
    // ============================================
    console.log('✨ ENHANCED database seeding completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   - ${users.length} users (1 OWNER, 1 ADMIN, 1 USER)`);
    console.log(`   - ${categories.length} categories`);
    console.log(`   - ${tags.length} tags`);
    console.log(`   - 1 active promotion`);
    console.log(`   - ${totalProducts} products (${featuredCount} featured)`);
    console.log(`   - ~${totalProducts * 2.5} product variants (avg 2-3 per product)`);
    console.log(`   - ~${totalProducts * 1.5} product-tag relationships`);
    console.log(`   - ${shippingZones.length} shipping zones`);
    console.log('\n🔐 Default credentials:');
    console.log('   Owner: owner@kenbike.com / password123');
    console.log('   Admin: admin@kenbike.com / password123');
    console.log('   User:  user@example.com / password123');
    console.log('\n✅ Database is ready for Redis caching performance testing!');
    console.log('📊 You can now run baseline tests with ENABLE_CACHE=false\n');
}

main()
    .catch((e) => {
        console.error('❌ Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });