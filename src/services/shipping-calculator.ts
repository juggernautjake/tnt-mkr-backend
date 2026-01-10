// src/services/shipping-calculator.ts
import easypostService, { PackageInfo, ShippingRate, RateResponse, AddressInput } from './easypost';

// Fallback zone-based rates per ounce for when EasyPost is unavailable
// Based on 2024 USPS rates from origin 76513 (Belton, TX)
const FALLBACK_RATES = {
  // Zone 1-2 (Local, 0-150 miles)
  zone_local: {
    ground_advantage: { base: 450, per_oz: 5 },      // ~$4.50 base + $0.05/oz
    priority: { base: 850, per_oz: 8 },               // ~$8.50 base + $0.08/oz
    priority_express: { base: 2650, per_oz: 15 },     // ~$26.50 base + $0.15/oz
  },
  // Zone 3-4 (Regional, 150-600 miles)
  zone_regional: {
    ground_advantage: { base: 550, per_oz: 7 },
    priority: { base: 950, per_oz: 10 },
    priority_express: { base: 2850, per_oz: 18 },
  },
  // Zone 5-6 (Mid-distance, 600-1400 miles)
  zone_mid: {
    ground_advantage: { base: 650, per_oz: 9 },
    priority: { base: 1150, per_oz: 12 },
    priority_express: { base: 3250, per_oz: 22 },
  },
  // Zone 7-8 (Cross-country, 1400+ miles)
  zone_far: {
    ground_advantage: { base: 750, per_oz: 11 },
    priority: { base: 1350, per_oz: 15 },
    priority_express: { base: 3850, per_oz: 28 },
  },
};

// Estimated delivery days by service
const DELIVERY_ESTIMATES = {
  ground_advantage: { min: 2, max: 5 },
  priority: { min: 1, max: 3 },
  priority_express: { min: 1, max: 2 },
};

// State to zone mapping (simplified based on distance from Texas)
const STATE_ZONES: Record<string, keyof typeof FALLBACK_RATES> = {
  // Zone 1-2 (Local)
  TX: 'zone_local',
  
  // Zone 3-4 (Regional)
  LA: 'zone_regional', AR: 'zone_regional', OK: 'zone_regional', NM: 'zone_regional',
  MS: 'zone_regional', AL: 'zone_regional', TN: 'zone_regional', MO: 'zone_regional',
  KS: 'zone_regional', CO: 'zone_regional',
  
  // Zone 5-6 (Mid-distance)
  FL: 'zone_mid', GA: 'zone_mid', SC: 'zone_mid', NC: 'zone_mid', VA: 'zone_mid',
  WV: 'zone_mid', KY: 'zone_mid', IN: 'zone_mid', IL: 'zone_mid', IA: 'zone_mid',
  NE: 'zone_mid', WY: 'zone_mid', UT: 'zone_mid', AZ: 'zone_mid', NV: 'zone_mid',
  
  // Zone 7-8 (Far)
  CA: 'zone_far', OR: 'zone_far', WA: 'zone_far', ID: 'zone_far', MT: 'zone_far',
  ND: 'zone_far', SD: 'zone_far', MN: 'zone_far', WI: 'zone_far', MI: 'zone_far',
  OH: 'zone_far', PA: 'zone_far', NY: 'zone_far', NJ: 'zone_far', CT: 'zone_far',
  RI: 'zone_far', MA: 'zone_far', NH: 'zone_far', VT: 'zone_far', ME: 'zone_far',
  MD: 'zone_far', DE: 'zone_far', DC: 'zone_far',
};

// Handling fee per package
const HANDLING_FEE_CENTS = 100; // $1.00

interface CartItemForShipping {
  product?: {
    id: number;
    weight_oz?: number;
    length?: number;
    width?: number;
    height?: number;
  };
  quantity: number;
  is_additional_part?: boolean;
  cart_item_parts?: Array<{
    product_part?: {
      weight_oz?: number;
      length?: number;
      width?: number;
      height?: number;
    };
  }>;
}

interface BoxInfo {
  id: number;
  name: string;
  length: number;
  width: number;
  height: number;
  empty_weight_oz: number;
  max_weight_oz: number;
  priority: number;
}

// Calculate total weight and determine packages needed
export const calculatePackages = async (
  cartItems: CartItemForShipping[],
  boxes: BoxInfo[]
): Promise<PackageInfo[]> => {
  const packages: PackageInfo[] = [];
  
  // Calculate total weight of all items
  let totalWeightOz = 0;
  const itemDetails: Array<{ weight: number; length: number; width: number; height: number; qty: number }> = [];

  for (const item of cartItems) {
    const qty = item.quantity;
    
    if (item.is_additional_part) {
      // For additional parts, get weight from cart_item_parts
      for (const part of item.cart_item_parts || []) {
        const partWeight = part.product_part?.weight_oz || 1;
        totalWeightOz += partWeight * qty;
        itemDetails.push({
          weight: partWeight,
          length: part.product_part?.length || 2,
          width: part.product_part?.width || 2,
          height: part.product_part?.height || 1,
          qty,
        });
      }
    } else {
      // For full products
      const productWeight = item.product?.weight_oz || 4.5; // Default phone case weight
      totalWeightOz += productWeight * qty;
      itemDetails.push({
        weight: productWeight,
        length: item.product?.length || 7.75,
        width: item.product?.width || 4.25,
        height: item.product?.height || 2.5,
        qty,
      });
    }
  }

  // Sort boxes by priority and then by volume (smallest first)
  const sortedBoxes = [...boxes].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const volA = a.length * a.width * a.height;
    const volB = b.length * b.width * b.height;
    return volA - volB;
  });

  // Simple bin-packing: try to fit items into boxes
  // Calculate total volume needed
  let totalVolume = 0;
  for (const item of itemDetails) {
    totalVolume += item.length * item.width * item.height * item.qty;
  }

  // Find appropriate boxes
  let remainingWeight = totalWeightOz;
  let remainingVolume = totalVolume;

  while (remainingWeight > 0 && remainingVolume > 0) {
    // Find the best box for remaining items
    let bestBox: BoxInfo | null = null;
    
    for (const box of sortedBoxes) {
      const boxVolume = box.length * box.width * box.height;
      const maxWeightCapacity = box.max_weight_oz - box.empty_weight_oz;
      
      // Check if this box can fit some of the remaining items
      if (boxVolume >= Math.min(remainingVolume, boxVolume) && 
          maxWeightCapacity >= Math.min(remainingWeight, maxWeightCapacity)) {
        bestBox = box;
        break;
      }
    }

    if (!bestBox) {
      // Use the largest available box
      bestBox = sortedBoxes[sortedBoxes.length - 1];
    }

    // Calculate how much fits in this box
    const boxVolume = bestBox.length * bestBox.width * bestBox.height;
    const maxWeightCapacity = bestBox.max_weight_oz - bestBox.empty_weight_oz;
    
    const weightInBox = Math.min(remainingWeight, maxWeightCapacity);
    const volumeInBox = Math.min(remainingVolume, boxVolume);

    packages.push({
      weight_oz: weightInBox + bestBox.empty_weight_oz,
      length: bestBox.length,
      width: bestBox.width,
      height: bestBox.height,
    });

    remainingWeight -= weightInBox;
    remainingVolume -= volumeInBox;

    // Safety check to prevent infinite loop
    if (packages.length > 100) {
      console.error('Too many packages calculated, breaking loop');
      break;
    }
  }

  // If no packages were created, create a default one
  if (packages.length === 0) {
    const defaultBox = sortedBoxes[0] || {
      length: 7.75,
      width: 4.25,
      height: 2.5,
      empty_weight_oz: 2.9,
    };
    packages.push({
      weight_oz: totalWeightOz + defaultBox.empty_weight_oz,
      length: defaultBox.length,
      width: defaultBox.width,
      height: defaultBox.height,
    });
  }

  return packages;
};

// Calculate fallback rates when EasyPost is unavailable
export const calculateFallbackRates = (
  toState: string,
  packages: PackageInfo[]
): ShippingRate[] => {
  const zone = STATE_ZONES[toState.toUpperCase()] || 'zone_far';
  const zoneRates = FALLBACK_RATES[zone];
  
  const rates: ShippingRate[] = [];
  
  // Calculate rates for each service
  const services = [
    { key: 'ground_advantage', name: 'USPS Ground Advantage' },
    { key: 'priority', name: 'USPS Priority Mail' },
    { key: 'priority_express', name: 'USPS Priority Mail Express' },
  ];

  for (const service of services) {
    const serviceRates = zoneRates[service.key as keyof typeof zoneRates];
    const estimates = DELIVERY_ESTIMATES[service.key as keyof typeof DELIVERY_ESTIMATES];
    
    let totalRateCents = 0;
    
    for (const pkg of packages) {
      const packageRate = serviceRates.base + Math.round(pkg.weight_oz * serviceRates.per_oz);
      totalRateCents += packageRate + HANDLING_FEE_CENTS;
    }

    // Calculate estimated delivery date
    const today = new Date();
    const estDeliveryDate = new Date(today);
    estDeliveryDate.setDate(today.getDate() + estimates.max + 5); // +5 for manufacturing time

    rates.push({
      id: `fallback_${service.key}_${Date.now()}`,
      carrier: 'USPS',
      service: service.name,
      rate_cents: totalRateCents - (HANDLING_FEE_CENTS * packages.length),
      rate_with_handling_cents: totalRateCents,
      estimated_delivery_days: estimates.max,
      estimated_delivery_date: estDeliveryDate.toISOString().split('T')[0],
      delivery_guarantee: service.key === 'priority_express',
    });
  }

  return rates.sort((a, b) => a.rate_with_handling_cents - b.rate_with_handling_cents);
};

// Main function to get shipping rates (tries EasyPost first, falls back if needed)
export const getShippingRates = async (
  toAddress: AddressInput,
  cartItems: CartItemForShipping[],
  boxes: BoxInfo[],
  redis?: any
): Promise<RateResponse & { packages: PackageInfo[]; fallback_used: boolean }> => {
  // Calculate packages needed
  const packages = await calculatePackages(cartItems, boxes);
  
  // Check cache first
  const cacheKey = `shipping_rates:${toAddress.postal_code}:${JSON.stringify(packages)}`;
  
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const cachedData = JSON.parse(cached);
        return {
          ...cachedData,
          cached: true,
          cache_key: cacheKey,
        };
      }
    } catch (err) {
      console.error('Redis cache read error:', err);
    }
  }

  // Try EasyPost first
  try {
    const easypostRates = await easypostService.getShippingRates(toAddress, packages);
    
    const result = {
      ...easypostRates,
      packages,
      fallback_used: false,
    };

    // Cache for 20 minutes
    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(result), { EX: 1200 });
      } catch (err) {
        console.error('Redis cache write error:', err);
      }
    }

    return result;
  } catch (error) {
    console.error('EasyPost rate fetch failed, using fallback:', error);
    
    // Use fallback rates
    const fallbackRates = calculateFallbackRates(toAddress.state, packages);
    
    const result = {
      rates: fallbackRates,
      shipment_id: `fallback_${Date.now()}`,
      packages,
      cached: false,
      fallback_used: true,
    };

    // Cache fallback rates for 20 minutes too
    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(result), { EX: 1200 });
      } catch (err) {
        console.error('Redis cache write error:', err);
      }
    }

    return result;
  }
};

// Invalidate rate cache for an address
export const invalidateRateCache = async (postalCode: string, redis?: any): Promise<void> => {
  if (!redis) return;
  
  try {
    const keys = await redis.keys(`shipping_rates:${postalCode}:*`);
    if (keys.length > 0) {
      await redis.del(keys);
    }
  } catch (err) {
    console.error('Redis cache invalidation error:', err);
  }
};

export default {
  calculatePackages,
  calculateFallbackRates,
  getShippingRates,
  invalidateRateCache,
  HANDLING_FEE_CENTS,
  STATE_ZONES,
};