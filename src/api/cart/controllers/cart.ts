import { factories } from "@strapi/strapi";
import { errors } from "@strapi/utils";
import { Context } from "koa";
import crypto from 'crypto';

const { ApplicationError } = errors;

async function calculateEffectivePrice(strapi: any, productId: number): Promise<number> {
  const currentDate = new Date().toISOString().split('T')[0];
  
  const product = await strapi.entityService.findOne('api::product.product', productId, {
    populate: ['promotions'],
  });

  let effectivePrice = product.default_price;
  
  const promotions = await strapi.db.query('api::promotion.promotion').findMany({
    where: {
      products: { id: productId },
      start_date: { $lte: currentDate },
      end_date: { $gte: currentDate },
      publishedAt: { $ne: null },
    },
  });

  promotions.forEach((promotion: any) => {
    if (promotion.discount_percentage) {
      const discount = product.default_price * (promotion.discount_percentage / 100);
      effectivePrice = Math.min(effectivePrice, product.default_price - discount);
    } else if (promotion.discount_amount) {
      effectivePrice = Math.min(effectivePrice, product.default_price - promotion.discount_amount);
    }
  });

  if (promotions.length === 0 && product.on_sale && product.discounted_price) {
    effectivePrice = product.discounted_price;
  }

  return Number(effectivePrice.toFixed(2));
}

export default factories.createCoreController("api::cart.cart", ({ strapi }) => ({
  async find(ctx: Context) {
    const { active, filters = {} } = ctx.query as any;
    const userId = ctx.state.user?.id;
    const guestSession = filters.guest_session || ctx.cookies.get("session_id") || crypto.randomUUID();

    if (active === "true") {
      const queryFilters = userId
        ? { user: { id: userId }, status: "active" }
        : { guest_session: guestSession, status: "active" };

      try {
        const carts = await strapi.db.query("api::cart.cart").findMany({
          where: queryFilters,
          populate: {
            cart_items: {
              populate: {
                product: {
                  populate: ["thumbnail_image", "promotions"],
                },
                cart_item_parts: {
                  populate: ["product_part", "color"],
                },
              },
            },
          },
        });

        if (carts.length === 0) {
          const cartData = {
            total: "0.00",
            status: "active",
            user: userId || null,
            guest_session: userId ? null : guestSession,
            cart_items: [],
          };
          const newCart = await strapi.db.query("api::cart.cart").create({
            data: cartData,
            populate: {
              cart_items: {
                populate: {
                  product: {
                    populate: ["thumbnail_image", "promotions"],
                  },
                  cart_item_parts: {
                    populate: ["product_part", "color"],
                  },
                },
              },
            },
          });

          if (!userId) ctx.cookies.set("session_id", guestSession, { httpOnly: true, sameSite: "none", secure: true });
          return { data: newCart };
        }

        const cart = carts[0];
        const cartItems = cart.cart_items || [];
        const total = await cartItems.reduce(async (sumPromise: Promise<number>, item: any) => {
          const sum = await sumPromise;
          const effectivePrice = await calculateEffectivePrice(strapi, item.product.id);
          return sum + effectivePrice * (item.quantity || 1);
        }, Promise.resolve(0));

        cart.total = Number(total.toFixed(2));
        return { data: cart };
      } catch (error) {
        strapi.log.error("Error fetching or creating active cart:", error);
        throw new ApplicationError("Failed to fetch or create active cart", { cause: error });
      }
    } else {
      const populate = {
        cart_items: {
          populate: {
            product: {
              populate: ["thumbnail_image", "promotions"],
            },
            cart_item_parts: {
              populate: ["product_part", "color"],
            },
          },
        },
      };

      const carts = await strapi.db.query("api::cart.cart").findMany({
        where: filters,
        populate,
      });

      const enhancedCarts = await Promise.all(carts.map(async (cart: any) => {
        const cartItems = cart.cart_items || [];
        const total = await cartItems.reduce(async (sumPromise: Promise<number>, item: any) => {
          const sum = await sumPromise;
          const effectivePrice = await calculateEffectivePrice(strapi, item.product.id);
          return sum + effectivePrice * (item.quantity || 1);
        }, Promise.resolve(0));

        return { ...cart, total: Number(total.toFixed(2)) };
      }));

      return { data: enhancedCarts };
    }
  },

  async update(ctx: Context) {
    const { id } = ctx.params as { id: string };
    const { data } = ctx.request.body as any;
    const user = ctx.state.user;
    const sessionId = ctx.cookies.get("session_id");

    const cart = await strapi.entityService.findOne("api::cart.cart", id, {
      populate: ["user", "cart_items"],
    });

    if (!cart) {
      return ctx.notFound("Cart not found");
    }

    if (user && cart.user?.id !== user.id) {
      return ctx.forbidden("You do not have permission to update this cart");
    }
    if (!user && cart.guest_session !== sessionId) {
      return ctx.forbidden("You do not have permission to update this cart");
    }

    if (data.clearItems) {
      try {
        await strapi.entityService.deleteMany('api::cart-item.cart-item', {
          filters: { cart: { id: id } },
        });
        data.total = "0.00";
        delete data.clearItems;
      } catch (error) {
        strapi.log.error('[Cart Update] Error clearing items:', error);
        throw new ApplicationError('Failed to clear cart items', { cause: error });
      }
    }

    if (data.cart_items) {
      const total = await data.cart_items.reduce(async (sumPromise: Promise<number>, item: any) => {
        const sum = await sumPromise;
        const effectivePrice = await calculateEffectivePrice(strapi, item.product);
        return sum + effectivePrice * (item.quantity || 1);
      }, Promise.resolve(0));
      data.total = Number(total.toFixed(2));
    }

    const updatedCart = await strapi.entityService.update("api::cart.cart", id, {
      data,
      populate: ["cart_items"],
    });

    return this.transformResponse(updatedCart);
  },

  async create(ctx: Context) {
    const { data } = ctx.request.body as any || {};
    const { user } = ctx.state;
    const sessionId = data.guest_session || ctx.cookies.get("session_id") || crypto.randomUUID();

    if (!data || typeof data !== "object") {
      return ctx.badRequest("Request body must contain a valid data object");
    }

    if (data.cart_items) {
      data.total = await data.cart_items.reduce(async (sumPromise: Promise<number>, item: any) => {
        const sum = await sumPromise;
        const effectivePrice = await calculateEffectivePrice(strapi, item.product);
        return sum + effectivePrice * (item.quantity || 1);
      }, Promise.resolve(0));
      data.total = Number(data.total.toFixed(2));
    } else {
      data.total = "0.00";
    }

    const cartData = {
      ...data,
      status: "active",
      user: user ? user.id : null,
      guest_session: user ? null : sessionId,
    };

    try {
      const cart = await strapi.entityService.create("api::cart.cart", {
        data: cartData,
        populate: ["cart_items"],
      });
      if (!user) ctx.cookies.set("session_id", sessionId, { httpOnly: true, sameSite: "none", secure: true });

      return this.transformResponse(cart);
    } catch (error) {
      strapi.log.error("Error in create cart:", error);
      throw new ApplicationError("Failed to create cart", { cause: error });
    }
  },

  async findGuestCart(ctx: Context) {
    const { guestSession } = ctx.query as { guestSession?: string };

    if (!guestSession) {
      return ctx.badRequest("Guest session ID is required");
    }

    try {
      const carts = await strapi.entityService.findMany("api::cart.cart", {
        filters: { guest_session: guestSession, status: "active" },
        populate: {
          cart_items: {
            populate: {
              product: {
                populate: ["thumbnail_image", "promotions"],
              },
              cart_item_parts: {
                populate: ["product_part", "color"],
              },
            },
          },
        },
      });

      if (carts.length === 0) {
        const newCart = await strapi.entityService.create("api::cart.cart", {
          data: {
            guest_session: guestSession,
            total: "0.00",
            status: "active",
          },
          populate: {
            cart_items: {
              populate: {
                product: {
                  populate: ["thumbnail_image", "promotions"],
                },
                cart_item_parts: {
                  populate: ["product_part", "color"],
                },
              },
            },
          },
        });
        ctx.cookies.set("session_id", guestSession, { httpOnly: true, sameSite: "none", secure: true });
        return this.transformResponse(newCart);
      }

      const cart = carts[0];
      const cartItems = cart.cart_items || [];
      const total = await cartItems.reduce(async (sumPromise: Promise<number>, item: any) => {
        const sum = await sumPromise;
        const effectivePrice = await calculateEffectivePrice(strapi, item.product.id);
        return sum + effectivePrice * (item.quantity || 1);
      }, Promise.resolve(0));

      cart.total = Number(total.toFixed(2));
      return this.transformResponse(cart);
    } catch (error) {
      strapi.log.error("Error fetching guest cart:", error);
      throw new ApplicationError("Failed to fetch guest cart", { cause: error });
    }
  },
}));