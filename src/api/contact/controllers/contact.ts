// C:\TNT-MKR\tnt-mkr-backend\src\api\contact\controllers\contact.ts
import { factories } from '@strapi/strapi';
import Handlebars from 'handlebars';

export default factories.createCoreController('api::contact.contact', ({ strapi }) => ({
  async create(ctx) {
    const { data } = ctx.request.body;

    if (!data.name || !data.email || !data.message) {
      return ctx.badRequest('Name, email, and message are required');
    }

    // Validate order number if provided
    if (data.orderNumber) {
      const order = await strapi.db.query('api::order.order').findOne({
        where: { order_number: data.orderNumber },
      });
      if (!order) {
        return ctx.badRequest('Invalid order number');
      }
    }

    try {
      const contact = await strapi.entityService.create('api::contact.contact', {
        data: {
          name: data.name,
          email: data.email,
          orderNumber: data.orderNumber || null,
          message: data.message,
          submitted_at: new Date(),
          status: 'pending',
        },
      });

      // Customer email HTML template
      const customerHtmlTemplate = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              background-color: #fefaf0;
              font-family: 'Roboto', sans-serif;
              color: #333;
              margin: 0;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: white;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            h1 {
              color: #fe5100;
              font-size: 24px;
              margin-bottom: 20px;
            }
            p {
              margin: 10px 0;
              font-size: 16px;
            }
            .footer {
              margin-top: 20px;
              font-size: 12px;
              color: #555;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>We’ve Received Your Request</h1>
            <p>Hi {{ name }},</p>
            <p><strong>Your message:</strong> {{ message }}</p>
            <p>We’ll respond within 2 business days.</p>
            <div class="footer">
              <p>© TNT MKR. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Company email HTML template
      const companyHtmlTemplate = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              background-color: #fefaf0;
              font-family: 'Roboto', sans-serif;
              color: #333;
              margin: 0;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: white;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            h1 {
              color: #fe5100;
              font-size: 24px;
              margin-bottom: 20px;
            }
            p {
              margin: 10px 0;
              font-size: 16px;
            }
            .footer {
              margin-top: 20px;
              font-size: 12px;
              color: #555;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>New Customer Inquiry</h1>
            <p><strong>Name:</strong> {{ name }}</p>
            <p><strong>Email:</strong> {{ email }}</p>
            <p><strong>Order Number:</strong> {{ orderNumber }}</p>
            <p><strong>Message:</strong> {{ message }}</p>
            <div class="footer">
              <p>© TNT MKR. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Compile and render customer email
      const compiledCustomerTemplate = Handlebars.compile(customerHtmlTemplate);
      const customerHtml = compiledCustomerTemplate({ name: contact.name, message: contact.message });

      await strapi.plugins['email'].services.email.send({
        to: contact.email,
        from: 'TNT MKR <no-reply@tnt-mkr.com>', // Explicitly set to override defaults if needed
        subject: 'We’ve Received Your Request',
        html: customerHtml,
      });

      // Compile and render company email
      const compiledCompanyTemplate = Handlebars.compile(companyHtmlTemplate);
      const companyHtml = compiledCompanyTemplate({
        name: contact.name,
        email: contact.email,
        orderNumber: contact.orderNumber || 'N/A',
        message: contact.message,
      });

      await strapi.plugins['email'].services.email.send({
        to: 'customer-service@tnt-mkr.com', // Updated to custom address
        from: 'TNT MKR <no-reply@tnt-mkr.com>', // Explicitly set
        subject: 'New Customer Inquiry',
        html: companyHtml,
      });

      strapi.log.info(`[Contact Controller] Emails sent to ${contact.email} and customer-service@tnt-mkr.com`);
      return ctx.created({ message: 'Contact request submitted successfully', data: contact });
    } catch (error) {
      strapi.log.error('[Contact Controller] Error in create:', error);
      return ctx.internalServerError('Failed to process contact request', { cause: error });
    }
  },
}));