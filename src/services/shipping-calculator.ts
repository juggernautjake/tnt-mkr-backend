import easypostService from './easypost';

// Zone definitions based on distance from Belton, TX (76513)
const ZONES: Record<string, string[]> = {
  local: ['TX'],
  regional: ['OK', 'AR', 'LA', 'NM'],
  mid: ['KS', 'MO', 'MS', 'AL', 'TN', 'AZ', 'CO', 'NE', 'IA'],
  far: [
    'WA', 'OR', 'CA', 'NV', 'ID', 'MT', 'WY', 'UT',
    'ND', 'SD', 'MN', 'WI', 'MI', 'IL', 'IN', 'OH',
    'KY', 'WV', 'VA', 'NC', 'SC', 'GA', 'FL',
    'PA', 'NY', 'NJ', 'CT', 'RI', 'MA', 'VT', 'NH', 'ME',
    'MD', 'DE', 'DC'
  ],
};

// Box size categories for handling fees
const BOX_SIZE_THRESHOLDS = {
  small: { maxPriority: 6, handlingFeeCents: 100 },
  medium: { maxPriority: 19, handlingFeeCents: 225 },
  large: { maxPriority: 30, handlingFeeCents: 400 },
};

// Fallback rates - ONLY USPS Ground Advantage, Priority, and Express
const FALLBACK_RATES: Record<string, { base: Record<string, number>; per_oz: Record<string, number> }> = {
  ground_advantage: {
    base: {
      local: 485,
      regional: 545,
      mid: 625,
      far: 725,
    },
    per_oz: {
      local: 4,
      regional: 5,
      mid: 6,
      far: 7,
    },
  },
  priority: {
    base: {
      local: 825,
      regional: 985,
      mid: 1145,
      far: 1350,
    },
    per_oz: {
      local: 7,
      regional: 9,
      mid: 11,
      far: 13,
    },
  },
  express: {
    base: {
      local: 2650,
      regional: 3150,
      mid: 3650,
      far: 4250,
    },
    per_oz: {
      local: 12,
      regional: 15,
      mid: 18,
      far: 20,
    },
  },
};

interface CartItem {
  product: any;
  quantity: number;
  is_additional_part?: boolean;
  cart_item_parts?: Array<{ product_part: any }>;
}

interface ShippingBox {
  id: number;
  name: string;
  length: number;
  width: number;
  height: number;
  empty_weight_oz: number;
  max_weight_oz: number;
  priority: number;
  is_active: boolean;
}

interface PackageInfo {
  length: number;
  width: number;
  height: number;
  weight_oz: number;
  box_name: string;
  box_priority: number;
  items_count: number;
}

interface ShippingRate {
  id: string;
  carrier: string;
  service: string;
  rate_cents: number;
  rate_with_handling_cents: number;
  estimated_delivery_days: number | null;
  estimated_delivery_date: string | null;
  delivery_guarantee: boolean;
}

interface RateResult {
  rates: ShippingRate[];
  packages: PackageInfo[];
  shipment_id?: string;
  cached: boolean;
  fallback_used: boolean;
}

// Get handling fee based on box priority
function getHandlingFeeCents(boxPriority: number): number {
  if (boxPriority <= BOX_SIZE_THRESHOLDS.small.maxPriority) {
    return BOX_SIZE_THRESHOLDS.small.handlingFeeCents;
  } else if (boxPriority <= BOX_SIZE_THRESHOLDS.medium.maxPriority) {
    return BOX_SIZE_THRESHOLDS.medium.handlingFeeCents;
  } else {
    return BOX_SIZE_THRESHOLDS.large.handlingFeeCents;
  }
}

// Determine zone based on destination state
function getZone(state: string): string {
  const stateUpper = state.toUpperCase();
  for (const [zone, states] of Object.entries(ZONES)) {
    if (states.includes(stateUpper)) {
      return zone;
    }
  }
  return 'far';
}

// Calculate item dimensions and weight
function getItemDimensions(item: CartItem): { length: number; width: number; height: number; weight_oz: number } {
  if (item.is_additional_part && item.cart_item_parts && item.cart_item_parts.length > 0) {
    const part = item.cart_item_parts[0]?.product_part;
    if (part) {
      return {
        length: part.length || 3,
        width: part.width || 2,
        height: part.height || 0.5,
        weight_oz: part.weight_oz || 0.5,
      };
    }
  }

  const product = item.product;
  if (!product) {
    return { length: 4, width: 3, height: 0.5, weight_oz: 2 };
  }

  let totalWeight = product.weight_oz || 2;

  if (item.cart_item_parts) {
    for (const cip of item.cart_item_parts) {
      if (cip.product_part?.weight_oz) {
        totalWeight += cip.product_part.weight_oz;
      }
    }
  }

  return {
    length: product.length || 4,
    width: product.width || 3,
    height: product.height || 0.5,
    weight_oz: totalWeight,
  };
}

// Calculate packages needed for cart items (bin packing)
async function calculatePackages(cartItems: CartItem[], boxes: ShippingBox[]): Promise<PackageInfo[]> {
  const packages: PackageInfo[] = [];
  const sortedBoxes = [...boxes].sort((a, b) => a.priority - b.priority);

  const items: Array<{ length: number; width: number; height: number; weight_oz: number }> = [];
  for (const item of cartItems) {
    const dims = getItemDimensions(item);
    for (let i = 0; i < item.quantity; i++) {
      items.push(dims);
    }
  }

  if (items.length === 0) {
    return packages;
  }

  let remainingItems = [...items];

  while (remainingItems.length > 0) {
    let bestBox: ShippingBox | null = null;
    let itemsFitInBox: typeof items = [];

    for (const box of sortedBoxes) {
      const fits: typeof items = [];
      let totalWeight = box.empty_weight_oz;
      let totalHeight = 0;

      for (const item of remainingItems) {
        const fitsWidth = item.length <= box.length && item.width <= box.width;
        const fitsRotated = item.width <= box.length && item.length <= box.width;

        if ((fitsWidth || fitsRotated) &&
            totalHeight + item.height <= box.height &&
            totalWeight + item.weight_oz <= box.max_weight_oz) {
          fits.push(item);
          totalWeight += item.weight_oz;
          totalHeight += item.height;
        }
      }

      if (fits.length > 0 && (fits.length > itemsFitInBox.length || !bestBox)) {
        bestBox = box;
        itemsFitInBox = fits;

        if (fits.length === remainingItems.length) {
          break;
        }
      }
    }

    if (!bestBox || itemsFitInBox.length === 0) {
      bestBox = sortedBoxes[sortedBoxes.length - 1];
      itemsFitInBox = remainingItems.slice(0, 1);
    }

    const packageWeight = bestBox.empty_weight_oz +
      itemsFitInBox.reduce((sum, item) => sum + item.weight_oz, 0);

    packages.push({
      length: bestBox.length,
      width: bestBox.width,
      height: bestBox.height,
      weight_oz: packageWeight,
      box_name: bestBox.name,
      box_priority: bestBox.priority,
      items_count: itemsFitInBox.length,
    });

    remainingItems = remainingItems.slice(itemsFitInBox.length);
  }

  return packages;
}

// Filter rates to only include USPS Ground Advantage, Priority, and Express
function filterUSPSRates(rates: any[]): any[] {
  return rates.filter((rate: any) => {
    if (rate.carrier !== 'USPS') return false;
    
    const serviceLower = rate.service.toLowerCase();
    
    // Match Ground Advantage
    if (serviceLower.includes('ground') && serviceLower.includes('advantage')) {
      return true;
    }
    
    // Match Priority Mail (but not Priority Mail Express)
    if (serviceLower.includes('priority') && !serviceLower.includes('express')) {
      return true;
    }
    
    // Match Priority Mail Express or Express
    if (serviceLower.includes('express')) {
      return true;
    }
    
    return false;
  });
}

// Sort USPS rates in order: Ground Advantage, Priority, Express
function sortUSPSRates(rates: any[]): any[] {
  const getServiceOrder = (service: string): number => {
    const serviceLower = service.toLowerCase();
    if (serviceLower.includes('ground') && serviceLower.includes('advantage')) return 0;
    if (serviceLower.includes('priority') && !serviceLower.includes('express')) return 1;
    if (serviceLower.includes('express')) return 2;
    return 99;
  };
  
  return [...rates].sort((a, b) => getServiceOrder(a.service) - getServiceOrder(b.service));
}

// Calculate fallback rates when EasyPost is unavailable
function calculateFallbackRates(packages: PackageInfo[], destinationState: string): ShippingRate[] {
  const zone = getZone(destinationState);
  const rates: ShippingRate[] = [];

  const totalHandlingFee = packages.reduce((sum, pkg) => sum + getHandlingFeeCents(pkg.box_priority), 0);

  // Only generate rates for the 3 USPS services we want
  const services = [
    { key: 'ground_advantage', name: 'USPS Ground Advantage', days: zone === 'local' ? 3 : zone === 'regional' ? 4 : zone === 'mid' ? 5 : 6 },
    { key: 'priority', name: 'USPS Priority Mail', days: zone === 'local' ? 2 : zone === 'regional' ? 2 : zone === 'mid' ? 3 : 3 },
    { key: 'express', name: 'USPS Priority Mail Express', days: zone === 'local' ? 1 : 2 },
  ];

  for (const service of services) {
    const rateConfig = FALLBACK_RATES[service.key];
    const baseRate = rateConfig.base[zone];
    const perOzRate = rateConfig.per_oz[zone];

    let totalRateCents = 0;
    for (const pkg of packages) {
      totalRateCents += baseRate + (pkg.weight_oz * perOzRate);
    }

    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 5 + service.days);

    rates.push({
      id: `fallback_${service.key}_${Date.now()}`,
      carrier: 'USPS',
      service: service.name,
      rate_cents: totalRateCents,
      rate_with_handling_cents: totalRateCents + totalHandlingFee,
      estimated_delivery_days: service.days + 5,
      estimated_delivery_date: deliveryDate.toISOString().split('T')[0],
      delivery_guarantee: service.key === 'express',
    });
  }

  return rates;
}

// Main function to get shipping rates
async function getShippingRates(
  address: { street: string; street2: string; city: string; state: string; postal_code: string; phone: string },
  cartItems: CartItem[],
  boxes: ShippingBox[],
  redis?: any
): Promise<RateResult> {
  const packages = await calculatePackages(cartItems, boxes);

  if (packages.length === 0) {
    return {
      rates: [],
      packages: [],
      cached: false,
      fallback_used: false,
    };
  }

  const cacheKey = `shipping_rates:${address.postal_code}:${address.state}:${JSON.stringify(packages.map(p => ({ w: p.weight_oz, l: p.length, h: p.height, d: p.width })))}`;

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const cachedResult = JSON.parse(cached);
        return { ...cachedResult, cached: true };
      }
    } catch (e) {
      // Cache error, continue without cache
    }
  }

  // Try EasyPost first
  try {
    const easypostRates = await easypostService.getRates(address, packages);

    if (easypostRates.rates && easypostRates.rates.length > 0) {
      const totalHandlingFee = packages.reduce((sum, pkg) => sum + getHandlingFeeCents(pkg.box_priority), 0);

      // Filter to only USPS Ground Advantage, Priority, and Express
      const filteredRates = filterUSPSRates(easypostRates.rates);
      
      // Sort in order: Ground Advantage, Priority, Express
      const sortedRates = sortUSPSRates(filteredRates);

      const ratesWithHandling: ShippingRate[] = sortedRates.map((rate: any) => ({
        id: rate.id,
        carrier: rate.carrier,
        service: rate.service,
        rate_cents: Math.round(parseFloat(rate.rate) * 100),
        rate_with_handling_cents: Math.round(parseFloat(rate.rate) * 100) + totalHandlingFee,
        estimated_delivery_days: rate.est_delivery_days,
        estimated_delivery_date: rate.delivery_date,
        delivery_guarantee: rate.delivery_date_guaranteed || false,
      }));

      // If we have at least one rate after filtering, use EasyPost results
      if (ratesWithHandling.length > 0) {
        const result: RateResult = {
          rates: ratesWithHandling,
          packages,
          shipment_id: easypostRates.shipment_ids?.[0],
          cached: false,
          fallback_used: false,
        };

        if (redis) {
          try {
            await redis.setex(cacheKey, 1200, JSON.stringify(result));
          } catch (e) {
            // Cache error, continue
          }
        }

        return result;
      }
    }
  } catch (error) {
    console.error('EasyPost rate fetch failed, using fallback:', error);
  }

  // Fallback to calculated rates
  const fallbackRates = calculateFallbackRates(packages, address.state);

  const result: RateResult = {
    rates: fallbackRates,
    packages,
    cached: false,
    fallback_used: true,
  };

  if (redis) {
    try {
      await redis.setex(cacheKey, 600, JSON.stringify(result));
    } catch (e) {
      // Cache error, continue
    }
  }

  return result;
}

export default {
  calculatePackages,
  getShippingRates,
  getZone,
  getHandlingFeeCents,
  BOX_SIZE_THRESHOLDS,
};