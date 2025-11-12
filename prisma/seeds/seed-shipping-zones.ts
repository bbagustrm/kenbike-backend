import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * International Shipping Zones
 * Based on common e-commerce zone-based pricing
 */
const shippingZones = [
    {
        name: 'Zone 1 - Southeast Asia',
        countries: ['SG', 'MY', 'TH', 'PH', 'VN', 'BN', 'KH', 'LA', 'MM', 'TL'],
        baseRate: 150000, // IDR 150k base
        perKgRate: 50000, // IDR 50k per kg
        minDays: 5,
        maxDays: 10,
        isActive: true,
    },
    {
        name: 'Zone 2 - East Asia',
        countries: ['CN', 'HK', 'TW', 'KR', 'JP', 'MO'],
        baseRate: 200000, // IDR 200k base
        perKgRate: 75000, // IDR 75k per kg
        minDays: 7,
        maxDays: 14,
        isActive: true,
    },
    {
        name: 'Zone 3 - South Asia & Middle East',
        countries: ['IN', 'PK', 'BD', 'LK', 'NP', 'BT', 'MV', 'AE', 'SA', 'KW', 'QA', 'BH', 'OM', 'JO', 'IL', 'LB'],
        baseRate: 250000, // IDR 250k base
        perKgRate: 100000, // IDR 100k per kg
        minDays: 10,
        maxDays: 20,
        isActive: true,
    },
    {
        name: 'Zone 4 - Oceania',
        countries: ['AU', 'NZ', 'PG', 'FJ', 'NC', 'PF', 'WS', 'TO', 'VU'],
        baseRate: 300000, // IDR 300k base
        perKgRate: 125000, // IDR 125k per kg
        minDays: 10,
        maxDays: 21,
        isActive: true,
    },
    {
        name: 'Zone 5 - Europe',
        countries: ['GB', 'FR', 'DE', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'PT', 'GR', 'IE', 'RO', 'HU'],
        baseRate: 350000, // IDR 350k base
        perKgRate: 150000, // IDR 150k per kg
        minDays: 14,
        maxDays: 28,
        isActive: true,
    },
    {
        name: 'Zone 6 - Americas',
        countries: ['US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'VE', 'CR', 'PA'],
        baseRate: 400000, // IDR 400k base
        perKgRate: 175000, // IDR 175k per kg
        minDays: 14,
        maxDays: 30,
        isActive: true,
    },
    {
        name: 'Zone 7 - Africa',
        countries: ['ZA', 'EG', 'NG', 'KE', 'MA', 'GH', 'TZ', 'UG', 'ET', 'DZ'],
        baseRate: 450000, // IDR 450k base
        perKgRate: 200000, // IDR 200k per kg
        minDays: 15,
        maxDays: 35,
        isActive: true,
    },
];

async function main() {
    console.log('🌍 Seeding shipping zones...');

    for (const zone of shippingZones) {
        const created = await prisma.shippingZone.upsert({
            where: { name: zone.name },
            update: {
                countries: zone.countries,
                baseRate: zone.baseRate,
                perKgRate: zone.perKgRate,
                minDays: zone.minDays,
                maxDays: zone.maxDays,
                isActive: zone.isActive,
            },
            create: zone,
        });

        console.log(`✅ ${created.name} - ${created.countries.length} countries`);
    }

    console.log('✨ Shipping zones seeded successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Error seeding shipping zones:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });