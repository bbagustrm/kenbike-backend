import { registerAs } from '@nestjs/config';

export default registerAs('supabase', () => ({
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_ANON_KEY || '',
    bucketName: process.env.SUPABASE_BUCKET_NAME || 'store-images',
    publicUrl: process.env.SUPABASE_PUBLIC_URL || '',
}));