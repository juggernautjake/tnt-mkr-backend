export default (config, { strapi }) => {
  return async (ctx, next) => {
    strapi.log.debug("isValidGuestSession: Starting validation");

    // Check if user is authenticated
    if (ctx.state.user) {
      strapi.log.debug("isValidGuestSession: User already authenticated", ctx.state.user);
      return await next();
    }

    // Check for Bearer token
    const authHeader = ctx.request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        const decoded = await jwtService.verify(token);
        strapi.log.debug("isValidGuestSession: Decoded JWT", decoded);
        if (decoded && decoded.id) {
          const userService = strapi.plugin('users-permissions').service('user');
          const user = await userService.fetch({ id: decoded.id });
          if (user) {
            strapi.log.debug("isValidGuestSession: Fetched user", user);
            ctx.state.user = user;
            return await next();
          }
        }
      } catch (err) {
        strapi.log.error("isValidGuestSession: JWT verification error", err);
      }
    }

    // Check for guest_session in query or body
    const guestSession = ctx.request.query.guest_session || ctx.request.body?.data?.guest_session;
    if (guestSession && typeof guestSession === 'string' && guestSession.trim() !== '') {
      strapi.log.debug("isValidGuestSession: Found guestSession in request", guestSession);
      ctx.state.guestSessionId = guestSession;
      return await next();
    }

    strapi.log.error("isValidGuestSession: No valid JWT or guest session found");
    return ctx.throw(401, 'Authentication or valid guest session required');
  };
};