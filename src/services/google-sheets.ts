import { google, sheets_v4 } from 'googleapis';

let sheetsClient: sheets_v4.Sheets | null = null;
let spreadsheetId: string = '';

const ORDER_HEADERS = [
  'Order Number',
  'Order Date',
  'Customer Name',
  'Customer Email',
  'Customer Phone',
  'Status',
  'Payment Status',
  'Subtotal',
  'Discount',
  'Shipping',
  'Tax',
  'Total',
  'Shipping Street',
  'Shipping Street2',
  'Shipping City',
  'Shipping State',
  'Shipping Zip',
  'Tracking Number',
  'Carrier',
  'Shipped Date',
  'Delivered Date',
  'Est. Delivery',
  'Package Weight (oz)',
  'Package Dimensions',
  'Box Used',
  'Items',
  'Item Details',
  'Discount Code',
  'Notes',
  'Row ID',
];

// Updated status colors for unified status system
// Blue shades: pending through assembling (preparation stages)
// Orange: packaged (ready to ship)
// Yellow shades: shipped, in_transit, out_for_delivery
// Green: delivered
// Red: canceled
// Purple: returned
const STATUS_COLORS: Record<string, { red: number; green: number; blue: number }> = {
  // Blue shades for preparation stages
  pending: { red: 0.85, green: 0.91, blue: 0.98 },         // Light blue
  paid: { red: 0.78, green: 0.87, blue: 0.97 },            // Slightly darker blue
  printing: { red: 0.71, green: 0.83, blue: 0.96 },        // Medium blue
  printed: { red: 0.64, green: 0.79, blue: 0.95 },         // Darker blue
  assembling: { red: 0.56, green: 0.75, blue: 0.94 },      // Even darker blue
  
  // Orange for packaged
  packaged: { red: 1, green: 0.85, blue: 0.7 },            // Orange
  
  // Yellow shades for shipping stages
  shipped: { red: 1, green: 0.95, blue: 0.7 },             // Light yellow
  in_transit: { red: 1, green: 0.92, blue: 0.6 },          // Yellow
  out_for_delivery: { red: 1, green: 0.88, blue: 0.5 },    // Darker yellow
  
  // Green for delivered
  delivered: { red: 0.8, green: 1, blue: 0.8 },            // Light green
  
  // Red for canceled
  canceled: { red: 1, green: 0.8, blue: 0.8 },             // Light red
  
  // Purple for returned
  returned: { red: 0.9, green: 0.8, blue: 1 },             // Light purple
};

export const initGoogleSheets = async (): Promise<boolean> => {
  try {
    const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n');
    spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '';

    if (!clientEmail || !privateKey || !spreadsheetId) {
      console.log('Google Sheets not configured - missing credentials');
      return false;
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    sheetsClient = google.sheets({ version: 'v4', auth });
    console.log('Google Sheets initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize Google Sheets:', error);
    return false;
  }
};

export const ensureOrdersSheet = async (): Promise<boolean> => {
  if (!sheetsClient) {
    const initialized = await initGoogleSheets();
    if (!initialized) return false;
  }

  try {
    // Get existing sheets
    const response = await sheetsClient!.spreadsheets.get({
      spreadsheetId,
    });

    const sheets = response.data.sheets || [];
    const ordersSheet = sheets.find(s => s.properties?.title === 'Orders');

    if (!ordersSheet) {
      // Create Orders sheet
      await sheetsClient!.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: 'Orders',
                  index: 0,
                },
              },
            },
          ],
        },
      });

      // Add headers
      await sheetsClient!.spreadsheets.values.update({
        spreadsheetId,
        range: 'Orders!A1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [ORDER_HEADERS],
        },
      });

      // Format header row (bold, freeze)
      const sheetId = (await sheetsClient!.spreadsheets.get({ spreadsheetId }))
        .data.sheets?.find(s => s.properties?.title === 'Orders')?.properties?.sheetId;

      if (sheetId !== undefined) {
        await sheetsClient!.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                repeatCell: {
                  range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                  cell: {
                    userEnteredFormat: {
                      textFormat: { bold: true },
                      backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
                    },
                  },
                  fields: 'userEnteredFormat(textFormat,backgroundColor)',
                },
              },
              {
                updateSheetProperties: {
                  properties: {
                    sheetId,
                    gridProperties: { frozenRowCount: 1 },
                  },
                  fields: 'gridProperties.frozenRowCount',
                },
              },
            ],
          },
        });
      }

      console.log('Created Orders sheet with headers');
    }

    // Check for Pirate Ship Export sheet
    const pirateSheet = sheets.find(s => s.properties?.title === 'Pirate Ship Export');
    if (!pirateSheet) {
      await sheetsClient!.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: 'Pirate Ship Export',
                  index: 1,
                },
              },
            },
          ],
        },
      });

      // Add Pirate Ship headers
      const pirateHeaders = [
        'Order ID',
        'Ship To Name',
        'Ship To Company',
        'Ship To Address 1',
        'Ship To Address 2',
        'Ship To City',
        'Ship To State',
        'Ship To Zip',
        'Ship To Country',
        'Ship To Phone',
        'Weight (oz)',
        'Length',
        'Width',
        'Height',
      ];

      await sheetsClient!.spreadsheets.values.update({
        spreadsheetId,
        range: 'Pirate Ship Export!A1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [pirateHeaders],
        },
      });

      console.log('Created Pirate Ship Export sheet');
    }

    return true;
  } catch (error) {
    console.error('Error ensuring Orders sheet:', error);
    return false;
  }
};

interface OrderData {
  id: number;
  order_number: string;
  ordered_at: string;
  customer_name: string;
  customer_email?: string;
  guest_email?: string;
  customer_phone?: string;
  order_status: string;
  payment_status: string;
  subtotal: number;
  discount_total?: number;
  shipping_cost?: number;
  sales_tax?: number;
  total_amount: number;
  shipping_address?: {
    street: string;
    street2?: string;
    city: string;
    state: string;
    postal_code: string;
  };
  tracking_number?: string;
  carrier_service?: string;
  shipped_at?: string;
  delivered_at?: string;
  estimated_delivery_date?: string;
  package_weight_oz?: number;
  package_length?: number;
  package_width?: number;
  package_height?: number;
  shipping_box?: { name: string };
  order_items?: Array<{
    product?: { name: string };
    quantity: number;
    price: number;
    order_item_parts?: Array<{
      product_part?: { name: string };
      color?: { name: string };
    }>;
  }>;
  discount_code?: { code: string };
  admin_notes?: string;
  google_sheet_row?: number;
  user?: { email: string };
}

const formatCurrency = (cents: number): string => {
  return `$${(cents / 100).toFixed(2)}`;
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US');
};

export const upsertOrder = async (order: OrderData): Promise<number | null> => {
  if (!sheetsClient) {
    const initialized = await initGoogleSheets();
    if (!initialized) return null;
  }

  await ensureOrdersSheet();

  try {
    // Build item summary
    const items = order.order_items || [];
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const itemSummary = items.map(item => `${item.product?.name || 'Item'} x${item.quantity}`).join(', ');
    const itemDetails = items.map(item => {
      const parts = item.order_item_parts?.map(p => `${p.product_part?.name}: ${p.color?.name}`).join(', ') || '';
      return `${item.product?.name || 'Item'} x${item.quantity} @ ${formatCurrency(item.price * 100)}${parts ? ` (${parts})` : ''}`;
    }).join(' | ');

    const dimensions = order.package_length && order.package_width && order.package_height
      ? `${order.package_length}x${order.package_width}x${order.package_height}"`
      : '';

    const rowData = [
      order.order_number,
      formatDate(order.ordered_at),
      order.customer_name,
      order.customer_email || order.guest_email || order.user?.email || '',
      order.customer_phone || '',
      order.order_status,
      order.payment_status,
      formatCurrency(order.subtotal),
      order.discount_total ? formatCurrency(order.discount_total) : '',
      order.shipping_cost ? formatCurrency(order.shipping_cost) : '',
      order.sales_tax ? formatCurrency(order.sales_tax) : '',
      formatCurrency(order.total_amount),
      order.shipping_address?.street || '',
      order.shipping_address?.street2 || '',
      order.shipping_address?.city || '',
      order.shipping_address?.state || '',
      order.shipping_address?.postal_code || '',
      order.tracking_number || '',
      order.carrier_service || '',
      formatDate(order.shipped_at),
      formatDate(order.delivered_at),
      order.estimated_delivery_date || '',
      order.package_weight_oz?.toString() || '',
      dimensions,
      order.shipping_box?.name || '',
      `${itemCount} item(s): ${itemSummary}`,
      itemDetails,
      order.discount_code?.code || '',
      order.admin_notes || '',
      order.id.toString(),
    ];

    let rowNumber: number;

    if (order.google_sheet_row) {
      // Update existing row
      rowNumber = order.google_sheet_row;
      await sheetsClient!.spreadsheets.values.update({
        spreadsheetId,
        range: `Orders!A${rowNumber}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [rowData],
        },
      });
    } else {
      // Find existing row by order number or append
      const existingData = await sheetsClient!.spreadsheets.values.get({
        spreadsheetId,
        range: 'Orders!A:A',
      });

      const rows = existingData.data.values || [];
      const existingRowIndex = rows.findIndex(row => row[0] === order.order_number);

      if (existingRowIndex > 0) {
        rowNumber = existingRowIndex + 1;
        await sheetsClient!.spreadsheets.values.update({
          spreadsheetId,
          range: `Orders!A${rowNumber}`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [rowData],
          },
        });
      } else {
        // Append new row
        const appendResult = await sheetsClient!.spreadsheets.values.append({
          spreadsheetId,
          range: 'Orders!A:A',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: [rowData],
          },
        });

        const updatedRange = appendResult.data.updates?.updatedRange || '';
        const match = updatedRange.match(/Orders!A(\d+)/);
        rowNumber = match ? parseInt(match[1]) : rows.length + 1;
      }
    }

    // Update row color based on status
    await updateRowColor(rowNumber, order.order_status);

    return rowNumber;
  } catch (error) {
    console.error('Error upserting order to Google Sheets:', error);
    return null;
  }
};

export const updateRowColor = async (rowNumber: number, status: string): Promise<void> => {
  if (!sheetsClient) return;

  try {
    const response = await sheetsClient.spreadsheets.get({ spreadsheetId });
    const sheetId = response.data.sheets?.find(s => s.properties?.title === 'Orders')?.properties?.sheetId;

    if (sheetId === undefined) return;

    const color = STATUS_COLORS[status] || { red: 1, green: 1, blue: 1 };

    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: rowNumber - 1,
                endRowIndex: rowNumber,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: color,
                },
              },
              fields: 'userEnteredFormat.backgroundColor',
            },
          },
        ],
      },
    });
  } catch (error) {
    console.error('Error updating row color:', error);
  }
};

export const addToPirateShipExport = async (orders: OrderData[]): Promise<boolean> => {
  if (!sheetsClient) {
    const initialized = await initGoogleSheets();
    if (!initialized) return false;
  }

  try {
    const rows = orders.map(order => [
      order.order_number,
      order.customer_name,
      '', // Company
      order.shipping_address?.street || '',
      order.shipping_address?.street2 || '',
      order.shipping_address?.city || '',
      order.shipping_address?.state || '',
      order.shipping_address?.postal_code || '',
      'US',
      order.customer_phone || '',
      order.package_weight_oz?.toString() || '8',
      order.package_length?.toString() || '8',
      order.package_width?.toString() || '6',
      order.package_height?.toString() || '4',
    ]);

    // Clear existing data (except headers)
    await sheetsClient!.spreadsheets.values.clear({
      spreadsheetId,
      range: 'Pirate Ship Export!A2:N1000',
    });

    // Add new data
    await sheetsClient!.spreadsheets.values.update({
      spreadsheetId,
      range: 'Pirate Ship Export!A2',
      valueInputOption: 'RAW',
      requestBody: {
        values: rows,
      },
    });

    return true;
  } catch (error) {
    console.error('Error adding to Pirate Ship export:', error);
    return false;
  }
};

export const getPirateShipCSV = async (orders: OrderData[]): Promise<string> => {
  const headers = [
    'Order ID',
    'Ship To Name',
    'Ship To Company',
    'Ship To Address 1',
    'Ship To Address 2',
    'Ship To City',
    'Ship To State',
    'Ship To Zip',
    'Ship To Country',
    'Ship To Phone',
    'Weight (oz)',
    'Length',
    'Width',
    'Height',
  ];

  const rows = orders.map(order => [
    order.order_number,
    order.customer_name,
    '',
    order.shipping_address?.street || '',
    order.shipping_address?.street2 || '',
    order.shipping_address?.city || '',
    order.shipping_address?.state || '',
    order.shipping_address?.postal_code || '',
    'US',
    order.customer_phone || '',
    order.package_weight_oz?.toString() || '8',
    order.package_length?.toString() || '8',
    order.package_width?.toString() || '6',
    order.package_height?.toString() || '4',
  ]);

  const csvRows = [headers, ...rows].map(row =>
    row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
  );

  return csvRows.join('\n');
};

export default {
  initGoogleSheets,
  ensureOrdersSheet,
  upsertOrder,
  updateRowColor,
  addToPirateShipExport,
  getPirateShipCSV,
};