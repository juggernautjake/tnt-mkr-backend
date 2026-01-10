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
// Small: boxes with volume <= 48 cubic inches (priority 1-6)
// Medium: boxes with volume <= 384 cubic inches (priority 7-19)
// Large: boxes with volume > 384 cubic inches (priority 20-30)
const BOX_SIZE_THRESHOLDS = {
  small: { maxPriority: 6, handlingFeeCents: 100 },      // $1.00
  medium: { maxPriority: 19, handlingFeeCents: 225 },    // $2.25
  large: { maxPriority: 30, handlingFeeCents: 400 },     // $4.00
};

// Improved fallback rates closer to actual USPS rates
const FALLBACK_RATES: Record<string, { base: Record<string, number>; per_oz: Record<string, number> }> = {
  ground_advantage: {
    base: {
      local: 485,      // $4.85
      regional: 545,   // $5.45
      mid: 625,        // $6.25
      far: 725,        // $7.25
    },
    per_oz: {
      local: 4,        // $0.04 per oz
      regional: 5,     // $0.05 per oz
      mid: 6,          // $0.06 per oz
      far: 7,          // $0.07 per oz
    },
  },
  priority: {
    base: {
      local: 825,      // $8.25
      regional: 985,   // $9.85
      mid: 1145,       // $11.45
      far: 1350,       // $13.50
    },
    per_oz: {
      local: 7,        // $0.07 per oz
      regional: 9,     // $0.09 per oz
      mid: 11,         // $0.11 per oz
      far: 13,         // $0.13 per oz
    },
  },
  express: {
    base: {
      local: 2650,     // $26.50
      regional: 3150,  // $31.50
      mid: 3650,       // $36.50
      far: 4250,       // $42.50
    },
    per_oz: {
      local: 12,       // $0.12 per oz
      regional: 15,    // $0.15 per oz
      mid: 18,         // $0.18 per oz
      far: 20,         // $0.20 per oz
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
  return 'far'; // Default to far for unknown states
}

// Calculate item dimensions and weight
function getItemDimensions(item: CartItem): { length: number; width: number; height: number; weight_oz: number } {
  // If it's an additional part purchase, only count the part dimensions
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

  // Full product with all parts
  const product = item.product;
  if (!product) {
    return { length: 4, width: 3, height: 0.5, weight_oz: 2 }; // Default phone case size
  }

  let totalWeight = product.weight_oz || 2;

  // Add weight from all parts
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

  // Flatten cart items by quantity
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

  // Simple bin packing: try to fit all items in smallest possible box
  let remainingItems = [...items];

  while (remainingItems.length > 0) {
    let bestBox: ShippingBox | null = null;
    let itemsFitInBox: typeof items = [];

    // Try each box size, starting from smallest
    for (const box of sortedBoxes) {
      const fits: typeof items = [];
      let totalWeight = box.empty_weight_oz;
      let totalHeight = 0;

      // Try to fit items (simple stacking approach)
      for (const item of remainingItems) {
        // Check if item fits in box footprint
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

        // If all remaining items fit, we're done with this box
        if (fits.length === remainingItems.length) {
          break;
        }
      }
    }

    if (!bestBox || itemsFitInBox.length === 0) {
      // Fallback to largest box if nothing fits
      bestBox = sortedBoxes[sortedBoxes.length - 1];
      itemsFitInBox = remainingItems.slice(0, 1);
    }

    // Calculate total weight for this package
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

    // Remove packed items from remaining
    remainingItems = remainingItems.slice(itemsFitInBox.length);
  }

  return packages;
}

// Calculate fallback rates when EasyPost is unavailable
function calculateFallbackRates(packages: PackageInfo[], destinationState: string): ShippingRate[] {
  const zone = getZone(destinationState);
  const rates: ShippingRate[] = [];

  // Calculate total weight and get highest priority box (for handling fee)
  const totalWeight = packages.reduce((sum, pkg) => sum + pkg.weight_oz, 0);
  const highestPriority = Math.max(...packages.map(pkg => pkg.box_priority));
  const totalHandlingFee = packages.reduce((sum, pkg) => sum + getHandlingFeeCents(pkg.box_priority), 0);

  // Generate rates for each service
  const services = [
    { key: 'ground_advantage', name: 'USPS Ground Advantage', days: zone === 'local' ? 3 : zone === 'regional' ? 4 : zone === 'mid' ? 5 : 6 },
    { key: 'priority', name: 'USPS Priority Mail', days: zone === 'local' ? 2 : zone === 'regional' ? 2 : zone === 'mid' ? 3 : 3 },
    { key: 'express', name: 'USPS Express Mail', days: zone === 'local' ? 1 : 2 },
  ];

  for (const service of services) {
    const rateConfig = FALLBACK_RATES[service.key];
    const baseRate = rateConfig.base[zone];
    const perOzRate = rateConfig.per_oz[zone];

    // Calculate rate: base + (weight * per_oz_rate) for each package
    let totalRateCents = 0;
    for (const pkg of packages) {
      totalRateCents += baseRate + (pkg.weight_oz * perOzRate);
    }

    // Calculate delivery date (add 5 days for manufacturing)
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 5 + service.days);

    rates.push({
      id: `fallback_${service.key}_${Date.now()}`,
      carrier: 'USPS',
      service: service.name,
      rate_cents: totalRateCents,
      rate_with_handling_cents: totalRateCents + totalHandlingFee,
      estimated_delivery_days: service.days + 5, // Include manufacturing time
      estimated_delivery_date: deliveryDate.toISOString().split('T')[0],
      delivery_guarantee: service.key === 'express',
    });
  }

  // Sort by price
  rates.sort((a, b) => a.rate_with_handling_cents - b.rate_with_handling_cents);

  return rates;
}

// Main function to get shipping rates
async function getShippingRates(
  address: { street: string; street2: string; city: string; state: string; postal_code: string; phone: string },
  cartItems: CartItem[],
  boxes: ShippingBox[],
  redis?: any
): Promise<RateResult> {
  // Calculate packages needed
  const packages = await calculatePackages(cartItems, boxes);

  if (packages.length === 0) {
    return {
      rates: [],
      packages: [],
      cached: false,
      fallback_used: false,
    };
  }

  // Check cache first
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
      // Add handling fees based on box sizes
      const totalHandlingFee = packages.reduce((sum, pkg) => sum + getHandlingFeeCents(pkg.box_priority), 0);

      const ratesWithHandling: ShippingRate[] = easypostRates.rates.map((rate: any) => ({
        id: rate.id,
        carrier: rate.carrier,
        service: rate.service,
        rate_cents: Math.round(parseFloat(rate.rate) * 100),
        rate_with_handling_cents: Math.round(parseFloat(rate.rate) * 100) + totalHandlingFee,
        estimated_delivery_days: rate.est_delivery_days,
        estimated_delivery_date: rate.delivery_date,
        delivery_guarantee: rate.delivery_date_guaranteed || false,
      }));

      // Sort by price
      ratesWithHandling.sort((a, b) => a.rate_with_handling_cents - b.rate_with_handling_cents);

      const result: RateResult = {
        rates: ratesWithHandling,
        packages,
        shipment_id: easypostRates.shipment_id,
        cached: false,
        fallback_used: false,
      };

      // Cache for 20 minutes
      if (redis) {
        try {
          await redis.setex(cacheKey, 1200, JSON.stringify(result));
        } catch (e) {
          // Cache error, continue
        }
      }

      return result;
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

  // Cache fallback for 10 minutes
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