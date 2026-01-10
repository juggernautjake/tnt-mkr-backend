import type { Attribute, Schema } from '@strapi/strapi';

export interface AdminApiToken extends Schema.CollectionType {
  collectionName: 'strapi_api_tokens';
  info: {
    description: '';
    displayName: 'Api Token';
    name: 'Api Token';
    pluralName: 'api-tokens';
    singularName: 'api-token';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::api-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    description: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Attribute.DefaultTo<''>;
    expiresAt: Attribute.DateTime;
    lastUsedAt: Attribute.DateTime;
    lifespan: Attribute.BigInteger;
    name: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Attribute.Relation<
      'admin::api-token',
      'oneToMany',
      'admin::api-token-permission'
    >;
    type: Attribute.Enumeration<['read-only', 'full-access', 'custom']> &
      Attribute.Required &
      Attribute.DefaultTo<'read-only'>;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'admin::api-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminApiTokenPermission extends Schema.CollectionType {
  collectionName: 'strapi_api_token_permissions';
  info: {
    description: '';
    displayName: 'API Token Permission';
    name: 'API Token Permission';
    pluralName: 'api-token-permissions';
    singularName: 'api-token-permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::api-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    token: Attribute.Relation<
      'admin::api-token-permission',
      'manyToOne',
      'admin::api-token'
    >;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'admin::api-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminPermission extends Schema.CollectionType {
  collectionName: 'admin_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'Permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    actionParameters: Attribute.JSON & Attribute.DefaultTo<{}>;
    conditions: Attribute.JSON & Attribute.DefaultTo<[]>;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    properties: Attribute.JSON & Attribute.DefaultTo<{}>;
    role: Attribute.Relation<'admin::permission', 'manyToOne', 'admin::role'>;
    subject: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'admin::permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminRole extends Schema.CollectionType {
  collectionName: 'admin_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'Role';
    pluralName: 'roles';
    singularName: 'role';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    code: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'admin::role', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    description: Attribute.String;
    name: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Attribute.Relation<
      'admin::role',
      'oneToMany',
      'admin::permission'
    >;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<'admin::role', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    users: Attribute.Relation<'admin::role', 'manyToMany', 'admin::user'>;
  };
}

export interface AdminTransferToken extends Schema.CollectionType {
  collectionName: 'strapi_transfer_tokens';
  info: {
    description: '';
    displayName: 'Transfer Token';
    name: 'Transfer Token';
    pluralName: 'transfer-tokens';
    singularName: 'transfer-token';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::transfer-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    description: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Attribute.DefaultTo<''>;
    expiresAt: Attribute.DateTime;
    lastUsedAt: Attribute.DateTime;
    lifespan: Attribute.BigInteger;
    name: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Attribute.Relation<
      'admin::transfer-token',
      'oneToMany',
      'admin::transfer-token-permission'
    >;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'admin::transfer-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminTransferTokenPermission extends Schema.CollectionType {
  collectionName: 'strapi_transfer_token_permissions';
  info: {
    description: '';
    displayName: 'Transfer Token Permission';
    name: 'Transfer Token Permission';
    pluralName: 'transfer-token-permissions';
    singularName: 'transfer-token-permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::transfer-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    token: Attribute.Relation<
      'admin::transfer-token-permission',
      'manyToOne',
      'admin::transfer-token'
    >;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'admin::transfer-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminUser extends Schema.CollectionType {
  collectionName: 'admin_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'User';
    pluralName: 'users';
    singularName: 'user';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    blocked: Attribute.Boolean & Attribute.Private & Attribute.DefaultTo<false>;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'admin::user', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    email: Attribute.Email &
      Attribute.Required &
      Attribute.Private &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    firstname: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    isActive: Attribute.Boolean &
      Attribute.Private &
      Attribute.DefaultTo<false>;
    lastname: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    password: Attribute.Password &
      Attribute.Private &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    preferedLanguage: Attribute.String;
    registrationToken: Attribute.String & Attribute.Private;
    resetPasswordToken: Attribute.String & Attribute.Private;
    roles: Attribute.Relation<'admin::user', 'manyToMany', 'admin::role'> &
      Attribute.Private;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<'admin::user', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    username: Attribute.String;
  };
}

export interface ApiAddressAddress extends Schema.CollectionType {
  collectionName: 'addresses';
  info: {
    description: '';
    displayName: 'Address';
    pluralName: 'addresses';
    singularName: 'address';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    city: Attribute.String & Attribute.Required;
    country: Attribute.String & Attribute.Required & Attribute.DefaultTo<'US'>;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::address.address',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    easypost_id: Attribute.String;
    is_billing: Attribute.Boolean & Attribute.DefaultTo<false>;
    is_default_billing: Attribute.Boolean & Attribute.DefaultTo<false>;
    is_default_shipping: Attribute.Boolean & Attribute.DefaultTo<false>;
    is_shipping: Attribute.Boolean & Attribute.DefaultTo<false>;
    is_validated: Attribute.Boolean & Attribute.DefaultTo<false>;
    label: Attribute.String;
    phone: Attribute.String;
    postal_code: Attribute.String & Attribute.Required;
    publishedAt: Attribute.DateTime;
    state: Attribute.String & Attribute.Required;
    street: Attribute.String & Attribute.Required;
    street2: Attribute.String;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::address.address',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    user: Attribute.Relation<
      'api::address.address',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ApiCartItemPartCartItemPart extends Schema.CollectionType {
  collectionName: 'cart_item_parts';
  info: {
    displayName: 'Cart Item Part';
    pluralName: 'cart-item-parts';
    singularName: 'cart-item-part';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    cart_item: Attribute.Relation<
      'api::cart-item-part.cart-item-part',
      'manyToOne',
      'api::cart-item.cart-item'
    >;
    color: Attribute.Relation<
      'api::cart-item-part.cart-item-part',
      'oneToOne',
      'api::color.color'
    >;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::cart-item-part.cart-item-part',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    product_part: Attribute.Relation<
      'api::cart-item-part.cart-item-part',
      'oneToOne',
      'api::product-part.product-part'
    >;
    publishedAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::cart-item-part.cart-item-part',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiCartItemCartItem extends Schema.CollectionType {
  collectionName: 'cart_items';
  info: {
    description: 'Individual line items in a shopping cart.';
    displayName: 'Cart Item';
    pluralName: 'cart-items';
    singularName: 'cart-item';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    base_price: Attribute.Decimal & Attribute.Required;
    cart: Attribute.Relation<
      'api::cart-item.cart-item',
      'manyToOne',
      'api::cart.cart'
    >;
    cart_item_parts: Attribute.Relation<
      'api::cart-item.cart-item',
      'oneToMany',
      'api::cart-item-part.cart-item-part'
    >;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::cart-item.cart-item',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    effective_price: Attribute.Decimal & Attribute.Required;
    engravings: Attribute.Component<'customization.engraving', true>;
    is_additional_part: Attribute.Boolean & Attribute.DefaultTo<false>;
    original_price: Attribute.Decimal;
    product: Attribute.Relation<
      'api::cart-item.cart-item',
      'manyToOne',
      'api::product.product'
    >;
    quantity: Attribute.Integer &
      Attribute.Required &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::cart-item.cart-item',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiCartCart extends Schema.CollectionType {
  collectionName: 'carts';
  info: {
    description: 'Shopping carts for authenticated and guest users.';
    displayName: 'Cart';
    pluralName: 'carts';
    singularName: 'cart';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    cart_items: Attribute.Relation<
      'api::cart.cart',
      'oneToMany',
      'api::cart-item.cart-item'
    >;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'api::cart.cart', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    guest_session: Attribute.String & Attribute.Unique;
    status: Attribute.Enumeration<['active', 'abandoned', 'converted']> &
      Attribute.DefaultTo<'active'>;
    total: Attribute.Decimal & Attribute.Required;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<'api::cart.cart', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    user: Attribute.Relation<
      'api::cart.cart',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ApiCategoryCategory extends Schema.CollectionType {
  collectionName: 'categories';
  info: {
    description: '';
    displayName: 'Category';
    pluralName: 'categories';
    singularName: 'category';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::category.category',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    description: Attribute.Text;
    discount_codes: Attribute.Relation<
      'api::category.category',
      'manyToMany',
      'api::discount-code.discount-code'
    >;
    name: Attribute.String & Attribute.Required;
    products: Attribute.Relation<
      'api::category.category',
      'manyToMany',
      'api::product.product'
    >;
    publishedAt: Attribute.DateTime;
    slug: Attribute.String & Attribute.Unique;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::category.category',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiColorColor extends Schema.CollectionType {
  collectionName: 'colors';
  info: {
    description: '';
    displayName: 'Color';
    pluralName: 'colors';
    singularName: 'color';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::color.color',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    hex_codes: Attribute.JSON;
    name: Attribute.String & Attribute.Required;
    product_parts: Attribute.Relation<
      'api::color.color',
      'manyToMany',
      'api::product-part.product-part'
    >;
    products: Attribute.Relation<
      'api::color.color',
      'manyToMany',
      'api::product.product'
    >;
    publishedAt: Attribute.DateTime;
    type: Attribute.Enumeration<['standard', 'metallic', 'rainbow']>;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::color.color',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    user_custom_cases: Attribute.Relation<
      'api::color.color',
      'manyToMany',
      'api::user-custom-case.user-custom-case'
    >;
  };
}

export interface ApiContactContact extends Schema.CollectionType {
  collectionName: 'contacts';
  info: {
    description: 'Stores customer support inquiries';
    displayName: 'Contact';
    pluralName: 'contacts';
    singularName: 'contact';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::contact.contact',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    email: Attribute.Email & Attribute.Required;
    message: Attribute.Text & Attribute.Required;
    name: Attribute.String & Attribute.Required;
    orderNumber: Attribute.String;
    status: Attribute.Enumeration<['pending', 'responded', 'closed']> &
      Attribute.DefaultTo<'pending'>;
    submitted_at: Attribute.DateTime &
      Attribute.Required &
      Attribute.DefaultTo<'now()'>;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::contact.contact',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiDeviceDevice extends Schema.CollectionType {
  collectionName: 'devices';
  info: {
    description: 'Devices compatible with products';
    displayName: 'Device';
    pluralName: 'devices';
    singularName: 'device';
  };
  options: {
    draftAndPublish: true;
  };
  pluginOptions: {
    'content-manager': {
      displayField: 'model';
    };
  };
  attributes: {
    brand: Attribute.String & Attribute.Required;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::device.device',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    dimensions: Attribute.String;
    model: Attribute.String & Attribute.Required;
    products: Attribute.Relation<
      'api::device.device',
      'oneToMany',
      'api::product.product'
    >;
    publishedAt: Attribute.DateTime;
    type: Attribute.Enumeration<['phone', 'gaming_device', 'earbud_case']> &
      Attribute.Required;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::device.device',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiDiscountCodeDiscountCode extends Schema.CollectionType {
  collectionName: 'discount_codes';
  info: {
    displayName: 'Discount Code';
    pluralName: 'discount-codes';
    singularName: 'discount-code';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    active: Attribute.Boolean & Attribute.DefaultTo<true>;
    categories: Attribute.Relation<
      'api::discount-code.discount-code',
      'manyToMany',
      'api::category.category'
    >;
    code: Attribute.String & Attribute.Required & Attribute.Unique;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::discount-code.discount-code',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    discount_amount: Attribute.Decimal;
    discount_percentage: Attribute.Integer &
      Attribute.SetMinMax<
        {
          max: 100;
          min: 0;
        },
        number
      >;
    orders: Attribute.Relation<
      'api::discount-code.discount-code',
      'oneToMany',
      'api::order.order'
    >;
    products: Attribute.Relation<
      'api::discount-code.discount-code',
      'manyToMany',
      'api::product.product'
    >;
    promotions: Attribute.Relation<
      'api::discount-code.discount-code',
      'manyToMany',
      'api::promotion.promotion'
    >;
    publishedAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::discount-code.discount-code',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    valid_until: Attribute.DateTime;
  };
}

export interface ApiEmailCheckEmailCheck extends Schema.CollectionType {
  collectionName: 'email_checks';
  info: {
    description: 'Temporary collection for email existence checking';
    displayName: 'EmailCheck';
    pluralName: 'email-checks';
    singularName: 'email-check';
  };
  options: {
    draftAndPublish: false;
    timestamps: false;
  };
  attributes: {
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::email-check.email-check',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    email: Attribute.Email;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::email-check.email-check',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiEngravingOptionEngravingOption
  extends Schema.CollectionType {
  collectionName: 'engraving_options';
  info: {
    displayName: 'Engraving Option';
    pluralName: 'engraving-options';
    singularName: 'engraving-option';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::engraving-option.engraving-option',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    description: Attribute.Blocks;
    image: Attribute.Media<'images'>;
    name: Attribute.String & Attribute.Required & Attribute.Unique;
    products: Attribute.Relation<
      'api::engraving-option.engraving-option',
      'manyToMany',
      'api::product.product'
    >;
    publishedAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::engraving-option.engraving-option',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiOrderItemPartOrderItemPart extends Schema.CollectionType {
  collectionName: 'order_item_parts';
  info: {
    displayName: 'Order Item Part';
    pluralName: 'order-item-parts';
    singularName: 'order-item-part';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    color: Attribute.Relation<
      'api::order-item-part.order-item-part',
      'oneToOne',
      'api::color.color'
    >;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::order-item-part.order-item-part',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    order_item: Attribute.Relation<
      'api::order-item-part.order-item-part',
      'manyToOne',
      'api::order-item.order-item'
    >;
    product_part: Attribute.Relation<
      'api::order-item-part.order-item-part',
      'oneToOne',
      'api::product-part.product-part'
    >;
    publishedAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::order-item-part.order-item-part',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiOrderItemOrderItem extends Schema.CollectionType {
  collectionName: 'order_items';
  info: {
    description: 'A line item in an order';
    displayName: 'Order Item';
    pluralName: 'order-items';
    singularName: 'order-item';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    base_price: Attribute.Decimal & Attribute.Required;
    colors: Attribute.Relation<
      'api::order-item.order-item',
      'manyToMany',
      'api::color.color'
    >;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::order-item.order-item',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    engravings: Attribute.Component<'customization.engraving', true>;
    is_additional_part: Attribute.Boolean & Attribute.DefaultTo<false>;
    order: Attribute.Relation<
      'api::order-item.order-item',
      'manyToOne',
      'api::order.order'
    >;
    order_item_parts: Attribute.Relation<
      'api::order-item.order-item',
      'oneToMany',
      'api::order-item-part.order-item-part'
    >;
    price: Attribute.Decimal & Attribute.Required;
    product: Attribute.Relation<
      'api::order-item.order-item',
      'manyToOne',
      'api::product.product'
    > &
      Attribute.Required;
    promotions: Attribute.Relation<
      'api::order-item.order-item',
      'manyToMany',
      'api::promotion.promotion'
    >;
    quantity: Attribute.Integer &
      Attribute.Required &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::order-item.order-item',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiOrderOrder extends Schema.CollectionType {
  collectionName: 'orders';
  info: {
    description: '';
    displayName: 'Order';
    pluralName: 'orders';
    singularName: 'order';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    admin_notes: Attribute.Text;
    billing_address: Attribute.Relation<
      'api::order.order',
      'oneToOne',
      'api::address.address'
    >;
    carrier_service: Attribute.String;
    confirmation_email_sent: Attribute.Boolean & Attribute.DefaultTo<false>;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::order.order',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    customer_email: Attribute.Email;
    customer_name: Attribute.String & Attribute.Required;
    customer_phone: Attribute.String;
    delivered_at: Attribute.DateTime;
    discount_code: Attribute.Relation<
      'api::order.order',
      'manyToOne',
      'api::discount-code.discount-code'
    >;
    discount_total: Attribute.Integer;
    easypost_rate_id: Attribute.String;
    easypost_shipment_id: Attribute.String;
    easypost_tracker_id: Attribute.String;
    estimated_delivery_date: Attribute.Date;
    google_sheet_row: Attribute.Integer;
    guest_email: Attribute.Email;
    order_items: Attribute.Relation<
      'api::order.order',
      'oneToMany',
      'api::order-item.order-item'
    >;
    order_number: Attribute.String & Attribute.Required & Attribute.Unique;
    order_status: Attribute.Enumeration<
      [
        'pending',
        'paid',
        'processing',
        'shipped',
        'in_transit',
        'out_for_delivery',
        'delivered',
        'canceled',
        'returned'
      ]
    > &
      Attribute.DefaultTo<'pending'>;
    ordered_at: Attribute.DateTime & Attribute.Required;
    package_height: Attribute.Decimal;
    package_length: Attribute.Decimal;
    package_weight_oz: Attribute.Decimal;
    package_width: Attribute.Decimal;
    payment_intent_id: Attribute.String;
    payment_last_four: Attribute.String;
    payment_method: Attribute.String;
    payment_status: Attribute.Enumeration<
      ['pending', 'completed', 'failed', 'refunded']
    > &
      Attribute.DefaultTo<'pending'>;
    sales_tax: Attribute.Integer;
    shipped_at: Attribute.DateTime;
    shipping_address: Attribute.Relation<
      'api::order.order',
      'oneToOne',
      'api::address.address'
    >;
    shipping_box: Attribute.Relation<
      'api::order.order',
      'oneToOne',
      'api::shipping-box.shipping-box'
    >;
    shipping_cost: Attribute.Integer;
    shipping_method: Attribute.Relation<
      'api::order.order',
      'oneToOne',
      'api::shipping-option.shipping-option'
    >;
    shipping_notification_sent: Attribute.Boolean & Attribute.DefaultTo<false>;
    subtotal: Attribute.Integer & Attribute.Required;
    total_amount: Attribute.Integer & Attribute.Required;
    tracking_number: Attribute.String;
    transaction_fee: Attribute.Integer & Attribute.DefaultTo<50>;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::order.order',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    user: Attribute.Relation<
      'api::order.order',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ApiProductPartProductPart extends Schema.CollectionType {
  collectionName: 'product_parts';
  info: {
    description: '';
    displayName: 'Product Part';
    pluralName: 'product-parts';
    singularName: 'product-part';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    colors: Attribute.Relation<
      'api::product-part.product-part',
      'manyToMany',
      'api::color.color'
    >;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::product-part.product-part',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    description: Attribute.Text;
    discounted_price: Attribute.Decimal;
    height: Attribute.Decimal;
    is_full_case: Attribute.Boolean & Attribute.DefaultTo<false>;
    length: Attribute.Decimal;
    name: Attribute.String & Attribute.Required;
    price: Attribute.Decimal & Attribute.Required;
    product: Attribute.Relation<
      'api::product-part.product-part',
      'manyToOne',
      'api::product.product'
    >;
    publishedAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::product-part.product-part',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    weight_oz: Attribute.Decimal & Attribute.Required & Attribute.DefaultTo<1>;
    width: Attribute.Decimal;
  };
}

export interface ApiProductProduct extends Schema.CollectionType {
  collectionName: 'products';
  info: {
    description: '';
    displayName: 'product';
    pluralName: 'products';
    singularName: 'product';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    case_image_files: Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    categories: Attribute.Relation<
      'api::product.product',
      'manyToMany',
      'api::category.category'
    >;
    colors: Attribute.Relation<
      'api::product.product',
      'manyToMany',
      'api::color.color'
    >;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::product.product',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    customizable: Attribute.Boolean;
    default_price: Attribute.Decimal;
    default_shipping_box: Attribute.Relation<
      'api::product.product',
      'oneToOne',
      'api::shipping-box.shipping-box'
    >;
    description: Attribute.Text;
    device: Attribute.Relation<
      'api::product.product',
      'manyToOne',
      'api::device.device'
    >;
    dimensions: Attribute.String;
    discount_codes: Attribute.Relation<
      'api::product.product',
      'manyToMany',
      'api::discount-code.discount-code'
    >;
    discounted_price: Attribute.Decimal;
    effective_price: Attribute.Decimal;
    engraving_options: Attribute.Relation<
      'api::product.product',
      'manyToMany',
      'api::engraving-option.engraving-option'
    >;
    height: Attribute.Decimal;
    keywords: Attribute.String;
    length: Attribute.Decimal;
    materials: Attribute.Component<'products.materials', true>;
    meta_description: Attribute.Text;
    meta_title: Attribute.String;
    name: Attribute.String;
    on_sale: Attribute.Boolean;
    product_parts: Attribute.Relation<
      'api::product.product',
      'oneToMany',
      'api::product-part.product-part'
    >;
    promotions: Attribute.Relation<
      'api::product.product',
      'manyToMany',
      'api::promotion.promotion'
    >;
    publishedAt: Attribute.DateTime;
    review_count: Attribute.Integer;
    reviews: Attribute.Relation<
      'api::product.product',
      'oneToMany',
      'api::review.review'
    >;
    sku: Attribute.String & Attribute.Unique;
    slug: Attribute.String & Attribute.Unique;
    star_rating: Attribute.Decimal;
    three_d_model_file: Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    thumbnail_image: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    units_sold: Attribute.Integer & Attribute.DefaultTo<0>;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::product.product',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    user_custom_cases: Attribute.Relation<
      'api::product.product',
      'oneToMany',
      'api::user-custom-case.user-custom-case'
    >;
    weight_oz: Attribute.Decimal;
    width: Attribute.Decimal;
    wish_lists: Attribute.Relation<
      'api::product.product',
      'manyToMany',
      'api::wish-list.wish-list'
    >;
  };
}

export interface ApiPromotionPromotion extends Schema.CollectionType {
  collectionName: 'promotions';
  info: {
    displayName: 'Promotion';
    pluralName: 'promotions';
    singularName: 'promotion';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::promotion.promotion',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    description: Attribute.Text;
    discount_amount: Attribute.Decimal &
      Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    discount_codes: Attribute.Relation<
      'api::promotion.promotion',
      'manyToMany',
      'api::discount-code.discount-code'
    >;
    discount_percentage: Attribute.Decimal &
      Attribute.SetMinMax<
        {
          max: 100;
          min: 0;
        },
        number
      >;
    end_date: Attribute.Date & Attribute.Required;
    is_preorder: Attribute.Boolean & Attribute.DefaultTo<false>;
    name: Attribute.String & Attribute.Required;
    products: Attribute.Relation<
      'api::promotion.promotion',
      'manyToMany',
      'api::product.product'
    >;
    promotion_images: Attribute.Media<'images', true>;
    promotion_type: Attribute.Enumeration<
      ['summer_sale', 'product_specific', 'site_wide']
    > &
      Attribute.Required;
    publishedAt: Attribute.DateTime;
    start_date: Attribute.Date & Attribute.Required;
    terms_and_conditions: Attribute.Text;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::promotion.promotion',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiReviewReview extends Schema.CollectionType {
  collectionName: 'reviews';
  info: {
    displayName: 'Review';
    pluralName: 'reviews';
    singularName: 'review';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    comment: Attribute.Text;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::review.review',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    images: Attribute.Component<'review.image-with-caption', true> &
      Attribute.SetMinMax<
        {
          max: 5;
        },
        number
      >;
    product: Attribute.Relation<
      'api::review.review',
      'manyToOne',
      'api::product.product'
    >;
    publishedAt: Attribute.DateTime;
    rating: Attribute.Integer &
      Attribute.Required &
      Attribute.SetMinMax<
        {
          max: 5;
          min: 1;
        },
        number
      >;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::review.review',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    user: Attribute.Relation<
      'api::review.review',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ApiShippingBoxShippingBox extends Schema.CollectionType {
  collectionName: 'shipping_boxes';
  info: {
    description: 'Available shipping box sizes for order fulfillment';
    displayName: 'Shipping Box';
    pluralName: 'shipping-boxes';
    singularName: 'shipping-box';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::shipping-box.shipping-box',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    empty_weight_oz: Attribute.Decimal &
      Attribute.Required &
      Attribute.DefaultTo<4>;
    height: Attribute.Decimal & Attribute.Required;
    is_active: Attribute.Boolean & Attribute.DefaultTo<true>;
    length: Attribute.Decimal & Attribute.Required;
    max_weight_oz: Attribute.Decimal &
      Attribute.Required &
      Attribute.DefaultTo<1120>;
    name: Attribute.String & Attribute.Required & Attribute.Unique;
    priority: Attribute.Integer & Attribute.DefaultTo<0>;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::shipping-box.shipping-box',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    width: Attribute.Decimal & Attribute.Required;
  };
}

export interface ApiShippingOptionShippingOption extends Schema.CollectionType {
  collectionName: 'shipping_options';
  info: {
    description: 'Available shipping methods';
    displayName: 'Shipping Option';
    pluralName: 'shipping-options';
    singularName: 'shipping-option';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    baseCost: Attribute.Decimal & Attribute.Required;
    costPerItem: Attribute.Decimal & Attribute.Required;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::shipping-option.shipping-option',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    estimated_delivery: Attribute.String & Attribute.Required;
    name: Attribute.String & Attribute.Required;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::shipping-option.shipping-option',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiSiteSettingSiteSetting extends Schema.SingleType {
  collectionName: 'site_settings';
  info: {
    displayName: 'Site Settings';
    pluralName: 'site-settings';
    singularName: 'site-setting';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::site-setting.site-setting',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    maintenance_mode: Attribute.Boolean & Attribute.DefaultTo<false>;
    theme: Attribute.Enumeration<['light', 'dark']> &
      Attribute.DefaultTo<'light'>;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::site-setting.site-setting',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiUserCustomCaseUserCustomCase extends Schema.CollectionType {
  collectionName: 'user_custom_cases';
  info: {
    description: '';
    displayName: 'User Custom Case';
    pluralName: 'user-custom-cases';
    singularName: 'user-custom-case';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::user-custom-case.user-custom-case',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    engravings: Attribute.Component<'customization.engraving', true>;
    name: Attribute.String & Attribute.Required;
    preview_model_file: Attribute.Media<'images' | 'files'>;
    product: Attribute.Relation<
      'api::user-custom-case.user-custom-case',
      'manyToOne',
      'api::product.product'
    >;
    public: Attribute.Boolean & Attribute.DefaultTo<false>;
    publishedAt: Attribute.DateTime;
    selected_colors: Attribute.Relation<
      'api::user-custom-case.user-custom-case',
      'manyToMany',
      'api::color.color'
    >;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::user-custom-case.user-custom-case',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    user: Attribute.Relation<
      'api::user-custom-case.user-custom-case',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ApiWebhookEventWebhookEvent extends Schema.CollectionType {
  collectionName: 'webhook_events';
  info: {
    displayName: 'Webhook Event';
    pluralName: 'webhook-events';
    singularName: 'webhook-event';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::webhook-event.webhook-event',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    event_data: Attribute.JSON;
    event_id: Attribute.String & Attribute.Required & Attribute.Unique;
    event_type: Attribute.String & Attribute.Required;
    processed: Attribute.Boolean & Attribute.DefaultTo<false>;
    source: Attribute.String & Attribute.Required;
    timestamp: Attribute.DateTime & Attribute.Required;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::webhook-event.webhook-event',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiWishListWishList extends Schema.CollectionType {
  collectionName: 'wish_lists';
  info: {
    description: 'A collection of wishlists for authenticated users.';
    displayName: 'Wish List';
    pluralName: 'wish-lists';
    singularName: 'wish-list';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::wish-list.wish-list',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    date_created: Attribute.DateTime & Attribute.DefaultTo<'now()'>;
    name: Attribute.String &
      Attribute.Required &
      Attribute.DefaultTo<'Default'>;
    products: Attribute.Relation<
      'api::wish-list.wish-list',
      'manyToMany',
      'api::product.product'
    >;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'api::wish-list.wish-list',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    user: Attribute.Relation<
      'api::wish-list.wish-list',
      'manyToOne',
      'plugin::users-permissions.user'
    > &
      Attribute.Required;
  };
}

export interface PluginContentReleasesRelease extends Schema.CollectionType {
  collectionName: 'strapi_releases';
  info: {
    displayName: 'Release';
    pluralName: 'releases';
    singularName: 'release';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    actions: Attribute.Relation<
      'plugin::content-releases.release',
      'oneToMany',
      'plugin::content-releases.release-action'
    >;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::content-releases.release',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    name: Attribute.String & Attribute.Required;
    releasedAt: Attribute.DateTime;
    scheduledAt: Attribute.DateTime;
    status: Attribute.Enumeration<
      ['ready', 'blocked', 'failed', 'done', 'empty']
    > &
      Attribute.Required;
    timezone: Attribute.String;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'plugin::content-releases.release',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginContentReleasesReleaseAction
  extends Schema.CollectionType {
  collectionName: 'strapi_release_actions';
  info: {
    displayName: 'Release Action';
    pluralName: 'release-actions';
    singularName: 'release-action';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    contentType: Attribute.String & Attribute.Required;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::content-releases.release-action',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    entry: Attribute.Relation<
      'plugin::content-releases.release-action',
      'morphToOne'
    >;
    isEntryValid: Attribute.Boolean;
    locale: Attribute.String;
    release: Attribute.Relation<
      'plugin::content-releases.release-action',
      'manyToOne',
      'plugin::content-releases.release'
    >;
    type: Attribute.Enumeration<['publish', 'unpublish']> & Attribute.Required;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'plugin::content-releases.release-action',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUploadFile extends Schema.CollectionType {
  collectionName: 'files';
  info: {
    description: '';
    displayName: 'File';
    pluralName: 'files';
    singularName: 'file';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    alternativeText: Attribute.String;
    caption: Attribute.String;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::upload.file',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    ext: Attribute.String;
    folder: Attribute.Relation<
      'plugin::upload.file',
      'manyToOne',
      'plugin::upload.folder'
    > &
      Attribute.Private;
    folderPath: Attribute.String &
      Attribute.Required &
      Attribute.Private &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    formats: Attribute.JSON;
    hash: Attribute.String & Attribute.Required;
    height: Attribute.Integer;
    mime: Attribute.String & Attribute.Required;
    name: Attribute.String & Attribute.Required;
    previewUrl: Attribute.String;
    provider: Attribute.String & Attribute.Required;
    provider_metadata: Attribute.JSON;
    related: Attribute.Relation<'plugin::upload.file', 'morphToMany'>;
    size: Attribute.Decimal & Attribute.Required;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'plugin::upload.file',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    url: Attribute.String & Attribute.Required;
    width: Attribute.Integer;
  };
}

export interface PluginUploadFolder extends Schema.CollectionType {
  collectionName: 'upload_folders';
  info: {
    displayName: 'Folder';
    pluralName: 'folders';
    singularName: 'folder';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    children: Attribute.Relation<
      'plugin::upload.folder',
      'oneToMany',
      'plugin::upload.folder'
    >;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::upload.folder',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    files: Attribute.Relation<
      'plugin::upload.folder',
      'oneToMany',
      'plugin::upload.file'
    >;
    name: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    parent: Attribute.Relation<
      'plugin::upload.folder',
      'manyToOne',
      'plugin::upload.folder'
    >;
    path: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    pathId: Attribute.Integer & Attribute.Required & Attribute.Unique;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'plugin::upload.folder',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUsersPermissionsPermission
  extends Schema.CollectionType {
  collectionName: 'up_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String & Attribute.Required;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::users-permissions.permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    role: Attribute.Relation<
      'plugin::users-permissions.permission',
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'plugin::users-permissions.permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUsersPermissionsRole extends Schema.CollectionType {
  collectionName: 'up_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'role';
    pluralName: 'roles';
    singularName: 'role';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    description: Attribute.String;
    name: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    permissions: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToMany',
      'plugin::users-permissions.permission'
    >;
    type: Attribute.String & Attribute.Unique;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    users: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToMany',
      'plugin::users-permissions.user'
    >;
  };
}

export interface PluginUsersPermissionsUser extends Schema.CollectionType {
  collectionName: 'up_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'User';
    pluralName: 'users';
    singularName: 'user';
  };
  options: {
    draftAndPublish: false;
    timestamps: true;
  };
  attributes: {
    blocked: Attribute.Boolean & Attribute.DefaultTo<false>;
    carts: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::cart.cart'
    >;
    confirmationToken: Attribute.String & Attribute.Private;
    confirmed: Attribute.Boolean & Attribute.DefaultTo<false>;
    createdAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    email: Attribute.Email &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    orders: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::order.order'
    >;
    password: Attribute.Password &
      Attribute.Private &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    pendingGuestSession: Attribute.String & Attribute.Private;
    phone: Attribute.String;
    provider: Attribute.String;
    resetPasswordToken: Attribute.String & Attribute.Private;
    reviews: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::review.review'
    >;
    role: Attribute.Relation<
      'plugin::users-permissions.user',
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    theme: Attribute.Enumeration<['light', 'dark']> &
      Attribute.DefaultTo<'light'>;
    updatedAt: Attribute.DateTime;
    updatedBy: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    user_custom_cases: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::user-custom-case.user-custom-case'
    >;
    username: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    wish_lists: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::wish-list.wish-list'
    >;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface ContentTypes {
      'admin::api-token': AdminApiToken;
      'admin::api-token-permission': AdminApiTokenPermission;
      'admin::permission': AdminPermission;
      'admin::role': AdminRole;
      'admin::transfer-token': AdminTransferToken;
      'admin::transfer-token-permission': AdminTransferTokenPermission;
      'admin::user': AdminUser;
      'api::address.address': ApiAddressAddress;
      'api::cart-item-part.cart-item-part': ApiCartItemPartCartItemPart;
      'api::cart-item.cart-item': ApiCartItemCartItem;
      'api::cart.cart': ApiCartCart;
      'api::category.category': ApiCategoryCategory;
      'api::color.color': ApiColorColor;
      'api::contact.contact': ApiContactContact;
      'api::device.device': ApiDeviceDevice;
      'api::discount-code.discount-code': ApiDiscountCodeDiscountCode;
      'api::email-check.email-check': ApiEmailCheckEmailCheck;
      'api::engraving-option.engraving-option': ApiEngravingOptionEngravingOption;
      'api::order-item-part.order-item-part': ApiOrderItemPartOrderItemPart;
      'api::order-item.order-item': ApiOrderItemOrderItem;
      'api::order.order': ApiOrderOrder;
      'api::product-part.product-part': ApiProductPartProductPart;
      'api::product.product': ApiProductProduct;
      'api::promotion.promotion': ApiPromotionPromotion;
      'api::review.review': ApiReviewReview;
      'api::shipping-box.shipping-box': ApiShippingBoxShippingBox;
      'api::shipping-option.shipping-option': ApiShippingOptionShippingOption;
      'api::site-setting.site-setting': ApiSiteSettingSiteSetting;
      'api::user-custom-case.user-custom-case': ApiUserCustomCaseUserCustomCase;
      'api::webhook-event.webhook-event': ApiWebhookEventWebhookEvent;
      'api::wish-list.wish-list': ApiWishListWishList;
      'plugin::content-releases.release': PluginContentReleasesRelease;
      'plugin::content-releases.release-action': PluginContentReleasesReleaseAction;
      'plugin::upload.file': PluginUploadFile;
      'plugin::upload.folder': PluginUploadFolder;
      'plugin::users-permissions.permission': PluginUsersPermissionsPermission;
      'plugin::users-permissions.role': PluginUsersPermissionsRole;
      'plugin::users-permissions.user': PluginUsersPermissionsUser;
    }
  }
}
