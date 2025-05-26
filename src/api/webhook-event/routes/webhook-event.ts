export default {
    routes: [
      {
        method: 'POST',
        path: '/webhook-events',
        handler: 'webhook-event.create',
        config: {
          policies: [],
          middlewares: [],
        },
      },
    ],
  };