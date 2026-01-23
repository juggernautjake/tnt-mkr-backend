// src/api/shipping/routes/shipping.ts
export default {
  routes: [
    // Public routes
    {
      method: 'POST',
      path: '/shipping/validate-address',
      handler: 'shipping.validateAddress',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/shipping/rates',
      handler: 'shipping.getRates',
      config: {
        auth: false,
        policies: [],
      },
    },
    // Webhook route (no auth - called by EasyPost)
    {
      method: 'POST',
      path: '/shipping/tracking-webhook',
      handler: 'shipping.trackingWebhook',
      config: {
        auth: false,
        policies: [],
      },
    },
    // Admin routes (require authentication)
    {
      method: 'GET',
      path: '/shipping/admin/orders',
      handler: 'shipping.getAdminOrders',
      config: {
        policies: [],
      },
    },
    {
      method: 'PUT',
      path: '/shipping/admin/orders/:id',
      handler: 'shipping.updateOrderShipping',
      config: {
        policies: [],
      },
    },
    {
      method: 'PUT',
      path: '/shipping/admin/orders/:id/status',
      handler: 'shipping.updateOrderStatus',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/shipping/admin/orders/:id/ship',
      handler: 'shipping.markAsShipped',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/shipping/admin/orders/:id/refresh-tracking',
      handler: 'shipping.refreshTrackingStatus',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/shipping/admin/refresh-all-tracking',
      handler: 'shipping.refreshAllTrackingStatuses',
      config: {
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/shipping/admin/orders/:id/package',
      handler: 'shipping.calculateOrderPackage',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/shipping/admin/bulk-tracking',
      handler: 'shipping.bulkAddTracking',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/shipping/admin/export-pirate-ship',
      handler: 'shipping.exportForPirateShip',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/shipping/admin/sync-google-sheets',
      handler: 'shipping.syncGoogleSheets',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/shipping/admin/test-email',
      handler: 'shipping.testEmail',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/shipping/admin/orders/:id/send-message',
      handler: 'shipping.sendCustomMessage',
      config: {
        policies: [],
      },
    },
  ],
};