const SHIPPING_BOXES = [
  // Small boxes (priority 1-6) - $1.00 handling fee
  { name: '4x4x2', length: 4, width: 4, height: 2, empty_weight_oz: 1.5, max_weight_oz: 320, priority: 1 },
  { name: '5x5x2', length: 5, width: 5, height: 2, empty_weight_oz: 2, max_weight_oz: 400, priority: 2 },
  { name: '6x4x2', length: 6, width: 4, height: 2, empty_weight_oz: 2, max_weight_oz: 400, priority: 3 },
  { name: '6x6x2', length: 6, width: 6, height: 2, empty_weight_oz: 2.5, max_weight_oz: 480, priority: 4 },
  { name: '7x5x2', length: 7, width: 5, height: 2, empty_weight_oz: 2.5, max_weight_oz: 480, priority: 5 },
  { name: '8x6x2', length: 8, width: 6, height: 2, empty_weight_oz: 3, max_weight_oz: 560, priority: 6 },
  
  // Medium boxes (priority 7-19) - $2.25 handling fee
  { name: '6x6x4', length: 6, width: 6, height: 4, empty_weight_oz: 4, max_weight_oz: 640, priority: 7 },
  { name: '8x6x4', length: 8, width: 6, height: 4, empty_weight_oz: 5, max_weight_oz: 720, priority: 8 },
  { name: '8x8x4', length: 8, width: 8, height: 4, empty_weight_oz: 6, max_weight_oz: 800, priority: 9 },
  { name: '10x8x4', length: 10, width: 8, height: 4, empty_weight_oz: 7, max_weight_oz: 880, priority: 10 },
  { name: '10x10x4', length: 10, width: 10, height: 4, empty_weight_oz: 8, max_weight_oz: 960, priority: 11 },
  { name: '12x8x4', length: 12, width: 8, height: 4, empty_weight_oz: 8, max_weight_oz: 960, priority: 12 },
  { name: '12x10x4', length: 12, width: 10, height: 4, empty_weight_oz: 9, max_weight_oz: 1040, priority: 13 },
  { name: '12x12x4', length: 12, width: 12, height: 4, empty_weight_oz: 10, max_weight_oz: 1120, priority: 14 },
  { name: '8x8x6', length: 8, width: 8, height: 6, empty_weight_oz: 8, max_weight_oz: 880, priority: 15 },
  { name: '10x8x6', length: 10, width: 8, height: 6, empty_weight_oz: 9, max_weight_oz: 960, priority: 16 },
  { name: '10x10x6', length: 10, width: 10, height: 6, empty_weight_oz: 10, max_weight_oz: 1040, priority: 17 },
  { name: '12x10x6', length: 12, width: 10, height: 6, empty_weight_oz: 12, max_weight_oz: 1120, priority: 18 },
  { name: '12x12x6', length: 12, width: 12, height: 6, empty_weight_oz: 14, max_weight_oz: 1120, priority: 19 },
  
  // Large boxes (priority 20-30) - $4.00 handling fee
  { name: '10x10x8', length: 10, width: 10, height: 8, empty_weight_oz: 14, max_weight_oz: 1120, priority: 20 },
  { name: '12x10x8', length: 12, width: 10, height: 8, empty_weight_oz: 16, max_weight_oz: 1120, priority: 21 },
  { name: '12x12x8', length: 12, width: 12, height: 8, empty_weight_oz: 18, max_weight_oz: 1120, priority: 22 },
  { name: '14x10x8', length: 14, width: 10, height: 8, empty_weight_oz: 20, max_weight_oz: 1120, priority: 23 },
  { name: '14x14x8', length: 14, width: 14, height: 8, empty_weight_oz: 24, max_weight_oz: 1120, priority: 24 },
  { name: '12x12x10', length: 12, width: 12, height: 10, empty_weight_oz: 22, max_weight_oz: 1120, priority: 25 },
  { name: '14x12x10', length: 14, width: 12, height: 10, empty_weight_oz: 26, max_weight_oz: 1120, priority: 26 },
  { name: '16x12x10', length: 16, width: 12, height: 10, empty_weight_oz: 30, max_weight_oz: 1120, priority: 27 },
  { name: '16x16x12', length: 16, width: 16, height: 12, empty_weight_oz: 40, max_weight_oz: 1120, priority: 28 },
  { name: '20x16x12', length: 20, width: 16, height: 12, empty_weight_oz: 50, max_weight_oz: 1120, priority: 29 },
  { name: '24x24x24', length: 24, width: 24, height: 24, empty_weight_oz: 80, max_weight_oz: 1120, priority: 30 },
];

export async function seedShippingBoxes(strapi: any): Promise<void> {
  try {
    // Check if boxes already exist
    const existingBoxes = await strapi.entityService.findMany('api::shipping-box.shipping-box' as any, {
      limit: 1,
    });

    if (existingBoxes && existingBoxes.length > 0) {
      strapi.log.info('Shipping boxes already seeded, skipping...');
      return;
    }

    strapi.log.info('Seeding shipping boxes...');

    for (const box of SHIPPING_BOXES) {
      await strapi.entityService.create('api::shipping-box.shipping-box' as any, {
        data: {
          ...box,
          is_active: true,
        },
      });
    }

    strapi.log.info(`Successfully seeded ${SHIPPING_BOXES.length} shipping boxes`);
    strapi.log.info('Box categories: Small (priority 1-6, $1.00), Medium (priority 7-19, $2.25), Large (priority 20-30, $4.00)');
  } catch (error) {
    strapi.log.error('Error seeding shipping boxes:', error);
  }
}

export default { seedShippingBoxes };