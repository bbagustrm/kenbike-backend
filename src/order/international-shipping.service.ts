import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { PrismaService } from '../common/prisma.service';
import { InternationalShippingZone } from './interfaces/shipping.interface';

@Injectable()
export class InternationalShippingService {
    constructor(
        private prisma: PrismaService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    /**
     * Get shipping zone by country code
     */
    async getZoneByCountry(countryCode: string): Promise<InternationalShippingZone | null> {
        const zone = await this.prisma.shippingZone.findFirst({
            where: {
                countries: {
                    has: countryCode.toUpperCase(),
                },
                isActive: true,
            },
        });

        if (!zone) {
            return null;
        }

        return {
            id: zone.id,
            name: zone.name,
            countries: zone.countries,
            baseRate: zone.baseRate,
            perKgRate: zone.perKgRate,
            minDays: zone.minDays,
            maxDays: zone.maxDays,
        };
    }

    /**
     * Calculate international shipping cost
     * Formula: baseRate + (totalWeightKg * perKgRate)
     */
    async calculateShippingCost(
        countryCode: string,
        totalWeightGrams: number,
    ): Promise<{
        zone: InternationalShippingZone;
        cost: number;
        breakdown: {
            baseRate: number;
            weightCharge: number;
            totalWeight: number; // in kg
        };
    }> {
        const zone = await this.getZoneByCountry(countryCode);

        if (!zone) {
            throw new NotFoundException(
                `No shipping zone found for country: ${countryCode}. Please contact support.`,
            );
        }

        // Convert grams to kg (round up)
        const totalWeightKg = Math.ceil(totalWeightGrams / 1000);

        // Calculate cost
        const baseRate = zone.baseRate;
        const weightCharge = totalWeightKg * zone.perKgRate;
        const cost = baseRate + weightCharge;

        this.logger.info('🌍 International shipping calculated', {
            zone: zone.name,
            country: countryCode,
            weight: `${totalWeightKg}kg`,
            cost,
        });

        return {
            zone,
            cost,
            breakdown: {
                baseRate,
                weightCharge,
                totalWeight: totalWeightKg,
            },
        };
    }

    /**
     * Get all active shipping zones
     */
    async getAllZones(): Promise<InternationalShippingZone[]> {
        const zones = await this.prisma.shippingZone.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
        });

        return zones.map((zone) => ({
            id: zone.id,
            name: zone.name,
            countries: zone.countries,
            baseRate: zone.baseRate,
            perKgRate: zone.perKgRate,
            minDays: zone.minDays,
            maxDays: zone.maxDays,
        }));
    }

    /**
     * Get zone by ID
     */
    async getZoneById(zoneId: string): Promise<InternationalShippingZone> {
        const zone = await this.prisma.shippingZone.findUnique({
            where: { id: zoneId, isActive: true },
        });

        if (!zone) {
            throw new NotFoundException('Shipping zone not found');
        }

        return {
            id: zone.id,
            name: zone.name,
            countries: zone.countries,
            baseRate: zone.baseRate,
            perKgRate: zone.perKgRate,
            minDays: zone.minDays,
            maxDays: zone.maxDays,
        };
    }

    /**
     * Validate if country is supported
     */
    async isCountrySupported(countryCode: string): Promise<boolean> {
        const zone = await this.getZoneByCountry(countryCode);
        return zone !== null;
    }

    /**
     * Get estimated delivery days for a country
     */
    async getEstimatedDeliveryDays(countryCode: string): Promise<{ min: number; max: number }> {
        const zone = await this.getZoneByCountry(countryCode);

        if (!zone) {
            throw new NotFoundException(`Country ${countryCode} is not supported for international shipping`);
        }

        return {
            min: zone.minDays,
            max: zone.maxDays,
        };
    }
}