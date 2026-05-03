import { db } from '../db/indexedDB';

let rawData = typeof window !== 'undefined' ? (window.yeePOSData || {}) : {};

let wcConfig = {
  apiUrl: rawData.apiUrl ? `${rawData.apiUrl}wc/v3/` : '/wp-json/wc/v3/',
  nonce: rawData.nonce || ''
};

let yeeConfig = {
  apiUrl: rawData.apiUrl ? `${rawData.apiUrl}yeepos/v1/` : '/wp-json/yeepos/v1/',
  nonce: rawData.nonce || ''
};

let foodConfig = {
  apiUrl: rawData.apiUrl ? `${rawData.apiUrl}yeepos-food/v1/` : '/wp-json/yeepos-food/v1/',
  nonce: rawData.nonce || ''
};

/**
 * Ensures the API is configured, especially important for Service Workers
 */
export const ensureApiConfig = async () => {
  if (typeof window === 'undefined') {
    try {
      const settings = await db.settings.get('api_config');
      if (settings) {
        setApiConfig(settings.value);
      }
    } catch (err) {
      console.error('[YeePOS API] Failed to load config from DB:', err);
    }
  }
};

/**
 * Updates the API configuration globally
 */
export const setApiConfig = (config) => {
  if (!config) return;
  const apiUrl = config.apiUrl || '';
  wcConfig.apiUrl = apiUrl ? `${apiUrl}wc/v3/` : wcConfig.apiUrl;
  wcConfig.nonce = config.nonce || wcConfig.nonce;

  yeeConfig.apiUrl = apiUrl ? `${apiUrl}yeepos/v1/` : yeeConfig.apiUrl;
  yeeConfig.nonce = config.nonce || yeeConfig.nonce;

  foodConfig.apiUrl = apiUrl ? `${apiUrl}yeepos-food/v1/` : foodConfig.apiUrl;
  foodConfig.nonce = config.nonce || foodConfig.nonce;
};

/**
 * Updates the API nonce after a successful login
 */
export const updateApiNonce = (newNonce) => {
  if (newNonce) {
    wcConfig.nonce = newNonce;
    yeeConfig.nonce = newNonce;
    foodConfig.nonce = newNonce;
    // Also update the global data to be safe
    if (window.yeePOSData) {
      window.yeePOSData.nonce = newNonce;
    }
  }
};

const getHeaders = () => (
  {
    'Content-Type': 'application/json',
    'X-WP-Nonce': wcConfig.nonce
  });

/**
 * Silently refreshes the WordPress REST API nonce
 */
export const refreshNonce = async () => {
  try {
    const response = await fetch(`${yeeConfig.apiUrl}refresh-nonce`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );
    const result = await response.json();
    if (result.nonce) {
      updateApiNonce(result.nonce);
      console.log('[YeePOS] Nonce refreshed successfully.');
      return result.nonce;
    }
  } catch (err) {
    console.error('[YeePOS] Failed to refresh nonce:', err);
  }
  return null;
};

/**
 * Smart fetch wrapper that handles nonce expiration and retries
 */
const apiFetch = async (url, options = {}, retry = true) => {
  const { timeout = 15000 } = options; // Default 15s timeout

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const headers = {
    ...getHeaders(),
    ...(options.headers || {})
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
    });
    clearTimeout(id);

    // Check for authorization/nonce errors
    if (!response.ok && (response.status === 403 || response.status === 401) && retry) {
      const errorData = await response.clone().json().catch(() => ({}));
      const isNonceError = errorData.code === 'rest_cookie_invalid_nonce' ||
        errorData.code === 'woocommerce_rest_authentication_error';

      if (isNonceError) {
        console.warn('[YeePOS] Nonce expired. Attempting silent refresh...');
        const newNonce = await refreshNonce();
        if (newNonce) {
          return apiFetch(url, options, false);
        }
      }
    }

    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  }
};

export const updateProduct = async (id, data) => {
  try {
    const response = await apiFetch(`${wcConfig.apiUrl}products/${id}?_method=PUT`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Failed to update product');

    return result;
  } catch (error) {
    console.error('WooCommerce API Error:', error);
    throw error;
  }
};

export const fetchProducts = async (page = 1, perPage = 20, storeId = null, registerName = null) => {
  try {
    let url = `${wcConfig.apiUrl}products?page=${page}&per_page=${perPage}&status=publish`;
    if (storeId) url += `&store_id=${storeId}`;
    if (registerName) url += `&register_name=${encodeURIComponent(registerName)}`;

    const response = await apiFetch(url, {
      headers: getHeaders(),
    });

    if (!response.ok) throw new Error('Failed to fetch products');

    return await response.json();
  } catch (error) {
    console.error('WooCommerce API Error:', error);
    return [];
  }
};

export const createOrder = async (orderData) => {
  try {
    const response = await apiFetch(`${wcConfig.apiUrl}orders`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(orderData),
    });

    if (!response.ok) throw new Error('Failed to create order');

    return await response.json();
  } catch (error) {
    console.error('WooCommerce API Error:', error);
    throw error;
  }
};

export const updateOrder = async (id, data) => {
  try {
    const response = await apiFetch(`${wcConfig.apiUrl}orders/${id}?_method=PUT`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Failed to update order');

    return result;
  } catch (error) {
    console.error('WooCommerce API Error:', error);
    throw error;
  }
};

export const createRefund = async (orderId, amount, lineItems = [], restockItems = false) => {
  try {
    const response = await apiFetch(`${wcConfig.apiUrl}orders/${orderId}/refunds`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        amount: String(amount),
        api_refund: false, // We're assuming manual refunds via POS cash
        restock_items: restockItems,
        line_items: lineItems
      }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Failed to create refund');

    return result;
  } catch (error) {
    console.error('WooCommerce API Error:', error);
    throw error;
  }
};

export const createOrderNote = async (orderId, note, isCustomerNote = false) => {
  try {
    const response = await apiFetch(`${wcConfig.apiUrl}orders/${orderId}/notes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        note: note,
        customer_note: isCustomerNote
      }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Failed to create order note');

    return result;
  } catch (error) {
    console.error('WooCommerce API Error:', error);
    throw error;
  }
};

export const fetchOrders = async (page = 1, perPage = 20) => {
  try {
    const response = await fetch(`${wcConfig.apiUrl}orders?page=${page}&per_page=${perPage}`, {
      headers: getHeaders(),
    });

    if (!response.ok) throw new Error('Failed to fetch orders');

    return await response.json();
  } catch (error) {
    console.error('WooCommerce API Error:', error);
    return [];
  }
};

export const fetchCustomers = async (page = 1, perPage = 20) => {
  try {
    const response = await fetch(`${wcConfig.apiUrl}customers?page=${page}&per_page=${perPage}`, {
      headers: getHeaders(),
    });

    if (!response.ok) throw new Error('Failed to fetch customers');

    return await response.json();
  } catch (error) {
    console.error('WooCommerce API Error:', error);
    return [];
  }
};

export const updateCustomer = async (id, data) => {
  try {
    // We use POST with _method=PUT query param for maximum server compatibility
    const response = await fetch(`${wcConfig.apiUrl}customers/${id}?_method=PUT`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Failed to update customer');
    }

    return result;
  } catch (error) {
    console.error('WooCommerce API Error:', error);
    throw error;
  }
};
export const createCustomer = async (data) => {
  try {
    const response = await fetch(`${wcConfig.apiUrl}customers`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error('Failed to create customer');

    return await response.json();
  } catch (error) {
    console.error('WooCommerce API Error:', error);
    throw error;
  }
};
export const fetchCountries = async () => {
  try {
    const response = await fetch(`${wcConfig.apiUrl}data/countries`, {
      headers: getHeaders(),
    });

    if (!response.ok) throw new Error('Failed to fetch countries');

    return await response.json();
  } catch (error) {
    console.error('WooCommerce API Error:', error);
    return [];
  }
};
export const fetchCategories = async (storeId = null, registerName = null) => {
  try {
    let url = `${wcConfig.apiUrl}products/categories?per_page=100&hide_empty=false`;
    if (storeId) url += `&store_id=${storeId}`;
    if (registerName) url += `&register_name=${encodeURIComponent(registerName)}`;

    const response = await apiFetch(url, {
      headers: getHeaders(),
    });

    if (!response.ok) throw new Error('Failed to fetch categories');

    return await response.json();
  } catch (error) {
    console.error('WooCommerce API Error:', error);
    return [];
  }
};

export const fetchProductVariations = async (productId) => {
  try {
    const response = await fetch(`${wcConfig.apiUrl}products/${productId}/variations?per_page=100`, {
      headers: getHeaders(),
    });

    if (!response.ok) throw new Error('Failed to fetch variations');

    return await response.json();
  } catch (error) {
    console.error('WooCommerce API Error:', error);
    return [];
  }
};

export const updateProductVariation = async (productId, variationId, data) => {
  try {
    const response = await fetch(`${wcConfig.apiUrl}products/${productId}/variations/${variationId}?_method=PUT`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Failed to update variation');

    return result;
  } catch (error) {
    console.error('WooCommerce API Error:', error);
    throw error;
  }
};
export const fetchSettings = async (groupId = 'general') => {
  try {
    const response = await fetch(`${wcConfig.apiUrl}settings/${groupId}`, {
      headers: getHeaders(),
    });

    if (!response.ok) throw new Error(`Failed to fetch settings for group: ${groupId}`);

    return await response.json();
  } catch (error) {
    console.error('WooCommerce API Error:', error);
    return [];
  }
};

export const fetchTaxRates = async () => {
  try {
    const response = await fetch(`${wcConfig.apiUrl}taxes`, {
      headers: getHeaders(),
    });

    if (!response.ok) throw new Error('Failed to fetch tax rates');

    return await response.json();
  } catch (error) {
    console.error('WooCommerce API Error:', error);
    return [];
  }
};

export const fetchCouponByCode = async (code) => {
  try {
    const response = await fetch(`${wcConfig.apiUrl}coupons?code=${encodeURIComponent(code)}`, {
      headers: getHeaders(),
    });

    if (!response.ok) throw new Error('Failed to fetch coupon');

    const coupons = await response.json();
    return coupons.length > 0 ? coupons[0] : null;
  } catch (error) {
    console.error('WooCommerce API Error:', error);
    throw error;
  }
};

export const fetchPaymentGateways = async () => {
  try {
    const response = await fetch(`${wcConfig.apiUrl}payment_gateways`, {
      headers: getHeaders(),
    });

    if (!response.ok) throw new Error('Failed to fetch payment gateways');

    return await response.json();
  } catch (error) {
    return [];
  }
};

/**
 * Create or Update an order in WooCommerce
 * @param {Object} orderData 
 * @param {Number|String} updateOrderId - Optional ID of existing WooCommerce order to update
 */
export const createWooOrder = async (orderData, updateOrderId = null) => {
  const {
    items,
    customerId,
    paymentMethod,
    serviceType,
    table,
    tip,
    discount,
    couponId,
    couponDiscount,
    shipping,
    status = 'completed'
  } = orderData;

  // Map items to line_items format
  const lineItems = items.map(item => {
    // If the item has product_id set, it means it's an existing WooCommerce item (synced back from Web)
    const isExistingWooItem = item.product_id !== undefined && item.product_id !== null;

    // For existing items, preserve their exact metadata (has internal DB IDs). For new ones, construct fresh.
    let itemMeta = isExistingWooItem && item.meta_data ? [...item.meta_data] : [];

    if (!isExistingWooItem) {
      // Add variations as individual metadata entries
      if (item.variation) {
        Object.entries(item.variation).forEach(([key, value]) => {
          itemMeta.push({ key, value });
        });
      }

      // Add selected addons as individual metadata entries
      if (item.selectedAddons && item.selectedAddons.length > 0) {
        item.selectedAddons.forEach(addon => {
          let addonLabel = addon.name;
          let addonPrice = parseFloat(addon.price) || 0;

          if (addon.selectedSize) {
            addonLabel += ` (${addon.selectedSize.name})`;
            addonPrice += parseFloat(addon.selectedSize.price) || 0;
          }

          itemMeta.push({
            key: addon.groupName || 'Option',
            value: `${addonLabel}${addonPrice > 0 ? ` (+${addonPrice})` : ''}`
          });
        });
      }
    }

    const payloadItem = {
      product_id: isExistingWooItem ? item.product_id : item.id,
      quantity: item.quantity,
      variation_id: item.variation_id || 0,
      subtotal: (item.price * item.quantity).toFixed(2),
      total: (item.total).toFixed(2),
      meta_data: itemMeta
    };

    // If it's an existing WC item, we MUST pass the WC item ID so it updates rather than duplicates
    if (isExistingWooItem && item.id !== item.product_id) {
      payloadItem.id = item.id;
    }

    return payloadItem;
  });

  // Prepare metadata for POS fields
  const metaData = [
    { key: '_yeepos_pos_order', value: 'yes' },
    { key: '_yeepos_service_type', value: serviceType },
    { key: '_yeepos_tip_amount', value: tip.toString() },
    ...(orderData.meta_data || [])
  ];

  if (table) {
    metaData.push({ key: '_yeepos_table_number', value: table });
  }

  // Construct payload
  const payload = {
    customer_id: parseInt(customerId) || 0,
    payment_method: paymentMethod || 'other',
    payment_method_title: paymentMethod ? (paymentMethod === 'cash' ? 'Cash' : (paymentMethod === 'cod' ? 'Cash on Delivery' : paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1))) : 'Online Payment',
    status: status,
    set_paid: status === 'completed',
    customer_note: orderData.customer_note || '',
    line_items: lineItems,
    meta_data: metaData
  };

  // Initialize fee_lines
  payload.fee_lines = [];

  // Add Tip as a Fee Line
  if (tip > 0) {
    payload.fee_lines.push({
      name: 'Tip',
      total: tip.toFixed(2),
      tax_status: 'none'
    });
  }

  // Add POS Manual Discount as a Fee Line (negative)
  if (discount > 0) {
    payload.fee_lines.push({
      name: 'POS Discount',
      total: (-discount).toFixed(2),
      tax_status: 'none'
    });
  }

  // Add Coupons if any
  if (orderData.coupon) {
    payload.coupon_lines = [
      {
        code: orderData.coupon,
        discount: couponDiscount.toFixed(2)
      }
    ];
  }

  // Add Shipping if any
  if (shipping) {
    payload.shipping = shipping;
  }

  try {
    const endpoint = updateOrderId
      ? `${wcConfig.apiUrl}orders/${updateOrderId}?_method=PUT`
      : `${wcConfig.apiUrl}orders`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      console.error('Raw WooCommerce Response Error:', text);
      throw new Error(`Invalid JSON from server. Raw text: ${text.substring(0, 100)}...`);
    }

    if (!response.ok) {
      throw new Error(result.message || 'Failed to create order');
    }

    return result;
  } catch (error) {
    console.error('Create Order Error:', error);
    throw error;
  }
};

export const sendOrderEmail = async (orderId, email) => {
  try {
    const response = await fetch(`${yeeConfig.apiUrl}send-email-receipt`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        order_id: orderId,
        email: email
      })
    });

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.message || `Server responded with ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
};

export const fetchTables = async () => {
  try {
    const response = await fetch(`${foodConfig.apiUrl}tables`, {
      headers: getHeaders(),
    });

    if (!response.ok) throw new Error('Failed to fetch tables');
    return await response.json();
  } catch (error) {
    console.error('YeePOS Food API Error:', error);
    return [];
  }
};

/**
 * Lightweight product search via custom POS endpoint
 * Returns products already formatted for IndexedDB cache
 * ~200B per product vs ~5KB from WC REST API
 */
export const searchProductsOnline = async (keyword, perPage = 20) => {
  try {
    const response = await fetch(
      `${yeeConfig.apiUrl}search-products?search=${encodeURIComponent(keyword)}&per_page=${perPage}`,
      { headers: getHeaders() }
    );

    if (!response.ok) throw new Error('Failed to search products online');

    const results = await response.json();

    // Format to match the POS cache structure (same as syncProducts format)
    return results.map(p => ({
      id: p.id,
      name: p.name,
      type: p.type,
      price: parseFloat(p.price || 0),
      regular_price: p.regular_price || '',
      sale_price: p.sale_price || '',
      sku: p.sku || `SKU-${p.id}`,
      image: p.image || '',
      stock: p.stock || 0,
      manage_stock: p.manage_stock,
      sold_individually: p.sold_individually,
      categories: p.categories || [],
      meta_data: p.meta_data || [],
      _yeepos_addons: p._yeepos_addons || []
    }));
  } catch (error) {
    console.error('[YeePOS] Online search error:', error);
    return [];
  }
};

/**
 * Search customers online (Cache-on-Demand fallback)
 */
export const searchCustomersOnline = async (keyword, perPage = 20) => {
  try {
    const response = await fetch(
      `${wcConfig.apiUrl}customers?search=${encodeURIComponent(keyword)}&per_page=${perPage}`,
      { headers: getHeaders() }
    );
    if (!response.ok) throw new Error('Failed to search customers online');
    return await response.json();
  } catch (error) {
    console.error('[YeePOS] Online customer search error:', error);
    return [];
  }
};

/**
 * Search orders online (Cache-on-Demand fallback)
 */
export const searchOrdersOnline = async (keyword, perPage = 20) => {
  try {
    const response = await fetch(
      `${wcConfig.apiUrl}orders?search=${encodeURIComponent(keyword)}&per_page=${perPage}`,
      { headers: getHeaders() }
    );
    if (!response.ok) throw new Error('Failed to search orders online');

    const remoteOrders = await response.json();
    return remoteOrders.map(remote => ({
      id: remote.id,
      remote_id: remote.id,
      items: remote.line_items.map(item => ({
        id: item.product_id,
        name: item.name,
        quantity: item.quantity,
        price: parseFloat(item.price),
        total: parseFloat(item.total),
        variation_id: item.variation_id,
        meta_data: item.meta_data || []
      })),
      total: parseFloat(remote.total),
      status: remote.status,
      date: remote.date_created,
      syncStatus: 1, // Synced
      customerName: `${remote.billing?.first_name || ''} ${remote.billing?.last_name || ''}`.trim(),
      customerEmail: remote.billing?.email,
      customerPhone: remote.billing?.phone,
      paymentMethod: remote.payment_method_title,
      table: remote.meta_data?.find(m => m.key === '_yeepos_table_number')?.value || null,
      _isNewOnline: 0
    }));
  } catch (error) {
    console.error('[YeePOS] Online order search error:', error);
    return [];
  }
};


/**
 * Fetch available stores/branches for the current user
 */
export const fetchStores = async () => {
  try {
    const response = await apiFetch(`${yeeConfig.apiUrl}stores`, {
      headers: getHeaders(),
    });

    if (!response.ok) {
      // If the endpoint doesn't exist or module is disabled, return a default "Main Store"
      return [{ id: 'main', name: window.yeePOSData?.siteTitle || 'Main Store', is_main: true }];
    }

    const stores = await response.json();
    if (!stores || stores.length === 0) {
      return [{ id: 'main', name: window.yeePOSData?.siteTitle || 'Main Store', is_main: true }];
    }
    return stores;
  } catch (error) {
    console.error('[YeePOS] Failed to fetch stores:', error);
    // Fallback to main store on error
    return [{ id: 'main', name: window.yeePOSData?.siteTitle || 'Main Store', is_main: true }];
  }
};

/**
 * Claim a register for the current user
 */
export const claimRegister = async (storeId, registerName) => {
  try {
    const response = await apiFetch(`${yeeConfig.apiUrl}register/claim`, {
      method: 'POST',
      body: JSON.stringify({ store_id: storeId, register_name: registerName }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Failed to claim register');
    return result;
  } catch (error) {
    console.error('[YeePOS] Register claim error:', error);
    throw error;
  }
};

/**
 * Release a register
 */
export const releaseRegister = async (storeId, registerName, closingNote = '') => {
  try {
    const response = await apiFetch(`${yeeConfig.apiUrl}register/release`, {
      method: 'POST',
      body: JSON.stringify({
        store_id: storeId,
        register_name: registerName,
        closing_note: closingNote
      }),
    });
    return await response.json();
  } catch (error) {
    console.error('[YeePOS] Register release error:', error);
    return { success: false };
  }
};

/**
 * Fetch session summary for closing report
 */
export const fetchSessionSummary = async (storeId, registerName) => {
  try {
    const response = await apiFetch(`${yeeConfig.apiUrl}register/session-summary?store_id=${storeId}&register_name=${encodeURIComponent(registerName)}`, {
      method: 'GET',
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Failed to fetch session summary');
    return result;
  } catch (error) {
    console.error('[YeePOS] Session summary error:', error);
    return null;
  }
};
