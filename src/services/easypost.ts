import EasyPostClient from '@easypost/api';

const getClient = () => {
  const apiKey = process.env.NODE_ENV === 'production'
    ? process.env.EASYPOST_PRODUCTION_API_KEY
    : process.env.EASYPOST_TEST_API_KEY;

  if (!apiKey) {
    throw new Error('EasyPost API key not configured');
  }

  return new EasyPostClient(apiKey);
};

// Continental US states only (excludes AK, HI, territories)
const CONTINENTAL_US_STATES = [
  'AL', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA',
  'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA',
  'WV', 'WI', 'WY', 'DC'
];

export const isValidContinentalUS = (state: string): boolean => {
  return CONTINENTAL_US_STATES.includes(state.toUpperCase());
};

export const getOriginAddress = () => ({
  street1: process.env.ORIGIN_STREET || '',
  city: process.env.ORIGIN_CITY || 'Belton',
  state: process.env.ORIGIN_STATE || 'TX',
  zip: process.env.ORIGIN_ZIP || '76513',
  country: 'US',
  phone: process.env.ORIGIN_PHONE || '',
});

// Exported interfaces for use in other services
export interface AddressInput {
  street: string;
  street2?: string;
  city: string;
  state: string;
  postal_code: string;
  phone?: string;
}

export interface ValidatedAddress {
  street: string;
  street2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone?: string;
  is_valid: boolean;
  easypost_id?: string;
  suggested_address?: {
    street: string;
    street2?: string;
    city: string;
    state: string;
    postal_code: string;
  };
}

export interface PackageInfo {
  weight_oz: number;
  length: number;
  width: number;
  height: number;
}

export interface ShippingRate {
  id: string;
  carrier: string;
  service: string;
  rate_cents: number;
  rate_with_handling_cents: number;
  estimated_delivery_days: number | null;
  estimated_delivery_date: string | null;
  delivery_guarantee: boolean;
}

export interface RateResponse {
  rates: ShippingRate[];
  shipment_id?: string;
  cached?: boolean;
  cache_key?: string;
}

export const validateAddress = async (address: AddressInput): Promise<ValidatedAddress> => {
  // Check if state is continental US
  if (!isValidContinentalUS(address.state)) {
    return {
      ...address,
      country: 'US',
      is_valid: false,
    };
  }

  try {
    const client = getClient();

    const easypostAddress = await client.Address.create({
      street1: address.street,
      street2: address.street2 || '',
      city: address.city,
      state: address.state,
      zip: address.postal_code,
      country: 'US',
      phone: address.phone || '',
    });

    const verifiedAddress = await client.Address.verifyAddress(easypostAddress.id);

    // Check if address was corrected
    const wasModified =
      verifiedAddress.street1?.toUpperCase() !== address.street.toUpperCase() ||
      verifiedAddress.city?.toUpperCase() !== address.city.toUpperCase() ||
      verifiedAddress.state?.toUpperCase() !== address.state.toUpperCase() ||
      verifiedAddress.zip?.substring(0, 5) !== address.postal_code.substring(0, 5);

    const result: ValidatedAddress = {
      street: verifiedAddress.street1 || address.street,
      street2: verifiedAddress.street2 || address.street2,
      city: verifiedAddress.city || address.city,
      state: verifiedAddress.state || address.state,
      postal_code: verifiedAddress.zip || address.postal_code,
      country: 'US',
      phone: address.phone,
      is_valid: true,
      easypost_id: verifiedAddress.id,
    };

    if (wasModified) {
      result.suggested_address = {
        street: verifiedAddress.street1 || '',
        street2: verifiedAddress.street2 || '',
        city: verifiedAddress.city || '',
        state: verifiedAddress.state || '',
        postal_code: verifiedAddress.zip || '',
      };
    }

    return result;
  } catch (error: any) {
    console.error('EasyPost address validation error:', error);
    return {
      ...address,
      country: 'US',
      is_valid: false,
    };
  }
};

const HANDLING_FEE_CENTS = 100; // $1.00 handling fee per package

// Services we want to offer
const ALLOWED_SERVICES = [
  'GroundAdvantage',
  'Ground Advantage',
  'Priority',
  'PriorityMailExpress',
  'Express',
];

export const getShippingRates = async (
  toAddress: AddressInput,
  packages: PackageInfo[]
): Promise<RateResponse> => {
  try {
    const client = getClient();
    const origin = getOriginAddress();

    // For now, we only support single-package shipments
    const pkg = packages[0];
    if (!pkg) {
      throw new Error('No package dimensions provided');
    }

    const shipment = await client.Shipment.create({
      from_address: {
        street1: origin.street1,
        city: origin.city,
        state: origin.state,
        zip: origin.zip,
        country: origin.country,
        phone: origin.phone,
      },
      to_address: {
        street1: toAddress.street,
        street2: toAddress.street2 || '',
        city: toAddress.city,
        state: toAddress.state,
        zip: toAddress.postal_code,
        country: 'US',
        phone: toAddress.phone || '',
      },
      parcel: {
        weight: pkg.weight_oz,
        length: pkg.length,
        width: pkg.width,
        height: pkg.height,
      },
    });

    // Filter and format rates
    const rates: ShippingRate[] = (shipment.rates || [])
      .filter((rate: any) => {
        // Only USPS for now
        if (rate.carrier !== 'USPS') return false;
        // Only allowed services
        return ALLOWED_SERVICES.some(svc =>
          rate.service?.includes(svc) || rate.service === svc
        );
      })
      .map((rate: any) => {
        const rateCents = Math.round(parseFloat(rate.rate) * 100);
        return {
          id: rate.id,
          carrier: rate.carrier,
          service: rate.service,
          rate_cents: rateCents,
          rate_with_handling_cents: rateCents + HANDLING_FEE_CENTS,
          estimated_delivery_days: rate.delivery_days || null,
          estimated_delivery_date: rate.delivery_date || null,
          delivery_guarantee: rate.delivery_date_guaranteed || false,
        };
      })
      .sort((a: ShippingRate, b: ShippingRate) => a.rate_cents - b.rate_cents);

    return {
      rates,
      shipment_id: shipment.id,
    };
  } catch (error: any) {
    console.error('EasyPost get rates error:', error);
    throw error;
  }
};

export const createTracker = async (trackingCode: string, carrier: string = 'USPS'): Promise<string> => {
  try {
    const client = getClient();
    const tracker = await client.Tracker.create({
      tracking_code: trackingCode,
      carrier: carrier,
    });
    return tracker.id;
  } catch (error: any) {
    console.error('EasyPost create tracker error:', error);
    throw error;
  }
};

export const getTrackerStatus = async (trackerId: string): Promise<any> => {
  try {
    const client = getClient();
    const tracker = await client.Tracker.retrieve(trackerId);
    return {
      status: tracker.status,
      status_detail: tracker.status_detail,
      est_delivery_date: tracker.est_delivery_date,
      tracking_details: tracker.tracking_details,
    };
  } catch (error: any) {
    console.error('EasyPost get tracker error:', error);
    throw error;
  }
};

export default {
  validateAddress,
  getShippingRates,
  createTracker,
  getTrackerStatus,
  isValidContinentalUS,
  getOriginAddress,
};