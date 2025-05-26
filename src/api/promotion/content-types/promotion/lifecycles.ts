export default {
    beforeCreate(event) {
      const { data } = event.params;
      if (data.discount_percentage && data.discount_amount) {
        throw new Error('Only one of discount_percentage or discount_amount can be set.');
      }
      if (!data.discount_percentage && !data.discount_amount) {
        throw new Error('At least one of discount_percentage or discount_amount must be set.');
      }
    },
    beforeUpdate(event) {
      const { data } = event.params;
      if (data.discount_percentage && data.discount_amount) {
        throw new Error('Only one of discount_percentage or discount_amount can be set.');
      }
      if (data.discount_percentage === null && data.discount_amount === null) {
        throw new Error('At least one of discount_percentage or discount_amount must be set.');
      }
    }
  };