// src/services/easypost.ts
import EasyPostClient from '@easypost/api';

// Non-continental US states and territories
const NON_CONTINENTAL_US = ['AK', 'HI', 'PR', 'VI', 'GU', 'AS', 'MP', 'FM', 'MH', 'PW'];

// Initialize EasyPost client
const getClient = () => {
  const apiKey = process.env.NODE_ENV === 'production' 
    ? process.env.EASYPOST_PRODUCTION_API_KEY 
    : process.env.EASYPOST_TEST_API_KEY;
  
  if (!apiKey) {
    throw new Error('EasyPost API key not configured');
  }
  
  return new EasyPostClient(apiKey);
};

interface AddressInput {
  street: string;
  street2?: string;
  city: string;
  state: string;
  postal_code: string;
  phone?: string;
  name?: string;
  company?: string;
}

interface AddressValidationResult {
  is_valid: boolean;
  easypost_id?: string;
  suggested_address?: AddressInput;
  original_address: AddressInput;
  messages?: string[];
  error?: string;
}

interface TrackingResult {
  id: string;
  status: string;
  status_detail?: string;
  est_delivery_date?: string;
  delivered_at?: string;
  tracking_details?: Array<{
    datetime: string;
    message: string;
    status: string;
    tracking_location?: {
      city?: string;
      state?: string;
      zip?: string;
    };
  }>;
}

const easypostService = {
  /**
   * Check if a state code is in the continental US
   */
  isValidContinentalUS(state: string): boolean {
    if (!state) return false;
    const upperState = state.toUpperCase().trim();
    return !NON_CONTINENTAL_US.includes(upperState);
  },

  /**
   * Validate an address using EasyPost
   */
  async validateAddress(address: AddressInput): Promise<AddressValidationResult> {
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
        verify: ['delivery'],
      });

      const verifications = easypostAddress.verifications?.delivery;
      const isValid = verifications?.success === true;
      const messages = verifications?.errors?.map((e: any) => e.message) || [];

      if (isValid) {
        // Check if the returned address differs from input
        const suggestedAddress: AddressInput = {
          street: easypostAddress.street1 || address.street,
          street2: easypostAddress.street2 || '',
          city: easypostAddress.city || address.city,
          state: easypostAddress.state || address.state,
          postal_code: easypostAddress.zip || address.postal_code,
          phone: address.phone,
        };
        
        // Normalize for comparison
        const normalize = (s: string) => s.toUpperCase().trim().replace(/\s+/g, ' ');
        const hasChanges = 
          normalize(suggestedAddress.street) !== normalize(address.street) ||
          normalize(suggestedAddress.city) !== normalize(address.city) ||
          normalize(suggestedAddress.state) !== normalize(address.state) ||
          suggestedAddress.postal_code !== address.postal_code;

        return {
          is_valid: true,
          easypost_id: easypostAddress.id,
          original_address: address,
          suggested_address: hasChanges ? suggestedAddress : undefined,
          messages,
        };
      }

      return {
        is_valid: false,
        original_address: address,
        messages,
        error: messages.length > 0 ? messages.join(', ') : 'Address could not be verified. Please check and try again.',
      };
    } catch (error: any) {
      console.error('EasyPost address validation error:', error);
      
      // Handle specific EasyPost errors
      if (error.message?.includes('ADDRESS.VERIFY.FAILURE')) {
        return {
          is_valid: false,
          original_address: address,
          error: 'This address could not be verified. Please check the street address, city, state, and ZIP code.',
        };
      }
      
      return {
        is_valid: false,
        original_address: address,
        error: error.message || 'Failed to validate address. Please try again.',
      };
    }
  },

  /**
   * Create a shipment and get rates
   */
  async createShipment(
    fromAddress: AddressInput,
    toAddress: AddressInput,
    parcel: { weight_oz: number; length: number; width: number; height: number }
  ) {
    try {
      const client = getClient();

      const shipment = await client.Shipment.create({
        from_address: {
          street1: fromAddress.street,
          street2: fromAddress.street2 || '',
          city: fromAddress.city,
          state: fromAddress.state,
          zip: fromAddress.postal_code,
          country: 'US',
          phone: fromAddress.phone || '',
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
          weight: parcel.weight_oz,
          length: parcel.length,
          width: parcel.width,
          height: parcel.height,
        },
      });

      return {
        id: shipment.id,
        rates: shipment.rates?.map((rate: any) => ({
          id: rate.id,
          carrier: rate.carrier,
          service: rate.service,
          rate: parseFloat(rate.rate),
          delivery_days: rate.delivery_days,
          delivery_date: rate.delivery_date,
          est_delivery_days: rate.est_delivery_days,
        })) || [],
      };
    } catch (error: any) {
      console.error('EasyPost create shipment error:', error);
      throw new Error(error.message || 'Failed to create shipment');
    }
  },

  /**
   * Create a tracker for a tracking number
   * Returns the full tracker object with current status
   */
  async createTracker(trackingNumber: string, carrier: string = 'USPS'): Promise<TrackingResult> {
    try {
      const client = getClient();

      const tracker = await client.Tracker.create({
        tracking_code: trackingNumber,
        carrier: carrier,
      });

      console.log(`[EasyPost] Created tracker for ${trackingNumber}:`, {
        id: tracker.id,
        status: tracker.status,
        est_delivery_date: tracker.est_delivery_date,
      });

      return {
        id: tracker.id,
        status: tracker.status || 'unknown',
        status_detail: tracker.status_detail || '',
        est_delivery_date: tracker.est_delivery_date || undefined,
        delivered_at: tracker.status === 'delivered' 
          ? (tracker.tracking_details?.[0]?.datetime || new Date().toISOString())
          : undefined,
        tracking_details: tracker.tracking_details?.map((detail: any) => ({
          datetime: detail.datetime,
          message: detail.message,
          status: detail.status,
          tracking_location: detail.tracking_location ? {
            city: detail.tracking_location.city,
            state: detail.tracking_location.state,
            zip: detail.tracking_location.zip,
          } : undefined,
        })) || [],
      };
    } catch (error: any) {
      console.error('EasyPost create tracker error:', error);
      // Return a minimal tracker result so the order can still be marked as shipped
      return {
        id: '',
        status: 'unknown',
      };
    }
  },

  /**
   * Get tracking status for an existing tracking number
   * This fetches the latest status directly from the carrier
   */
  async getTrackingStatus(trackingNumber: string, carrier: string = 'USPS'): Promise<TrackingResult | null> {
    try {
      const client = getClient();

      // Create a new tracker to get the latest status
      // EasyPost will return existing tracker data if one exists
      const tracker = await client.Tracker.create({
        tracking_code: trackingNumber,
        carrier: carrier,
      });

      console.log(`[EasyPost] Fetched tracking status for ${trackingNumber}:`, {
        id: tracker.id,
        status: tracker.status,
        status_detail: tracker.status_detail,
      });

      return {
        id: tracker.id,
        status: tracker.status || 'unknown',
        status_detail: tracker.status_detail || '',
        est_delivery_date: tracker.est_delivery_date || undefined,
        delivered_at: tracker.status === 'delivered'
          ? (tracker.tracking_details?.find((d: any) => d.status === 'delivered')?.datetime || new Date().toISOString())
          : undefined,
        tracking_details: tracker.tracking_details?.map((detail: any) => ({
          datetime: detail.datetime,
          message: detail.message,
          status: detail.status,
          tracking_location: detail.tracking_location ? {
            city: detail.tracking_location.city,
            state: detail.tracking_location.state,
            zip: detail.tracking_location.zip,
          } : undefined,
        })) || [],
      };
    } catch (error: any) {
      console.error('EasyPost get tracking status error:', error);
      return null;
    }
  },

  /**
   * Retrieve an existing tracker by ID
   */
  async retrieveTracker(trackerId: string): Promise<TrackingResult | null> {
    try {
      const client = getClient();
      const tracker = await client.Tracker.retrieve(trackerId);

      return {
        id: tracker.id,
        status: tracker.status || 'unknown',
        status_detail: tracker.status_detail || '',
        est_delivery_date: tracker.est_delivery_date || undefined,
        delivered_at: tracker.status === 'delivered'
          ? (tracker.tracking_details?.find((d: any) => d.status === 'delivered')?.datetime || undefined)
          : undefined,
        tracking_details: tracker.tracking_details?.map((detail: any) => ({
          datetime: detail.datetime,
          message: detail.message,
          status: detail.status,
        })) || [],
      };
    } catch (error: any) {
      console.error('EasyPost retrieve tracker error:', error);
      return null;
    }
  },

  /**
   * Get the origin address from environment variables
   */
  getOriginAddress(): AddressInput {
    return {
      street: process.env.ORIGIN_STREET || '',
      city: process.env.ORIGIN_CITY || '',
      state: process.env.ORIGIN_STATE || '',
      postal_code: process.env.ORIGIN_ZIP || '',
      phone: process.env.ORIGIN_PHONE || '',
      name: 'TNT MKR',
      company: 'TNT MKR',
    };
  },

  /**
   * Get shipping rates for packages to an address
   * This is a convenience wrapper around createShipment
   */
  async getRates(
    toAddress: AddressInput,
    packages: Array<{ weight_oz: number; length: number; width: number; height: number }>
  ) {
    const fromAddress = this.getOriginAddress();
    const allRates: any[] = [];
    const shipmentIds: string[] = [];

    for (const parcel of packages) {
      try {
        const shipment = await this.createShipment(fromAddress, toAddress, parcel);
        if (shipment.rates && shipment.rates.length > 0) {
          allRates.push(...shipment.rates);
        }
        if (shipment.id) {
          shipmentIds.push(shipment.id);
        }
      } catch (error: any) {
        console.error('Error getting rates for parcel:', error);
      }
    }

    // Deduplicate and sort rates by price
    const uniqueRates = allRates.reduce((acc: any[], rate: any) => {
      const key = `${rate.carrier}-${rate.service}`;
      const existing = acc.find((r: any) => `${r.carrier}-${r.service}` === key);
      if (!existing || rate.rate < existing.rate) {
        return [...acc.filter((r: any) => `${r.carrier}-${r.service}` !== key), rate];
      }
      return acc;
    }, []);

    uniqueRates.sort((a: any, b: any) => a.rate - b.rate);

    return {
      rates: uniqueRates,
      shipment_ids: shipmentIds,
    };
  },
};

export default easypostService;