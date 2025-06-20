import { factories } from '@strapi/strapi';
import Handlebars from 'handlebars';
import sanitizeHtml from 'sanitize-html';

export default factories.createCoreController('api::contact.contact', ({ strapi }) => ({
  async create(ctx) {
    const { data } = ctx.request.body;

    if (!data.name || !data.email || !data.message) {
      return ctx.badRequest('Name, email, and message are required');
    }

    // Sanitize inputs to prevent XSS
    const sanitizedName = sanitizeHtml(data.name);
    const sanitizedEmail = sanitizeHtml(data.email);
    const sanitizedMessage = sanitizeHtml(data.message);

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
          name: sanitizedName,
          email: sanitizedEmail,
          orderNumber: data.orderNumber || null,
          message: sanitizedMessage,
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
    <h1>Thank You for Contacting TNT MKR!</h1>
    <p>Dear {{ name }},</p>
    <p>Thank you for reaching out to us. We have received your message and will do our best to respond within 2 business days.</p>
    {{#if orderNumber}}
    <p><strong>Order Number:</strong> {{ orderNumber }}</p>
    {{/if}}
    <p><strong>Your Message:</strong></p>
    <p>{{ message }}</p>
    <p>If you have any additional questions or need further assistance, please feel free to reply to this email.</p>
    <p>Best regards,<br>
    The TNT MKR Team</p>
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
      const customerHtml = compiledCustomerTemplate({
        name: contact.name,
        message: contact.message,
        orderNumber: contact.orderNumber,
      });

      await strapi.plugins['email'].services.email.send({
        to: contact.email,
        from: 'TNT MKR <no-reply@tnt-mkr.com>',
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
        to: 'customer-service@tnt-mkr.com',
        from: 'TNT MKR <no-reply@tnt-mkr.com>',
        subject: 'New Customer Inquiry',
        html: companyHtml,
      });

      strapi.log.info(`Emails sent to ${contact.email} and customer-service@tnt-mkr.com`);
      return ctx.created({ message: 'Contact request submitted successfully', data: contact });
    } catch (error) {
      strapi.log.error('Error in contact create:', error);
      return ctx.internalServerError('Failed to process contact request', { cause: error });
    }
  },
}));