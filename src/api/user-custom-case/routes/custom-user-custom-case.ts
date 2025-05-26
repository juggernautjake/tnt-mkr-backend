export default {
    routes: [
      {
        method: 'GET',
        path: '/user-custom-cases/public',
        handler: 'user-custom-case.getPublicCases',
        config: {
          auth: false,
        },
      },
    ],
  };
  