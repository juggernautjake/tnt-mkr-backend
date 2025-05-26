import type { Attribute, Schema } from '@strapi/strapi';

export interface CustomizationEngraving extends Schema.Component {
  collectionName: 'components_customization_engravings';
  info: {
    description: 'Engraving options for customization';
    displayName: 'Engraving';
    icon: 'pencil';
  };
  attributes: {
    font: Attribute.String;
    position: Attribute.Enumeration<
      ['back', 'left', 'right', 'top', 'bottom']
    > &
      Attribute.Required;
    text: Attribute.Text & Attribute.Required;
  };
}

export interface PaymentPaymentMethods extends Schema.Component {
  collectionName: 'components_payment_payment_methods';
  info: {
    description: 'Stored payment methods for users';
    displayName: 'Payment Methods';
    icon: 'credit-card';
  };
  attributes: {
    card_type: Attribute.String;
    expiry: Attribute.String & Attribute.Required;
    last4: Attribute.String & Attribute.Required;
    payment_method_id: Attribute.String & Attribute.Required;
    provider: Attribute.String & Attribute.Required;
  };
}

export interface ProductsMaterials extends Schema.Component {
  collectionName: 'components_products_materials';
  info: {
    description: 'Materials used in the product';
    displayName: 'Materials';
    icon: 'cube';
  };
  attributes: {
    material_description: Attribute.Text;
    material_type: Attribute.String & Attribute.Required;
  };
}

export interface ReviewImageWithCaption extends Schema.Component {
  collectionName: 'components_review_image_with_captions';
  info: {
    displayName: 'Image with Caption';
    icon: 'picture';
  };
  attributes: {
    caption: Attribute.String & Attribute.Required;
    image: Attribute.Media<'images'> & Attribute.Required;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'customization.engraving': CustomizationEngraving;
      'payment.payment-methods': PaymentPaymentMethods;
      'products.materials': ProductsMaterials;
      'review.image-with-caption': ReviewImageWithCaption;
    }
  }
}
