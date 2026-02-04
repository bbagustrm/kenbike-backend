// src/analytics/analytics.service.ts

import { Injectable, Inject } from '@nestjs/common';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import {
    GetAnalyticsOverviewDto,
    GetRevenueAnalyticsDto,
    GetProductAnalyticsDto,
    AiInsightQueryDto,
} from './dto/analytics.dto';

@Injectable()
export class AnalyticsService {
    private readonly geminiApiKey: string;
    private readonly geminiApiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {
        this.geminiApiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
    }

    /**
     * Get Dashboard Overview Stats
     */
    async getOverview(dto: GetAnalyticsOverviewDto) {
        const now = new Date();
        let startDate: Date;
        let previousStartDate: Date;
        let previousEndDate: Date;

        switch (dto.period) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                previousStartDate = new Date(startDate);
                previousStartDate.setDate(previousStartDate.getDate() - 1);
                previousEndDate = new Date(startDate);
                break;
            case 'week':
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 7);
                previousStartDate = new Date(startDate);
                previousStartDate.setDate(previousStartDate.getDate() - 7);
                previousEndDate = new Date(startDate);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                previousStartDate = new Date(now.getFullYear() - 1, 0, 1);
                previousEndDate = new Date(now.getFullYear(), 0, 1);
                break;
            case 'month':
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                previousEndDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
        }

        // Current period stats
        const [
            totalOrders,
            paidOrders,
            totalUsers,
            newUsers,
            totalProducts,
            activeProducts,
            pendingReviews,
            lowStockProducts,
        ] = await Promise.all([
            // Total orders this period
            this.prisma.order.count({
                where: { createdAt: { gte: startDate } },
            }),
            // Paid orders (revenue generating)
            this.prisma.order.findMany({
                where: {
                    createdAt: { gte: startDate },
                    status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'] },
                },
                select: { total: true, currency: true },
            }),
            // Total users
            this.prisma.user.count({
                where: { role: 'USER', deletedAt: null },
            }),
            // New users this period
            this.prisma.user.count({
                where: {
                    role: 'USER',
                    deletedAt: null,
                    createdAt: { gte: startDate },
                },
            }),
            // Total products
            this.prisma.product.count({
                where: { deletedAt: null },
            }),
            // Active products
            this.prisma.product.count({
                where: { deletedAt: null, isActive: true },
            }),
            // Pending reviews (unanswered)
            this.prisma.review.count({
                where: {
                    replies: { none: {} },
                },
            }),
            // Low stock products (variants with stock < 5)
            this.prisma.productVariant.count({
                where: {
                    stock: { lt: 5 },
                    isActive: true,
                    deletedAt: null,
                },
            }),
        ]);

        // Previous period for comparison
        const previousPaidOrders = await this.prisma.order.findMany({
            where: {
                createdAt: { gte: previousStartDate, lt: previousEndDate },
                status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'] },
            },
            select: { total: true, currency: true },
        });

        const previousNewUsers = await this.prisma.user.count({
            where: {
                role: 'USER',
                deletedAt: null,
                createdAt: { gte: previousStartDate, lt: previousEndDate },
            },
        });

        // Calculate revenue
        const revenueIDR = paidOrders
            .filter(o => o.currency === 'IDR')
            .reduce((sum, o) => sum + o.total, 0);
        const revenueUSD = paidOrders
            .filter(o => o.currency === 'USD')
            .reduce((sum, o) => sum + o.total, 0);

        const previousRevenueIDR = previousPaidOrders
            .filter(o => o.currency === 'IDR')
            .reduce((sum, o) => sum + o.total, 0);
        const previousRevenueUSD = previousPaidOrders
            .filter(o => o.currency === 'USD')
            .reduce((sum, o) => sum + o.total, 0);

        // Calculate growth percentages
        const calcGrowth = (current: number, previous: number) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return Math.round(((current - previous) / previous) * 100);
        };

        return {
            data: {
                period: dto.period,
                orders: {
                    total: totalOrders,
                    paid: paidOrders.length,
                    growth: calcGrowth(paidOrders.length, previousPaidOrders.length),
                },
                revenue: {
                    idr: revenueIDR,
                    usd: revenueUSD,
                    idr_growth: calcGrowth(revenueIDR, previousRevenueIDR),
                    usd_growth: calcGrowth(revenueUSD, previousRevenueUSD),
                },
                users: {
                    total: totalUsers,
                    new: newUsers,
                    growth: calcGrowth(newUsers, previousNewUsers),
                },
                products: {
                    total: totalProducts,
                    active: activeProducts,
                },
                alerts: {
                    pending_reviews: pendingReviews,
                    low_stock: lowStockProducts,
                },
            },
        };
    }

    /**
     * Get Revenue Analytics with Chart Data
     */
    async getRevenueAnalytics(dto: GetRevenueAnalyticsDto) {
        const now = new Date();
        let startDate: Date;
        let groupBy: 'day' | 'week' | 'month';
        let dateFormat: string;

        switch (dto.period) {
            case '7days':
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 7);
                groupBy = 'day';
                dateFormat = 'DD MMM';
                break;
            case '90days':
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 90);
                groupBy = 'week';
                dateFormat = 'DD MMM';
                break;
            case '12months':
                startDate = new Date(now);
                startDate.setMonth(now.getMonth() - 12);
                groupBy = 'month';
                dateFormat = 'MMM YYYY';
                break;
            case '30days':
            default:
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 30);
                groupBy = 'day';
                dateFormat = 'DD MMM';
                break;
        }

        // Get orders with revenue
        const orders = await this.prisma.order.findMany({
            where: {
                createdAt: { gte: startDate },
                status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'] },
            },
            select: {
                total: true,
                currency: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
        });

        // Group by date
        const chartData: Record<string, { date: string; idr: number; usd: number; orders: number }> = {};

        orders.forEach(order => {
            let key: string;
            const date = new Date(order.createdAt);

            if (groupBy === 'day') {
                key = date.toISOString().split('T')[0];
            } else if (groupBy === 'week') {
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                key = weekStart.toISOString().split('T')[0];
            } else {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            }

            if (!chartData[key]) {
                chartData[key] = { date: key, idr: 0, usd: 0, orders: 0 };
            }

            if (order.currency === 'IDR') {
                chartData[key].idr += order.total;
            } else {
                chartData[key].usd += order.total;
            }
            chartData[key].orders += 1;
        });

        const chartArray = Object.values(chartData).sort((a, b) =>
            a.date.localeCompare(b.date)
        );

        // Calculate totals
        const totalIDR = orders.filter(o => o.currency === 'IDR').reduce((sum, o) => sum + o.total, 0);
        const totalUSD = orders.filter(o => o.currency === 'USD').reduce((sum, o) => sum + o.total, 0);
        const avgOrderValue = orders.length > 0 ? (totalIDR + totalUSD * 15700) / orders.length : 0;

        return {
            data: {
                period: dto.period,
                summary: {
                    total_idr: totalIDR,
                    total_usd: totalUSD,
                    total_orders: orders.length,
                    avg_order_value: Math.round(avgOrderValue),
                },
                chart: chartArray,
            },
        };
    }

    /**
     * Get Order Status Distribution
     */
    async getOrderStatusDistribution() {
        const statusCounts = await this.prisma.order.groupBy({
            by: ['status'],
            _count: { status: true },
        });

        const distribution = statusCounts.map(item => ({
            status: item.status,
            count: item._count.status,
        }));

        return { data: distribution };
    }

    /**
     * Get Top Products
     */
    async getTopProducts(dto: GetProductAnalyticsDto) {
        let orderBy: any;

        switch (dto.sortBy) {
            case 'revenue':
                orderBy = { totalSold: 'desc' }; // Will calculate revenue
                break;
            case 'views':
                orderBy = { totalView: 'desc' };
                break;
            case 'rating':
                orderBy = { avgRating: 'desc' };
                break;
            case 'sales':
            default:
                orderBy = { totalSold: 'desc' };
                break;
        }

        const products = await this.prisma.product.findMany({
            where: { deletedAt: null, isActive: true },
            select: {
                id: true,
                name: true,
                slug: true,
                idPrice: true,
                enPrice: true,
                totalSold: true,
                totalView: true,
                avgRating: true,
                images: {
                    orderBy: { order: 'asc' },
                    take: 1,
                },
                category: {
                    select: { name: true },
                },
            },
            orderBy,
            take: dto.limit,
        });

        const data = products.map(product => ({
            id: product.id,
            name: product.name,
            slug: product.slug,
            image: product.images[0]?.imageUrl || null,
            category: product.category?.name || 'Uncategorized',
            price_idr: product.idPrice,
            price_usd: product.enPrice,
            total_sold: product.totalSold,
            total_views: product.totalView,
            avg_rating: product.avgRating,
            estimated_revenue_idr: product.totalSold * product.idPrice,
        }));

        return { data };
    }

    /**
     * Get Recent Orders (for dashboard)
     */
    async getRecentOrders(limit: number = 10) {
        const orders = await this.prisma.order.findMany({
            select: {
                id: true,
                orderNumber: true,
                status: true,
                total: true,
                currency: true,
                createdAt: true,
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });

        const data = orders.map(order => ({
            id: order.id,
            order_number: order.orderNumber,
            status: order.status,
            total: order.total,
            currency: order.currency,
            customer_name: `${order.user.firstName} ${order.user.lastName}`,
            customer_email: order.user.email,
            created_at: order.createdAt,
        }));

        return { data };
    }

    /**
     * Get Low Stock Products
     */
    async getLowStockProducts(threshold: number = 5, limit: number = 10) {
        const variants = await this.prisma.productVariant.findMany({
            where: {
                stock: { lt: threshold },
                isActive: true,
                deletedAt: null,
                product: { deletedAt: null, isActive: true },
            },
            select: {
                id: true,
                variantName: true,
                sku: true,
                stock: true,
                product: {
                    select: {
                        id: true,
                        name: true,
                        images: {
                            orderBy: { order: 'asc' },
                            take: 1,
                        },
                    },
                },
            },
            orderBy: { stock: 'asc' },
            take: limit,
        });

        const data = variants.map(v => ({
            variant_id: v.id,
            product_id: v.product.id,
            product_name: v.product.name,
            variant_name: v.variantName,
            sku: v.sku,
            stock: v.stock,
            image: v.product.images[0]?.imageUrl || null,
        }));

        return { data };
    }

    /**
     * Get Promotion Performance
     */
    async getPromotionPerformance() {
        const now = new Date();

        const promotions = await this.prisma.promotion.findMany({
            where: {
                deletedAt: null,
                isActive: true,
                startDate: { lte: now },
                endDate: { gte: now },
            },
            include: {
                products: {
                    where: { deletedAt: null },
                    select: {
                        totalSold: true,
                        idPrice: true,
                    },
                },
            },
        });

        const data = promotions.map(promo => {
            const totalSold = promo.products.reduce((sum, p) => sum + p.totalSold, 0);
            const potentialRevenue = promo.products.reduce(
                (sum, p) => sum + p.idPrice * p.totalSold,
                0
            );
            const discountGiven = potentialRevenue * promo.discount;
            const daysRemaining = Math.ceil(
                (new Date(promo.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );

            return {
                id: promo.id,
                name: promo.name,
                discount: promo.discount,
                discount_percentage: `${(promo.discount * 100).toFixed(0)}%`,
                product_count: promo.products.length,
                total_sold: totalSold,
                potential_revenue: potentialRevenue,
                discount_given: discountGiven,
                days_remaining: daysRemaining,
                start_date: promo.startDate,
                end_date: promo.endDate,
            };
        });

        return { data };
    }

    /**
     * AI Insights with Gemini
     */
    async getAiInsights(dto: AiInsightQueryDto) {
        if (!this.geminiApiKey) {
            return {
                data: {
                    insight: 'AI Insights belum dikonfigurasi. Silakan tambahkan GEMINI_API_KEY di environment variables.',
                    suggestions: [],
                },
            };
        }

        // Get context data based on query type
        let contextData = '';

        try {
            const [overview, topProducts, recentOrders, lowStock, promotions] = await Promise.all([
                this.getOverview({ period: 'month' }),
                this.getTopProducts({ limit: 5, sortBy: 'sales' }),
                this.getRecentOrders(5),
                this.getLowStockProducts(5, 5),
                this.getPromotionPerformance(),
            ]);

            contextData = `
Data Bisnis KenBike (Toko Sepeda Online):

RINGKASAN BULAN INI:
- Total Order: ${overview.data.orders.total}
- Order Berbayar: ${overview.data.orders.paid}
- Revenue IDR: Rp ${overview.data.revenue.idr.toLocaleString('id-ID')}
- Revenue USD: $${overview.data.revenue.usd.toLocaleString('en-US')}
- Pertumbuhan Revenue: ${overview.data.revenue.idr_growth}%
- Total User: ${overview.data.users.total}
- User Baru: ${overview.data.users.new}
- Produk Aktif: ${overview.data.products.active}
- Review Pending: ${overview.data.alerts.pending_reviews}
- Produk Stok Rendah: ${overview.data.alerts.low_stock}

TOP 5 PRODUK TERLARIS:
${topProducts.data.map((p, i) => `${i + 1}. ${p.name} - Terjual: ${p.total_sold}, Revenue: Rp ${p.estimated_revenue_idr.toLocaleString('id-ID')}`).join('\n')}

PRODUK STOK RENDAH:
${lowStock.data.map(p => `- ${p.product_name} (${p.variant_name}): ${p.stock} unit`).join('\n')}

PROMOSI AKTIF:
${promotions.data.map(p => `- ${p.name}: Diskon ${p.discount_percentage}, ${p.product_count} produk, sisa ${p.days_remaining} hari`).join('\n')}
`;
        } catch (error) {
            this.logger.error('Failed to gather context data', { error });
        }

        const prompt = `Kamu adalah AI Business Analyst untuk KenBike, toko e-commerce sepeda dan spare part. 
Berikan insight bisnis dalam Bahasa Indonesia yang actionable dan specific.

${contextData}

PERTANYAAN USER: ${dto.query}

Berikan respons dalam format:
1. INSIGHT UTAMA (2-3 paragraf analisis)
2. REKOMENDASI (3-5 poin actionable)
3. METRIK YANG PERLU DIPERHATIKAN (2-3 KPI)

Gunakan data yang diberikan untuk memberikan insight yang specific dan relevan.`;

        try {
            const response = await fetch(`${this.geminiApiUrl}?key=${this.geminiApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1024,
                    },
                }),
            });

            if (!response.ok) {
                throw new Error(`Gemini API error: ${response.status}`);
            }

            const result = await response.json();
            const insight = result.candidates?.[0]?.content?.parts?.[0]?.text || 'Tidak dapat menghasilkan insight.';

            return {
                data: {
                    query: dto.query,
                    insight,
                    generated_at: new Date().toISOString(),
                },
            };
        } catch (error: any) {
            this.logger.error('AI Insight generation failed', { error: error.message });
            return {
                data: {
                    query: dto.query,
                    insight: 'Maaf, terjadi kesalahan saat menghasilkan insight. Silakan coba lagi.',
                    error: error.message,
                },
            };
        }
    }

    /**
     * Get Quick AI Summary (for dashboard)
     */
    async getQuickAiSummary() {
        if (!this.geminiApiKey) {
            return {
                data: {
                    summary: 'AI Summary belum tersedia. Konfigurasi GEMINI_API_KEY untuk mengaktifkan fitur ini.',
                },
            };
        }

        try {
            const overview = await this.getOverview({ period: 'week' });
            const lowStock = await this.getLowStockProducts(5, 3);

            const prompt = `Berikan ringkasan bisnis singkat (2-3 kalimat) dalam Bahasa Indonesia berdasarkan data minggu ini:
- Order: ${overview.data.orders.paid} (${overview.data.orders.growth > 0 ? '+' : ''}${overview.data.orders.growth}%)
- Revenue IDR: Rp ${overview.data.revenue.idr.toLocaleString('id-ID')}
- User Baru: ${overview.data.users.new}
- Stok Rendah: ${overview.data.alerts.low_stock} produk

Fokus pada: trend penting, achievement, atau warning yang perlu perhatian.`;

            const response = await fetch(`${this.geminiApiUrl}?key=${this.geminiApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.5,
                        maxOutputTokens: 200,
                    },
                }),
            });

            if (!response.ok) {
                throw new Error(`Gemini API error: ${response.status}`);
            }

            const result = await response.json();
            const summary = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

            return {
                data: {
                    summary,
                    generated_at: new Date().toISOString(),
                },
            };
        } catch (error: any) {
            this.logger.error('Quick AI Summary failed', { error: error.message });
            return {
                data: {
                    summary: 'Tidak dapat menghasilkan ringkasan AI saat ini.',
                },
            };
        }
    }
}