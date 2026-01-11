// src/services/order-email-templates.ts
// Email templates for all order status notifications

interface OrderData {
  id: number;
  order_number: string;
  customer_name: string;
  customer_email?: string;
  guest_email?: string;
  user?: { email: string };
  tracking_number?: string;
  carrier_service?: string;
  estimated_delivery_date?: string;
  shipped_at?: string;
  delivered_at?: string;
  shipping_address?: {
    street: string;
    street2?: string;
    city: string;
    state: string;
    postal_code: string;
  };
  order_items?: Array<{
    product?: { name: string };
    quantity: number;
    order_item_parts?: Array<{
      product_part?: { name: string };
      color?: { name: string };
    }>;
  }>;
  total_amount?: number;
  subtotal?: number;
  shipping_cost?: number;
  sales_tax?: number;
  discount_total?: number;
}

interface EmailTemplate {
  subject: string;
  html: string;
}

const BASE_STYLES = `
  body { background-color: #fefaf0; font-family: 'Roboto', Arial, sans-serif; color: #333; margin: 0; padding: 20px; }
  .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 8px 16px rgba(0, 0, 0, 0.25); border: 3px solid; border-image: linear-gradient(45deg, #fe5100, white, #fe5100) 1; }
  h1 { color: #fe5100; font-size: 28px; font-weight: bold; margin-bottom: 20px; text-align: center; }
  h2 { color: #333; font-size: 20px; font-weight: bold; margin: 25px 0 15px 0; }
  p { margin: 10px 0; font-size: 16px; line-height: 1.5; }
  .highlight-box { background-color: #f5f5f5; border: 2px solid #fe5100; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
  .success-box { background-color: #e8f5e9; border: 2px solid #4caf50; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
  .info-box { background-color: #e3f2fd; border: 2px solid #2196f3; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
  .warning-box { background-color: #fff3e0; border: 2px solid #ff9800; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
  .btn { display: inline-block; margin-top: 15px; padding: 12px 25px; background-color: #fe5100; color: white; text-decoration: none; border-radius: 25px; font-weight: bold; }
  .btn:hover { background-color: #e04600; }
  .order-details { border-top: 1px solid #ddd; padding-top: 15px; margin: 20px 0; }
  .item { border-bottom: 1px solid #eee; padding: 12px 0; }
  .item:last-child { border-bottom: none; }
  .footer { margin-top: 30px; font-size: 13px; color: #666; text-align: center; border-top: 1px solid #ddd; padding-top: 20px; }
`;

function getCustomerEmail(order: OrderData): string {
  return order.customer_email || order.guest_email || order.user?.email || '';
}

function formatDate(dateString?: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatAddress(order: OrderData): string {
  const addr = order.shipping_address;
  if (!addr) return 'Not provided';
  const parts = [
    addr.street,
    addr.street2,
    `${addr.city}, ${addr.state} ${addr.postal_code}`,
  ].filter(Boolean);
  return parts.join('<br>');
}

function buildItemsHtml(order: OrderData): string {
  if (!order.order_items || order.order_items.length === 0) {
    return '<p>No items</p>';
  }
  
  let html = '';
  for (const item of order.order_items) {
    const productName = item.product?.name || 'Product';
    const quantity = item.quantity || 1;
    
    let partsHtml = '';
    for (const part of item.order_item_parts || []) {
      const partName = part.product_part?.name || 'Part';
      const colorName = part.color?.name || 'Color';
      partsHtml += `<div style="margin-top: 5px; font-size: 14px; color: #666;">${partName}: ${colorName}</div>`;
    }
    
    html += `
      <div class="item">
        <div style="font-weight: bold; color: #333;">${productName} × ${quantity}</div>
        ${partsHtml}
      </div>
    `;
  }
  return html;
}

function getTrackingUrl(trackingNumber: string, carrier: string = 'USPS'): string {
  const carrierUrls: Record<string, string> = {
    'USPS': `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
    'UPS': `https://www.ups.com/track?tracknum=${trackingNumber}`,
    'FedEx': `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
    'DHL': `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${trackingNumber}`,
  };
  return carrierUrls[carrier] || carrierUrls['USPS'];
}

function wrapHtml(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="container">
    ${content}
    <div class="footer">
      <p>Thank you for shopping with TNT MKR!</p>
      <p>If you have any questions, please reply to this email.</p>
      <p>© TNT MKR. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

// Generate email template for each status
export function generateStatusEmail(status: string, order: OrderData): EmailTemplate | null {
  const templates: Record<string, () => EmailTemplate> = {
    
    // PENDING - Order received
    pending: () => ({
      subject: `Order Received - ${order.order_number}`,
      html: wrapHtml(`
        <h1>We Got Your Order! ⏳</h1>
        <p style="text-align: center; font-size: 18px;">Thank you for your order, ${order.customer_name}!</p>
        
        <div class="highlight-box">
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Order Number:</p>
          <div style="font-size: 24px; font-weight: bold; color: #fe5100; letter-spacing: 2px;">${order.order_number}</div>
        </div>
        
        <p>We have received your order and it is awaiting payment confirmation. Once your payment is confirmed, we'll begin preparing your custom items right away!</p>
        
        <h2>Order Summary</h2>
        <div class="order-details">
          ${buildItemsHtml(order)}
        </div>
        
        <div class="order-details">
          <p><strong>Shipping to:</strong><br>${order.customer_name}<br>${formatAddress(order)}</p>
        </div>
      `)
    }),
    
    // PAID - Payment confirmed
    paid: () => ({
      subject: `Payment Confirmed - Order ${order.order_number}`,
      html: wrapHtml(`
        <h1>Payment Confirmed! 💰</h1>
        <p style="text-align: center; font-size: 18px;">Great news, ${order.customer_name}!</p>
        
        <div class="success-box">
          <p style="margin: 0; font-size: 18px; color: #2e7d32;">✓ Your payment has been received</p>
          <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Order ${order.order_number}</p>
        </div>
        
        <p>Your order is now in our queue and we'll start preparing your custom items soon. You'll receive another update when we begin printing!</p>
        
        <h2>What's Next?</h2>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p style="margin: 5px 0;"><strong>1.</strong> Our team reviews your order</p>
          <p style="margin: 5px 0;"><strong>2.</strong> 3D printing begins</p>
          <p style="margin: 5px 0;"><strong>3.</strong> Assembly and quality check</p>
          <p style="margin: 5px 0;"><strong>4.</strong> Packaging and shipping</p>
        </div>
        
        <h2>Order Details</h2>
        <div class="order-details">
          ${buildItemsHtml(order)}
        </div>
      `)
    }),
    
    // PRINTING - Items being printed
    printing: () => ({
      subject: `Your Order is Being Printed - ${order.order_number}`,
      html: wrapHtml(`
        <h1>Printing in Progress! 🖨️</h1>
        <p style="text-align: center; font-size: 18px;">Exciting news, ${order.customer_name}!</p>
        
        <div class="info-box">
          <p style="margin: 0; font-size: 20px; color: #1976d2;">🖨️ Your items are being 3D printed!</p>
          <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Order ${order.order_number}</p>
        </div>
        
        <p>Your custom items are now on our 3D printers! Each piece is being carefully crafted layer by layer with precision and care.</p>
        
        <div style="background-color: #fff8e1; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ffc107;">
          <p style="margin: 0; font-size: 14px;"><strong>Did you know?</strong> 3D printing creates incredibly strong, durable products by building them up layer by layer with high-quality materials!</p>
        </div>
        
        <h2>Items Being Printed</h2>
        <div class="order-details">
          ${buildItemsHtml(order)}
        </div>
        
        <p>We'll send you another update once printing is complete and we move to assembly!</p>
      `)
    }),
    
    // PRINTED - Printing complete
    printed: () => ({
      subject: `Printing Complete - Order ${order.order_number}`,
      html: wrapHtml(`
        <h1>Printing Complete! 📄</h1>
        <p style="text-align: center; font-size: 18px;">Great progress on your order, ${order.customer_name}!</p>
        
        <div class="success-box">
          <p style="margin: 0; font-size: 20px; color: #2e7d32;">✓ All items successfully printed!</p>
          <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Order ${order.order_number}</p>
        </div>
        
        <p>All of your items have finished printing and passed our initial quality inspection. They're now ready to move to our assembly team!</p>
        
        <h2>What's Happening Now</h2>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p style="margin: 5px 0;"><span style="color: #4caf50;">✓</span> 3D Printing - <strong>Complete!</strong></p>
          <p style="margin: 5px 0;"><span style="color: #fe5100;">→</span> Assembly - <strong>Up Next</strong></p>
          <p style="margin: 5px 0;"><span style="color: #999;">○</span> Packaging</p>
          <p style="margin: 5px 0;"><span style="color: #999;">○</span> Shipping</p>
        </div>
        
        <h2>Printed Items</h2>
        <div class="order-details">
          ${buildItemsHtml(order)}
        </div>
      `)
    }),
    
    // ASSEMBLING - Items being assembled
    assembling: () => ({
      subject: `Your Order is Being Assembled - ${order.order_number}`,
      html: wrapHtml(`
        <h1>Assembly in Progress! 🔧</h1>
        <p style="text-align: center; font-size: 18px;">Almost there, ${order.customer_name}!</p>
        
        <div class="info-box">
          <p style="margin: 0; font-size: 20px; color: #1976d2;">🔧 Your items are being assembled!</p>
          <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Order ${order.order_number}</p>
        </div>
        
        <p>Our skilled team is now carefully assembling your printed components. Each piece is hand-finished and quality checked to ensure everything is perfect.</p>
        
        <h2>Progress Update</h2>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p style="margin: 5px 0;"><span style="color: #4caf50;">✓</span> 3D Printing - Complete</p>
          <p style="margin: 5px 0;"><span style="color: #fe5100;">→</span> Assembly - <strong>In Progress</strong></p>
          <p style="margin: 5px 0;"><span style="color: #999;">○</span> Packaging</p>
          <p style="margin: 5px 0;"><span style="color: #999;">○</span> Shipping</p>
        </div>
        
        <p>Once assembly is complete, your order will be carefully packaged and ready to ship!</p>
      `)
    }),
    
    // PACKAGED - Ready to ship
    packaged: () => ({
      subject: `Your Order is Ready to Ship - ${order.order_number}`,
      html: wrapHtml(`
        <h1>Packaged & Ready! 📦</h1>
        <p style="text-align: center; font-size: 18px;">Great news, ${order.customer_name}!</p>
        
        <div class="success-box">
          <p style="margin: 0; font-size: 20px; color: #2e7d32;">✓ Your order is packaged and ready to ship!</p>
          <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Order ${order.order_number}</p>
        </div>
        
        <p>All of your items have been assembled, inspected, and carefully packaged. Your order is now in our shipping queue and will be on its way very soon!</p>
        
        <h2>Progress Update</h2>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p style="margin: 5px 0;"><span style="color: #4caf50;">✓</span> 3D Printing - Complete</p>
          <p style="margin: 5px 0;"><span style="color: #4caf50;">✓</span> Assembly - Complete</p>
          <p style="margin: 5px 0;"><span style="color: #4caf50;">✓</span> Packaging - Complete</p>
          <p style="margin: 5px 0;"><span style="color: #fe5100;">→</span> Shipping - <strong>Up Next!</strong></p>
        </div>
        
        <p>You'll receive a tracking number as soon as your package is picked up by the carrier.</p>
        
        <div class="order-details">
          <p><strong>Shipping to:</strong><br>${order.customer_name}<br>${formatAddress(order)}</p>
        </div>
      `)
    }),
    
    // SHIPPED - Order shipped
    shipped: () => {
      const hasTracking = order.tracking_number;
      const trackingUrl = hasTracking ? getTrackingUrl(order.tracking_number!, order.carrier_service) : '';
      const shipDate = formatDate(order.shipped_at) || formatDate(new Date().toISOString());
      
      return {
        subject: `Your Order Has Shipped! - ${order.order_number}`,
        html: wrapHtml(`
          <h1>Your Order Has Shipped! 🚚</h1>
          <p style="text-align: center; font-size: 18px;">Great news, ${order.customer_name}!</p>
          
          ${hasTracking ? `
            <div class="highlight-box">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Your Tracking Number:</p>
              <div style="font-size: 24px; font-weight: bold; color: #fe5100; letter-spacing: 2px;">${order.tracking_number}</div>
              <a href="${trackingUrl}" class="btn" target="_blank">Track Your Package</a>
            </div>
          ` : `
            <div class="info-box">
              <p style="margin: 0; font-size: 18px; color: #1976d2;">📦 Your package is on its way!</p>
              <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Tracking information will be available soon.</p>
            </div>
          `}
          
          ${order.estimated_delivery_date ? `
            <div class="success-box">
              <p style="margin: 0 0 5px 0; font-size: 14px; color: #666;">Estimated Delivery:</p>
              <div style="font-size: 18px; font-weight: bold; color: #2e7d32;">${formatDate(order.estimated_delivery_date)}</div>
            </div>
          ` : ''}
          
          <div class="order-details">
            <p><strong>Order Number:</strong> ${order.order_number}</p>
            <p><strong>Carrier:</strong> ${order.carrier_service || 'USPS'}</p>
            <p><strong>Ship Date:</strong> ${shipDate}</p>
            <p><strong>Shipping to:</strong><br>${order.customer_name}<br>${formatAddress(order)}</p>
          </div>
          
          <h2>Items in This Shipment</h2>
          <div class="order-details">
            ${buildItemsHtml(order)}
          </div>
        `)
      };
    },
    
    // IN_TRANSIT - Package in transit
    in_transit: () => {
      const trackingUrl = order.tracking_number ? getTrackingUrl(order.tracking_number, order.carrier_service) : '';
      
      return {
        subject: `Your Package is On Its Way - ${order.order_number}`,
        html: wrapHtml(`
          <h1>Your Package is On Its Way! 🛣️</h1>
          <p style="text-align: center; font-size: 18px;">Update on your order, ${order.customer_name}!</p>
          
          <div class="info-box">
            <p style="margin: 0; font-size: 20px; color: #1976d2;">📦 Package in transit</p>
            <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Making its way to you!</p>
          </div>
          
          ${order.tracking_number ? `
            <div class="highlight-box">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Tracking Number:</p>
              <div style="font-size: 20px; font-weight: bold; color: #fe5100;">${order.tracking_number}</div>
              <a href="${trackingUrl}" class="btn" target="_blank">Track Your Package</a>
            </div>
          ` : ''}
          
          ${order.estimated_delivery_date ? `
            <div class="success-box">
              <p style="margin: 0 0 5px 0; font-size: 14px; color: #666;">Estimated Delivery:</p>
              <div style="font-size: 18px; font-weight: bold; color: #2e7d32;">${formatDate(order.estimated_delivery_date)}</div>
            </div>
          ` : ''}
          
          <div class="order-details">
            <p><strong>Order Number:</strong> ${order.order_number}</p>
            <p><strong>Carrier:</strong> ${order.carrier_service || 'USPS'}</p>
            <p><strong>Shipping to:</strong><br>${order.customer_name}<br>${formatAddress(order)}</p>
          </div>
        `)
      };
    },
    
    // OUT_FOR_DELIVERY - Package out for delivery
    out_for_delivery: () => {
      const trackingUrl = order.tracking_number ? getTrackingUrl(order.tracking_number, order.carrier_service) : '';
      
      return {
        subject: `Your Package is Out for Delivery Today! - ${order.order_number}`,
        html: wrapHtml(`
          <h1>Out for Delivery! 🏠</h1>
          <p style="text-align: center; font-size: 18px;">Exciting news, ${order.customer_name}!</p>
          
          <div class="success-box">
            <p style="margin: 0; font-size: 24px; color: #2e7d32;">🎉 Your package arrives TODAY!</p>
            <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">It's out for delivery now</p>
          </div>
          
          ${order.tracking_number ? `
            <div class="highlight-box">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Tracking Number:</p>
              <div style="font-size: 20px; font-weight: bold; color: #fe5100;">${order.tracking_number}</div>
              <a href="${trackingUrl}" class="btn" target="_blank">Track Your Package</a>
            </div>
          ` : ''}
          
          <div class="order-details">
            <p><strong>Order Number:</strong> ${order.order_number}</p>
            <p><strong>Delivering to:</strong><br>${order.customer_name}<br>${formatAddress(order)}</p>
          </div>
          
          <p style="text-align: center; margin-top: 20px; color: #666;">Make sure someone is available to receive your package or check your usual delivery spot!</p>
        `)
      };
    },
    
    // DELIVERED - Package delivered
    delivered: () => {
      const deliveryDate = formatDate(order.delivered_at) || formatDate(new Date().toISOString());
      
      return {
        subject: `Your Package Has Been Delivered! - ${order.order_number}`,
        html: wrapHtml(`
          <h1>Package Delivered! ✅</h1>
          <p style="text-align: center; font-size: 18px;">Great news, ${order.customer_name}!</p>
          
          <div class="success-box">
            <p style="margin: 0; font-size: 24px; color: #2e7d32;">✓ Your package has been delivered!</p>
            <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Delivered on ${deliveryDate}</p>
          </div>
          
          <p style="text-align: center;">We hope you love your new items! If you have any questions or concerns about your order, please don't hesitate to contact us.</p>
          
          <div class="order-details">
            <p><strong>Order Number:</strong> ${order.order_number}</p>
            <p><strong>Delivered to:</strong><br>${order.customer_name}<br>${formatAddress(order)}</p>
          </div>
          
          <h2>Items Delivered</h2>
          <div class="order-details">
            ${buildItemsHtml(order)}
          </div>
          
          <div style="background-color: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="margin: 0; font-size: 16px;">💬 <strong>We'd love to hear from you!</strong></p>
            <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">If you're happy with your order, consider leaving us a review!</p>
          </div>
        `)
      };
    },
    
    // CANCELED - Order canceled
    canceled: () => ({
      subject: `Order Canceled - ${order.order_number}`,
      html: wrapHtml(`
        <h1>Order Canceled ❌</h1>
        <p style="text-align: center; font-size: 18px;">Hello ${order.customer_name},</p>
        
        <div class="warning-box">
          <p style="margin: 0; font-size: 18px; color: #e65100;">Your order has been canceled</p>
          <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Order ${order.order_number}</p>
        </div>
        
        <p>We're sorry to inform you that your order has been canceled. If a payment was made, your refund will be processed according to our refund policy.</p>
        
        <h2>Order Details</h2>
        <div class="order-details">
          <p><strong>Order Number:</strong> ${order.order_number}</p>
          <p><strong>Customer:</strong> ${order.customer_name}</p>
        </div>
        
        <div class="order-details">
          ${buildItemsHtml(order)}
        </div>
        
        <p>If you have any questions about this cancellation or if you believe this was done in error, please contact us and we'll be happy to help.</p>
        
        <p style="text-align: center; margin-top: 20px;">
          <a href="mailto:customer-service@tnt-mkr.com" class="btn">Contact Us</a>
        </p>
      `)
    }),
    
    // RETURNED - Order returned
    returned: () => ({
      subject: `Order Return Processed - ${order.order_number}`,
      html: wrapHtml(`
        <h1>Return Processed ↩️</h1>
        <p style="text-align: center; font-size: 18px;">Hello ${order.customer_name},</p>
        
        <div class="info-box">
          <p style="margin: 0; font-size: 18px; color: #1976d2;">Your return has been processed</p>
          <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Order ${order.order_number}</p>
        </div>
        
        <p>We have received and processed your return. Your refund will be issued according to our return policy and should appear in your account within 5-10 business days.</p>
        
        <h2>Return Details</h2>
        <div class="order-details">
          <p><strong>Order Number:</strong> ${order.order_number}</p>
          <p><strong>Customer:</strong> ${order.customer_name}</p>
        </div>
        
        <h2>Returned Items</h2>
        <div class="order-details">
          ${buildItemsHtml(order)}
        </div>
        
        <p>If you have any questions about your return or refund, please don't hesitate to contact us.</p>
        
        <p style="text-align: center; margin-top: 20px;">
          <a href="mailto:customer-service@tnt-mkr.com" class="btn">Contact Us</a>
        </p>
      `)
    }),
  };
  
  const templateFn = templates[status];
  if (!templateFn) {
    return null;
  }
  
  return templateFn();
}

// Send status notification email
export async function sendStatusNotificationEmail(
  strapi: any,
  order: OrderData,
  status: string
): Promise<{ success: boolean; reason?: string; sentTo?: string; error?: string }> {
  const customerEmail = getCustomerEmail(order);
  const customerServiceEmail = process.env.DEFAULT_REPLY_TO_EMAIL || 'customer-service@tnt-mkr.com';
  
  if (!customerEmail) {
    strapi.log.warn(`[STATUS EMAIL] No email available for order ${order.order_number}`);
    return { success: false, reason: 'no_email' };
  }
  
  const template = generateStatusEmail(status, order);
  if (!template) {
    strapi.log.warn(`[STATUS EMAIL] No template for status "${status}"`);
    return { success: false, reason: 'no_template' };
  }
  
  try {
    await strapi.plugins['email'].services.email.send({
      to: customerEmail,
      bcc: customerServiceEmail,
      from: process.env.DEFAULT_FROM_EMAIL || 'TNT MKR <no-reply@tnt-mkr.com>',
      replyTo: customerServiceEmail,
      subject: template.subject,
      html: template.html,
    });
    
    strapi.log.info(`[STATUS EMAIL] Sent "${status}" notification to ${customerEmail} for order ${order.order_number}`);
    return { success: true, sentTo: customerEmail };
  } catch (error: any) {
    strapi.log.error(`[STATUS EMAIL] Failed to send "${status}" notification: ${error.message}`);
    return { success: false, reason: 'send_failed', error: error.message };
  }
}

export default {
  generateStatusEmail,
  sendStatusNotificationEmail,
};