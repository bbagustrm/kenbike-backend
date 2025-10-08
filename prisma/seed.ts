import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { seedConfig } from './seed-config';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seed...');

    // Seed Admin
    const adminPassword = await bcrypt.hash(seedConfig.admin.password, 10);
    const admin = await prisma.user.upsert({
        where: { email: seedConfig.admin.email },
        update: {},
        create: {
            ...seedConfig.admin,
            password: adminPassword,
            role: 'ADMIN',
            isActive: true,
        },
    });
    console.log('✅ Admin created:', admin.email);

    // Seed Owner
    const ownerPassword = await bcrypt.hash(seedConfig.owner.password, 10);
    const owner = await prisma.user.upsert({
        where: { email: seedConfig.owner.email },
        update: {},
        create: {
            ...seedConfig.owner,
            password: ownerPassword,
            role: 'OWNER',
            isActive: true,
        },
    });
    console.log('✅ Owner created:', owner.email);

    // Seed User
    const userPassword = await bcrypt.hash(seedConfig.user.password, 10);
    const user = await prisma.user.upsert({
        where: { email: seedConfig.user.email },
        update: {},
        create: {
            ...seedConfig.user,
            password: userPassword,
            role: 'USER',
            isActive: true,
        },
    });
    console.log('✅ User created:', user.email);

    console.log('🎉 Seed completed!');
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });