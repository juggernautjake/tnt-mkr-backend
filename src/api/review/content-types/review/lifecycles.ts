import { Strapi } from '@strapi/strapi';

// Define interfaces for the data returned by entityService
interface ReviewData {
  id: number;
  rating: number;
  product: { id: number };
  publishedAt: string | null;
}

interface ProductData {
  id: number;
  star_rating: number | null;
  review_count: number;
}

export default {
  async afterUpdate(event: any) {
    const { result } = event;
    const review = (await (strapi as Strapi).entityService.findOne(
      'api::review.review',
      result.id,
      {
        populate: ['product'],
      }
    )) as ReviewData;

    if (review && review.product) {
      await updateProductRating(review.product.id);
    }
  },

  async afterDelete(event: any) {
    const { result } = event;
    const deletedReview = result as ReviewData;
    if (deletedReview && deletedReview.product) {
      await updateProductRating(deletedReview.product.id);
    }
  },
};

async function updateProductRating(productId: number) {
  const reviews = (await (strapi as Strapi).entityService.findMany(
    'api::review.review',
    {
      filters: {
        product: { id: productId },
        publishedAt: { $ne: null }, // Only count published reviews
      },
      fields: ['rating'],
    }
  )) as ReviewData[];

  if (reviews.length === 0) {
    await (strapi as Strapi).entityService.update('api::product.product', productId, {
      data: {
        star_rating: null,
        review_count: 0,
      },
    });
    return;
  }

  const totalRating = reviews.reduce((sum: number, review: ReviewData) => sum + review.rating, 0);
  const averageRating = totalRating / reviews.length;

  await (strapi as Strapi).entityService.update('api::product.product', productId, {
    data: {
      star_rating: averageRating,
      review_count: reviews.length,
    },
  });
}
