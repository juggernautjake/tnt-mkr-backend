export default {
    routes: [
      {
        method: 'GET',
        path: '/email-check/email-exists',
        handler: 'email-check.emailExists',
        config: {
          policies: [],
          auth: false, // Publicly accessible
        },
      },
    ],
  };