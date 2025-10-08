import { config } from 'dotenv';

config();

export const seedConfig = {
    admin: {
        firstName: process.env.SEED_ADMIN_FIRST_NAME || 'Admin',
        lastName: process.env.SEED_ADMIN_LAST_NAME || 'Store',
        username: process.env.SEED_ADMIN_USERNAME || 'admin_store',
        email: process.env.SEED_ADMIN_EMAIL || 'admin@store.com',
        password: process.env.SEED_ADMIN_PASSWORD || 'Admin123!',
        phoneNumber: process.env.SEED_ADMIN_PHONE || '+628123456789',
        country: process.env.SEED_ADMIN_COUNTRY || 'Indonesia',
        address: process.env.SEED_ADMIN_ADDRESS || 'Jl. Admin No. 1, Jakarta',
    },
    owner: {
        firstName: process.env.SEED_OWNER_FIRST_NAME || 'Owner',
        lastName: process.env.SEED_OWNER_LAST_NAME || 'Store',
        username: process.env.SEED_OWNER_USERNAME || 'owner_store',
        email: process.env.SEED_OWNER_EMAIL || 'owner@store.com',
        password: process.env.SEED_OWNER_PASSWORD || 'Owner123!',
        phoneNumber: process.env.SEED_OWNER_PHONE || '+628987654321',
        country: process.env.SEED_OWNER_COUNTRY || 'Indonesia',
        address: process.env.SEED_OWNER_ADDRESS || 'Jl. Owner No. 1, Jakarta',
    },
    user: {
        firstName: process.env.SEED_USER_FIRST_NAME || 'John',
        lastName: process.env.SEED_USER_LAST_NAME || 'Doe',
        username: process.env.SEED_USER_USERNAME || 'johndoe',
        email: process.env.SEED_USER_EMAIL || 'user@example.com',
        password: process.env.SEED_USER_PASSWORD || 'User123!',
        phoneNumber: process.env.SEED_USER_PHONE || '+628111222333',
        country: process.env.SEED_USER_COUNTRY || 'Indonesia',
        address: process.env.SEED_USER_ADDRESS || 'Jl. User No. 1, Bandung',
    },
};