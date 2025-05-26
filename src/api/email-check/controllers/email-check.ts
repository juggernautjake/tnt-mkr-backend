import { Strapi } from '@strapi/strapi';
import { Context } from 'koa';

export default {
  async emailExists(ctx: Context) {
    const { email } = ctx.query;
    
    // Log the received email parameter
    strapi.log.debug('Received email for check:', { email });

    // Validate email parameter
    if (!email || typeof email !== 'string') {
      strapi.log.debug('Email validation failed', { email, type: typeof email });
      return ctx.badRequest('Email is required and must be a string');
    }

    try {
      // Execute raw SQL query
      const rawResult = await strapi.db.connection.raw(
        'SELECT EXISTS(SELECT 1 FROM up_users WHERE email = ?) AS "exists"',
        [email]
      );
      
      // Log the full raw result from the database
      strapi.log.debug('Raw query result:', rawResult);

      // Extract rows from the result
      const { rows } = rawResult;
      
      // Log the rows array
      strapi.log.debug('Extracted rows:', rows);

      // Check if rows exist and have data
      if (!rows || rows.length === 0) {
        strapi.log.debug('No rows returned from query');
        return { exists: false };
      }

      // Get the first row
      const result = rows[0];
      
      // Log the final result before returning
      strapi.log.debug('Query result:', result);

      return { exists: Boolean(result.exists) };
    } catch (error) {
      // Log the error with details
      strapi.log.error('Error checking email existence:', error);
      return ctx.internalServerError('Failed to check email existence');
    }
  },
};