import EasyPost from '@easypost/api';

const apiKey = process.env.EASYPOST_API_KEY || '';
const testMode = process.env.NODE_ENV !== 'production' || process.env.EASYPOST_TEST_MODE === 'true';

let client: any = null;

if (apiKey) {
  client = new EasyPost(apiKey);
}

// States we ship to (continental US only)
const CONTINENTAL_US_STATES = [
  'AL', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA',
  'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA',
  'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM',
  'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD',
  'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

// Non-continental states and territories we don't ship to
const NON_CONTINENTAL = ['AK', 'HI', 'PR', 'VI', 'GU', 'AS', 'MP'];

export interface AddressInput {
  street: string;
  street2?: string;
  city: string;
  state: string;
  postal_code: string;
  phone?: string;
}

export interface ValidatedAddress {
  is_valid: boolean;
  easypost_id?: string;
  suggested_address?: {
    street: string;
    street2?: string;
    city: string;
    state: string;
    postal_code: string;
  };
  error?: string;
}

export interface PackageInfo {
  length: number;
  width: number;
  height: number;
  weight_oz: number;
  box_name?: string;
  box_priority?: number;
}

export interface ShippingRate {
  id: string;
  carrier: string;
  service: string;
  rate: string;
  est_delivery_days: number | null;
  delivery_date: string | null;
  delivery_date_guaranteed: boolean;
}

export interface RateResponse {
  rates: ShippingRate[];
  shipment_id: string;
}

// Check if state is continental US
function isValidContinentalUS(state: string): boolean {
  return CONTINENTAL_US_STATES.includes(state.toUpperCase());
}

// Validate address with EasyPost
async function validateAddress(address: AddressInput): Promise<ValidatedAddress> {
  if (!client) {
    return { is_valid: false, error: 'EasyPost not configured' };
  }

  // Check continental US first
  if (!isValidContinentalUS(address.state)) {
    return {
      is_valid: false,
      error: 'We currently only ship to the continental United States (excludes Alaska, Hawaii, and US territories).',
    };
  }

  try {
    const verifiedAddress = await client.Address.create({
      street1: address.street,
      street2: address.street2 || '',
      city: address.city,
      state: address.state,
      zip: address.postal_code,
      country: 'US',
      verify: ['delivery'],
    });

    // Check verification results
    const verifications = verifiedAddress.verifications;
    if (verifications?.delivery?.success) {
      // Check if address was modified
      const wasModified = 
        verifiedAddress.street1?.toUpperCase() !== address.street.toUpperCase() ||
        verifiedAddress.city?.toUpperCase() !== address.city.toUpperCase() ||
        verifiedAddress.state?.toUpperCase() !== address.state.toUpperCase() ||
        verifiedAddress.zip !== address.postal_code;

      if (wasModified) {
        return {
          is_valid: true,
          easypost_id: verifiedAddress.id,
          suggested_address: {
            street: verifiedAddress.street1,
            street2: verifiedAddress.street2 || '',
            city: verifiedAddress.city,
            state: verifiedAddress.state,
            postal_code: verifiedAddress.zip,
          },
        };
      }

      return {
        is_valid: true,
        easypost_id: verifiedAddress.id,
      };
    }

    // Get error message from verification
    const errors = verifications?.delivery?.errors || [];
    const errorMessage = errors.length > 0 
      ? errors.map((e: any) => e.message).join('. ')
      : 'Address could not be verified';

    return {
      is_valid: false,
      error: errorMessage,
    };
  } catch (error: any) {
    console.error('EasyPost address validation error:', error);
    return {
      is_valid: false,
      error: error.message || 'Failed to validate address',
    };
  }
}

// Get shipping rates from EasyPost
async function getRates(
  toAddress: AddressInput,
  packages: PackageInfo[]
): Promise<RateResponse> {
  if (!client) {
    throw new Error('EasyPost not configured');
  }

  // From address (your business)
  const fromAddress = {
    company: 'TNT MKR',
    street1: process.env.BUSINESS_ADDRESS_STREET || '123 Main St',
    city: process.env.BUSINESS_ADDRESS_CITY || 'Belton',
    state: process.env.BUSINESS_ADDRESS_STATE || 'TX',
    zip: process.env.BUSINESS_ADDRESS_ZIP || '76513',
    country: 'US',
    phone: process.env.BUSINESS_PHONE || '2545551234',
  };

  // For now, we'll just use the first/largest package
  // In production, you might create multiple shipments for multiple packages
  const primaryPackage = packages.reduce((largest, pkg) => 
    (pkg.weight_oz > largest.weight_oz) ? pkg : largest
  , packages[0]);

  try {
    const shipment = await client.Shipment.create({
      from_address: fromAddress,
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
        length: primaryPackage.length,
        width: primaryPackage.width,
        height: primaryPackage.height,
        weight: primaryPackage.weight_oz, // EasyPost uses ounces
      },
      options: {
        // Request specific USPS services
        carrier_accounts: [], // Leave empty to get all available carriers
      },
    });

    // Filter to only USPS rates and specific services we want
    const uspsServices = [
      'GroundAdvantage',
      'Ground Advantage',
      'Priority',
      'Express',
    ];

    const filteredRates = shipment.rates
      .filter((rate: any) => rate.carrier === 'USPS')
      .filter((rate: any) => 
        uspsServices.some(service => 
          rate.service.toLowerCase().includes(service.toLowerCase())
        )
      )
      .map((rate: any) => ({
        id: rate.id,
        carrier: rate.carrier,
        service: rate.service,
        rate: rate.rate,
        est_delivery_days: rate.est_delivery_days,
        delivery_date: rate.delivery_date,
        delivery_date_guaranteed: rate.delivery_date_guaranteed || false,
      }));

    return {
      rates: filteredRates,
      shipment_id: shipment.id,
    };
  } catch (error: any) {
    console.error('EasyPost get rates error:', error);
    throw error;
  }
}

// Create a tracker for a shipment
async function createTracker(trackingNumber: string, carrier: string = 'USPS'): Promise<string> {
  if (!client) {
    throw new Error('EasyPost not configured');
  }

  try {
    const tracker = await client.Tracker.create({
      tracking_code: trackingNumber,
      carrier: carrier,
    });

    return tracker.id;
  } catch (error: any) {
    console.error('EasyPost create tracker error:', error);
    throw error;
  }
}

// Get tracker status
async function getTrackerStatus(trackerId: string): Promise<any> {
  if (!client) {
    throw new Error('EasyPost not configured');
  }

  try {
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
}

export default {
  isValidContinentalUS,
  validateAddress,
  getRates,
  createTracker,
  getTrackerStatus,
};