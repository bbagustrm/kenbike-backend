# 🚚 Shipping Integration Documentation

**Version:** 1.0.0  
**Last Updated:** January 16, 2025

---

## **Table of Contents**
- [Overview](#overview)
- [Biteship Integration (Domestic)](#biteship-integration-domestic)
- [Manual International Shipping](#manual-international-shipping)
- [Shipping Zone Management](#shipping-zone-management)

---

## **Overview**

Sistem shipping terintegrasi dengan 2 metode:

### **1. Biteship API** (Domestic - Indonesia)
- **Use Case**: Pengiriman domestik dalam Indonesia
- **Couriers**: JNE, TIKI, SiCepat, J&T, Pos Indonesia, AnterAja
- **Features**: Real-time rates, tracking, automatic AWB generation

### **2. Manual Zone-Based** (International)
- **Use Case**: Pengiriman internasional
- **Method**: Zone-based pricing (Asia, Europe, Americas, etc.)
- **Courier**: Pos Indonesia International

---

# **Biteship Integration (Domestic)**

## **Architecture**

```
Calculate Shipping (Checkout)
       ↓
Call Biteship Rates API
       ├─ Send origin (warehouse)
       ├─ Send destination (customer)
       ├─ Send items (weight, dimensions)
       └─ Get available couriers & rates
       ↓
Display courier options to user
       ↓
User selects courier
       ↓
Create Order (with selected courier)
       ↓
Admin confirms order
       ↓
Call Biteship Create Order API
       ├─ Generate AWB number
       ├─ Schedule pickup
       └─ Get tracking ID
       ↓
Order shipped
       ↓
Track shipment via Biteship API
```

---

## **1. Installation**

```bash
npm install axios
```

---

## **2. Configuration**

**Environment Variables:**
```env
# Biteship Configuration
BITESHIP_API_KEY=biteship_test.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiS2VuYmlrZSBTdG9yZSIsInVzZXJJZCI6IjY4MmMyNjhjNzQ0YjBmMDAxMjNhZmE0MiIsImlhdCI6MTc2MjMzODY5Nn0.T5wrDELRgMYkd7Wh1pumMRn32C7KQ9UIjg11vaSVgZg
BITESHIP_BASE_URL=https://api.biteship.com/v1

# Warehouse Origin Address
WAREHOUSE_ADDRESS=Jl Mangkudipuro Ds Growong Kidul RT2 RW 2 Kecamatan Juwana
WAREHOUSE_CITY=Juwana, Kab Pati
WAREHOUSE_POSTAL_CODE=59185
WAREHOUSE_LATITUDE=-6.7114
WAREHOUSE_LONGITUDE=111.1366

# Available Couriers (comma-separated)
BITESHIP_COURIERS=jne,tiki,sicepat,jnt,pos,anteraja
```

**Production Changes:**
```env
# Production
BITESHIP_API_KEY=biteship_live.YOUR_PRODUCTION_KEY
```

---

## **3. Get Shipping Rates**

**File: `src/shipping/biteship.service.ts`**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class BiteshipService {
  private readonly client: AxiosInstance;
  private readonly logger = new Logger(BiteshipService.name);

  constructor(private configService: ConfigService) {
    this.client = axios.create({
      baseURL: this.configService.get('BITESHIP_BASE_URL'),
      headers: {
        Authorization: this.configService.get('BITESHIP_API_KEY'),
        'Content-Type': 'application/json',
      },
    });
  }

  async getRates(destination: any, items: any[]) {
    try {
      // Calculate total weight from items
      const totalWeight = items.reduce((sum, item) => {
        return sum + (item.weight || 0) * item.quantity;
      }, 0);

      // Prepare items for Biteship
      const biteshipItems = items.map((item) => ({
        name: item.name,
        description: item.description || '',
        value: item.price,
        quantity: item.quantity,
        weight: item.weight, // in grams
        length: item.length, // in cm
        width: item.width,
        height: item.height,
      }));

      const requestBody = {
        origin_postal_code: parseInt(
          this.configService.get('WAREHOUSE_POSTAL_CODE'),
        ),
        destination_postal_code: parseInt(destination.postalCode),
        couriers: this.configService.get('BITESHIP_COURIERS'),
        items: biteshipItems,
      };

      this.logger.log('Requesting rates from Biteship');
      this.logger.debug('Request body:', requestBody);

      const response = await this.client.post('/rates/couriers', requestBody);

      // Transform response to our format
      const couriers = this.transformRatesResponse(response.data);

      return {
        totalWeight,
        couriers,
      };
    } catch (error) {
      this.logger.error('Failed to get rates from Biteship', error.response?.data || error);
      throw new Error('Failed to calculate shipping rates');
    }
  }

  private transformRatesResponse(biteshipData: any) {
    const courierMap = {
      jne: 'JNE',
      tiki: 'TIKI',
      sicepat: 'SiCepat',
      jnt: 'J&T',
      pos: 'Pos Indonesia',
      anteraja: 'AnterAja',
    };

    const serviceMap = {
      // JNE services
      reg: 'Reguler',
      oke: 'OKE',
      yes: 'YES',
      
      // TIKI services
      'eco': 'ECO',
      'reg': 'Regular',
      
      // SiCepat services
      'reguler': 'Reguler',
      'gokil': 'GOKIL',
      
      // J&T services
      'ez': 'EZ',
      
      // Pos Indonesia
      'pos reguler': 'Pos Reguler',
      'pos cargo': 'Pos Cargo',
      
      // AnterAja
      'reguler': 'Reguler',
    };

    // Group by courier
    const groupedCouriers = {};

    biteshipData.pricing.forEach((pricing) => {
      const courier = pricing.courier_code;
      const service = pricing.courier_service_code;

      if (!groupedCouriers[courier]) {
        groupedCouriers[courier] = {
          courier: courier,
          courierName: courierMap[courier] || courier.toUpperCase(),
          services: [],
        };
      }

      groupedCouriers[courier].services.push({
        service: service,
        serviceName: serviceMap[service] || service,
        price: pricing.price,
        estimatedDays: this.parseEstimatedDays(pricing.min_day, pricing.max_day),
        minDay: pricing.min_day,
        maxDay: pricing.max_day,
      });
    });

    return Object.values(groupedCouriers);
  }

  private parseEstimatedDays(minDay: number, maxDay: number): string {
    if (minDay === maxDay) {
      return `${minDay} ${minDay === 1 ? 'day' : 'days'}`;
    }
    return `${minDay}-${maxDay} days`;
  }

  async createOrder(orderData: any) {
    try {
      const requestBody = {
        shipper_contact_name: this.configService.get('WAREHOUSE_CONTACT_NAME') || 'Kenbike Store',
        shipper_contact_phone: this.configService.get('WAREHOUSE_PHONE') || '081234567890',
        shipper_contact_email: this.configService.get('WAREHOUSE_EMAIL') || '[email protected]',
        shipper_organization: 'Kenbike Store',
        origin_contact_name: this.configService.get('WAREHOUSE_CONTACT_NAME') || 'Kenbike Store',
        origin_contact_phone: this.configService.get('WAREHOUSE_PHONE') || '081234567890',
        origin_address: this.configService.get('WAREHOUSE_ADDRESS'),
        origin_postal_code: parseInt(this.configService.get('WAREHOUSE_POSTAL_CODE')),
        origin_note: 'Warehouse',
        destination_contact_name: orderData.recipientName,
        destination_contact_phone: orderData.recipientPhone,
        destination_address: orderData.shippingAddress,
        destination_postal_code: parseInt(orderData.shippingPostalCode),
        destination_note: orderData.shippingNotes || '',
        courier_company: orderData.courier,
        courier_type: orderData.service,
        courier_insurance: orderData.insuranceAmount || 0,
        delivery_type: 'now',
        order_note: `Order: ${orderData.orderNumber}`,
        items: orderData.items.map((item) => ({
          name: item.productName,
          description: item.variantName,
          value: item.pricePerItem,
          quantity: item.quantity,
          weight: item.weight,
          length: item.length,
          width: item.width,
          height: item.height,
        })),
      };

      this.logger.log(`Creating Biteship order for: ${orderData.orderNumber}`);

      const response = await this.client.post('/orders', requestBody);

      return {
        biteshipOrderId: response.data.id,
        trackingNumber: response.data.courier.tracking_id,
        waybillId: response.data.courier.waybill_id,
        status: response.data.status,
      };
    } catch (error) {
      this.logger.error('Failed to create Biteship order', error.response?.data || error);
      throw new Error('Failed to create shipment');
    }
  }

  async trackOrder(biteshipOrderId: string) {
    try {
      const response = await this.client.get(`/orders/${biteshipOrderId}`);

      return {
        trackingNumber: response.data.courier.tracking_id,
        courier: response.data.courier.company,
        status: response.data.status,
        history: response.data.courier.history || [],
        estimatedDelivery: response.data.delivery.datetime,
      };
    } catch (error) {
      this.logger.error(`Failed to track order: ${biteshipOrderId}`, error);
      throw new Error('Failed to get tracking information');
    }
  }
}
```

---

## **4. Biteship Service Codes**

```typescript
// File: src/shipping/biteship.constants.ts

export const BITESHIP_COURIERS = {
  JNE: {
    code: 'jne',
    name: 'JNE',
    services: {
      REG: { code: 'reg', name: 'Reguler' },
      OKE: { code: 'oke', name: 'OKE' },
      YES: { code: 'yes', name: 'YES' },
    },
  },
  TIKI: {
    code: 'tiki',
    name: 'TIKI',
    services: {
      ECO: { code: 'eco', name: 'ECO' },
      REG: { code: 'reg', name: 'Regular' },
      ONS: { code: 'ons', name: 'Over Night Service' },
    },
  },
  SICEPAT: {
    code: 'sicepat',
    name: 'SiCepat',
    services: {
      REG: { code: 'reguler', name: 'Reguler' },
      GOKIL: { code: 'gokil', name: 'GOKIL' },
    },
  },
  JNT: {
    code: 'jnt',
    name: 'J&T',
    services: {
      EZ: { code: 'ez', name: 'EZ' },
    },
  },
  POS: {
    code: 'pos',
    name: 'Pos Indonesia',
    services: {
      REG: { code: 'pos reguler', name: 'Pos Reguler' },
      CARGO: { code: 'pos cargo', name: 'Pos Cargo' },
    },
  },
  ANTERAJA: {
    code: 'anteraja',
    name: 'AnterAja',
    services: {
      REG: { code: 'reguler', name: 'Reguler' },
    },
  },
};
```

---

# **Manual International Shipping**

## **Architecture**

```
User selects international destination
       ↓
Determine shipping zone
       ├─ Asia
       ├─ Europe
       ├─ Americas
       └─ Other
       ↓
Calculate shipping cost
       ├─ Base rate (0-1kg)
       └─ Additional rate per kg
       ↓
Display shipping cost & estimated delivery
       ↓
User confirms order
       ↓
Admin processes order manually
       ├─ Prepare shipment
       ├─ Go to Pos Indonesia
       ├─ Input tracking number manually
       └─ Update order status
```

---

## **1. Shipping Zone Configuration**

**Database Seeder: `prisma/seeds/shipping-zones.seed.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedShippingZones() {
  const zones = [
    {
      name: 'Asia & Oceania',
      countries: [
        'Singapore', 'Malaysia', 'Thailand', 'Vietnam', 'Philippines',
        'Brunei', 'Myanmar', 'Cambodia', 'Laos', 'Japan', 'South Korea',
        'China', 'Hong Kong', 'Taiwan', 'India', 'Sri Lanka', 'Bangladesh',
        'Pakistan', 'Australia', 'New Zealand', 'Papua New Guinea',
      ].join(','),
      baseRate: 150000, // Rp 150.000 for first kg
      perKgRate: 50000, // Rp 50.000 per additional kg
      minDays: 7,
      maxDays: 14,
      isActive: true,
    },
    {
      name: 'Europe',
      countries: [
        'United Kingdom', 'France', 'Germany', 'Italy', 'Spain', 'Netherlands',
        'Belgium', 'Switzerland', 'Austria', 'Sweden', 'Norway', 'Denmark',
        'Finland', 'Poland', 'Czech Republic', 'Portugal', 'Greece', 'Ireland',
      ].join(','),
      baseRate: 250000, // Rp 250.000 for first kg
      perKgRate: 80000, // Rp 80.000 per additional kg
      minDays: 14,
      maxDays: 21,
      isActive: true,
    },
    {
      name: 'Americas',
      countries: [
        'United States', 'Canada', 'Mexico', 'Brazil', 'Argentina', 'Chile',
        'Colombia', 'Peru', 'Venezuela',
      ].join(','),
      baseRate: 300000, // Rp 300.000 for first kg
      perKgRate: 100000, // Rp 100.000 per additional kg
      minDays: 14,
      maxDays: 21,
      isActive: true,
    },
    {
      name: 'Middle East & Africa',
      countries: [
        'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Turkey',
        'Egypt', 'South Africa', 'Kenya', 'Nigeria', 'Morocco',
      ].join(','),
      baseRate: 280000, // Rp 280.000 for first kg
      perKgRate: 90000, // Rp 90.000 per additional kg
      minDays: 14,
      maxDays: 21,
      isActive: true,
    },
  ];

  for (const zone of zones) {
    await prisma.shippingZone.upsert({
      where: { name: zone.name },
      update: zone,
      create: zone,
    });
  }

  console.log('✅ Shipping zones seeded successfully');
}

seedShippingZones()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## **2. Calculate International Shipping**

**File: `src/shipping/international.service.ts`**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';

@Injectable()
export class InternationalShippingService {
  private readonly logger = new Logger(InternationalShippingService.name);

  constructor(private prisma: PrismaService) {}

  async calculateShipping(country: string, totalWeight: number) {
    // Find zone for country
    const zone = await this.findZoneByCountry(country);

    if (!zone) {
      throw new Error(`Shipping to ${country} is not available`);
    }

    // Calculate cost
    const weightInKg = totalWeight / 1000; // Convert grams to kg
    const additionalWeight = Math.max(0, Math.ceil(weightInKg) - 1);
    const additionalCost = additionalWeight * zone.perKgRate;
    const totalCost = zone.baseRate + additionalCost;

    return {
      zone: {
        id: zone.id,
        name: zone.name,
        baseRate: zone.baseRate,
        perKgRate: zone.perKgRate,
        minDays: zone.minDays,
        maxDays: zone.maxDays,
      },
      shippingCost: totalCost,
      estimatedDelivery: `${zone.minDays}-${zone.maxDays} days`,
      calculation: {
        weightKg: weightInKg,
        baseRate: zone.baseRate,
        additionalWeight: additionalWeight,
        additionalCost: additionalCost,
        total: totalCost,
      },
    };
  }

  private async findZoneByCountry(country: string) {
    const zones = await this.prisma.shippingZone.findMany({
      where: { isActive: true },
    });

    for (const zone of zones) {
      const countries = zone.countries.split(',').map((c) => c.trim());
      if (countries.includes(country)) {
        return zone;
      }
    }

    return null;
  }

  async getAllZones() {
    return this.prisma.shippingZone.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async getZoneById(zoneId: string) {
    return this.prisma.shippingZone.findUnique({
      where: { id: zoneId },
    });
  }
}
```

---

## **3. Admin - Manage Shipping Zones**

### **Get All Zones**
> **GET** `/admin/shipping-zones`

**Response:**
```json
{
  "status": "success",
  "code": 200,
  "data": [
    {
      "id": "zone-uuid-1",
      "name": "Asia & Oceania",
      "baseRate": 150000,
      "perKgRate": 50000,
      "minDays": 7,
      "maxDays": 14,
      "countryCount": 21,
      "isActive": true
    }
  ]
}
```

### **Update Zone**
> **PATCH** `/admin/shipping-zones/:id`

**Request Body:**
```json
{
  "baseRate": 160000,
  "perKgRate": 55000,
  "minDays": 7,
  "maxDays": 14
}
```

---

## **Shipping Cost Comparison**

### **Example: 2kg Package to USA**

**Biteship (Domestic):**
```
JNE Reguler: Rp 15.000 (2-3 days)
TIKI REG: Rp 14.000 (3-4 days)
SiCepat: Rp 13.000 (2-3 days)
```

**International Manual:**
```
Zone: Americas
Base rate (0-1kg): Rp 300.000
Additional (1kg): Rp 100.000
Total: Rp 400.000 (14-21 days)
```

---

## **Production Best Practices**

### **Biteship:**
- [ ] Monitor API rate limits
- [ ] Implement retry logic for API failures
- [ ] Cache courier rates for 1 hour
- [ ] Set up webhook for tracking updates
- [ ] Auto-update tracking status daily

### **International Shipping:**
- [ ] Review and update rates quarterly
- [ ] Monitor Pos Indonesia rate changes
- [ ] Add margin for customs/handling fees
- [ ] Provide customs declaration support
- [ ] Send tracking updates manually to customers

---

## **Testing**

### **Biteship Testing:**
```bash
# Test get rates
curl -X POST https://api.biteship.com/v1/rates/couriers \
  -H "Authorization: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "origin_postal_code": 59185,
    "destination_postal_code": 12440,
    "couriers": "jne,tiki,sicepat",
    "items": [
      {
        "name": "Test Item",
        "value": 100000,
        "quantity": 1,
        "weight": 1000,
        "length": 20,
        "width": 15,
        "height": 10
      }
    ]
  }'
```

### **International Shipping Testing:**
```typescript
// Test zone calculation
const shipping = await internationalShippingService.calculateShipping(
  'United States',
  2000 // 2kg in grams
);
console.log(shipping);
// Expected: baseRate + perKgRate = 300000 + 100000 = 400000
```

