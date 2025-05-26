// src/types/strapi.d.ts
import { Strapi } from '@strapi/strapi';
import { RedisClientType } from 'redis';

declare module '@strapi/strapi' {
  interface Strapi {
    redis?: RedisClientType;
  }

  interface StrapiEntities {
    'api::cart.cart': {
      id: number;         // Use number for IDs
      cart_items: number[];    // Array of Cart Item IDs as numbers (updated from items)
      total: number;
      user?: { id: number }; // User id as number
      // Add additional fields as needed
    };
    'api::cart-item.cart-item': {
      id: number;         // Use number for IDs
      product: number;
      cart: number;
      quantity: number;
      price: number;
      // Add additional fields as needed
    };
    // Extend with additional custom entity types if needed
  }
}
