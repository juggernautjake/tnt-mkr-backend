import { Strapi } from '@strapi/strapi';
import { sanitize } from '@strapi/utils';
import { Context } from 'koa';

declare const strapi: Strapi;

export default {
  async find(ctx: Context) {
    const { query } = ctx;
    try {
      strapi.log.debug('Fetching users with query:', query);
      const users = await strapi
        .plugin('users-permissions')
        .service('user')
        .fetchAll(query);
      const sanitizedUsers = await sanitize.contentAPI.output(users, strapi.getModel('plugin::users-permissions.user'));
      strapi.log.debug('Users fetched successfully:', (sanitizedUsers as any[]).length);
      return sanitizedUsers;
    } catch (error) {
      strapi.log.error('Error fetching users:', error);
      throw new Error('Failed to fetch users');
    }
  },
};