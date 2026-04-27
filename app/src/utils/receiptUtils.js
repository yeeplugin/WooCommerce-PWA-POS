/**
 * Utility for generating and printing thermal receipts
 */

export const printReceipt = (order, settings = {}, t, formatPrice) => {
  const html = generateReceiptHTML(order, settings, t, formatPrice);
  
  // Create a hidden iframe for printing
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.body.appendChild(iframe);
  
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  
  // Wait for resources to load, then print
  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 500);
};

const generateReceiptHTML = (order, settings, t, formatPrice) => {
  const { items, id, date, total, subtotal, taxAmount, tip, discount, couponDiscount, paymentMethod, serviceType, table, shippingAddress, customerName } = order;
  const shopName = settings.shopName || window.yeePOSData?.siteTitle || 'YEEPOS STORE';
  const shopAddress = settings.shopAddress || '';
  const shopPhone = settings.shopPhone || '';

  // Use the passed formatPrice or fallback to a simple formatter
  const format = formatPrice || ((val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0));

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @media print {
          @page { margin: 0; }
          body { margin: 0.5cm; }
        }
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
          line-height: 1.4;
          color: #000;
          width: 80mm;
          margin: 0 auto;
          background: #fff;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .border-t { border-top: 1px dashed #000; margin-top: 5px; padding-top: 5px; }
        .border-b { border-bottom: 1px dashed #000; margin-bottom: 5px; padding-bottom: 5px; }
        
        .header { margin-bottom: 15px; }
        .header h1 { font-size: 18px; margin: 0; text-transform: uppercase; }
        .header p { margin: 2px 0; font-size: 10px; }
        
        .info { margin-bottom: 10px; font-size: 10px; }
        .info div { display: flex; justify-content: space-between; }

        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { text-align: left; border-bottom: 1px solid #000; font-size: 10px; padding: 5px 0; }
        td { padding: 5px 0; vertical-align: top; font-size: 10px; }
        
        .totals { margin-top: 10px; }
        .totals div { display: flex; justify-content: space-between; padding: 1px 0; }
        .grand-total { font-size: 16px; margin-top: 5px; border-top: 2px solid #000; padding-top: 5px; }
        
        .footer { margin-top: 20px; font-size: 10px; }
      </style>
    </head>
    <body onload="window.focus();">
      <div class="header text-center">
        <h1>${shopName}</h1>
        ${shopAddress ? `<p>${shopAddress}</p>` : ''}
        ${shopPhone ? `<p>Tel: ${shopPhone}</p>` : ''}
      </div>

      <div class="border-t border-b info">
        <div><span>${t('cfd.col_item')}:</span><span>#${id}</span></div>
        <div><span>${t('orders.date')}:</span><span>${new Date(date).toLocaleString()}</span></div>
        ${customerName ? `<div><span>${t('orders.customer')}:</span><span>${customerName}</span></div>` : ''}
        <div><span>${t('orders.service')}:</span><span style="text-transform: uppercase;">${t('orders.' + serviceType) || serviceType}</span></div>
        ${table ? `<div><span>${t('orders.table')}:</span><span>${table}</span></div>` : ''}
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 10%">${t('cfd.col_qty')}</th>
            <th style="width: 50%">${t('cfd.col_item')}</th>
            <th style="width: 40%; text-align: right;">${t('sale.total')}</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td>${item.quantity}</td>
              <td>
                ${item.name}
                ${item.variation ? `<br/><small>(${Object.values(item.variation).join(', ')})</small>` : ''}
              </td>
              <td class="text-right">${format(item.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="totals border-t">
        <div><span>${t('sale.subtotal')}</span><span>${format(subtotal)}</span></div>
        ${taxAmount > 0 ? `<div><span>${t('checkout.tax')}</span><span>${format(taxAmount)}</span></div>` : ''}
        ${discount > 0 ? `<div><span>${t('checkout.discount_label')}</span><span>-${format(discount)}</span></div>` : ''}
        ${couponDiscount > 0 ? `<div><span>${t('checkout.coupon_label')}</span><span>-${format(couponDiscount)}</span></div>` : ''}
        ${tip > 0 ? `<div><span>${t('checkout.tip_label')}</span><span>+${format(tip)}</span></div>` : ''}
        <div class="grand-total font-bold">
          <span>${t('sale.total')}</span>
          <span>${format(total)}</span>
        </div>
      </div>

      <div class="info mt-1">
        <div><span>${t('orders.pay_method')}:</span><span style="text-transform: uppercase;">${paymentMethod}</span></div>
        ${shippingAddress ? `<div style="display: block; margin-top: 5px;"><span>${t('orders.shipping')}:</span><br/><small>${shippingAddress}</small></div>` : ''}
      </div>

      <div class="footer text-center border-t">
        <p>${t('checkout.thank_you_msg') || 'THANK YOU FOR YOUR BUSINESS!'}</p>
        <p>${t('checkout.visit_again') || 'Visit us again soon'}</p>
        <p>*** Powered by YeePOS ***</p>
      </div>
    </body>
    </html>
  `;
};
