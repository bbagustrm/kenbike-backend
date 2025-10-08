import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const hashedPassword = await bcrypt.hash('Admin123!', 10);

    await prisma.user.upsert({
        where: { email: 'admin@store.com' },
        update: {},
        create: {
            firstName: 'Admin',
            lastName: 'Store',
            username: 'admin_store',
            email: 'admin@store.com',
            password: hashedPassword,
            role: 'ADMIN',
            phoneNumber: '+628123456789',
            country: 'Indonesia',
        },
    });

    console.log('✅ Admin user created');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });