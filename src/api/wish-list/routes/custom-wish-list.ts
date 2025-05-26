export default {
    routes: [
      {
        method: 'POST',
        path: '/wish-lists/add-product',
        handler: 'wish-list.addProduct',
        config: {
          auth: {
            scope: ['authenticated'],
          },
        },
      },
      {
        method: 'POST',
        path: '/wish-lists/remove-product',
        handler: 'wish-list.removeProduct',
        config: {
          auth: {
            scope: ['authenticated'],
          },
        },
      },
    ],
  };
  