import { db } from '../db/indexedDB';
import { 
  fetchOrders, 
  createWooOrder, 
  ensureApiConfig 
} from '../api/woocommerce';

/**
 * Shared logic for synchronizing orders between Local DB and WooCommerce.
 * Can be run from the main UI thread or a Service Worker.
 */
export const syncOrders = async (options = {}) => {
  const { 
    initialSyncCount = 100,
    forceOffline = false,
    onProgress = null
  } = options;

  if (!navigator.onLine || forceOffline) return { success: false, reason: 'offline' };

  try {
    // 1. Ensure API is configured (especially for Service Workers)
    await ensureApiConfig();

    console.log('[YeePOS Sync] Starting order synchronization...');
    
    // 2. Upload Pending Local Orders
    const pendingResults = await uploadPendingOrders();
    
    // 3. Download New Remote Orders
    const downloadResults = await downloadRemoteOrders(initialSyncCount);

    console.log('[YeePOS Sync] Synchronization finished.', { pendingResults, downloadResults });
    
    return { 
      success: true, 
      pending: pendingResults, 
      download: downloadResults 
    };
  } catch (err) {
    console.error('[YeePOS Sync] Critical failure during order sync:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Push local offline orders to WooCommerce
 */
const uploadPendingOrders = async () => {
  const pending = await db.orders.where('syncStatus').equals(0).toArray();
  // Only sync non-parked orders that haven't failed more than 5 times
  const eligibleOrders = pending.filter(o => o.status !== 'parked' && (o.sync_retries || 0) < 5);
  
  if (eligibleOrders.length === 0) return { count: 0, synced: [] };

  let successCount = 0;
  let failCount = 0;
  const syncedOrders = [];

  for (const order of eligibleOrders) {
    try {
      const isUpdatingRemote = order.remote_id || (!String(order.id).toLowerCase().startsWith('parked') && !String(order.id).toLowerCase().startsWith('offline'));
      const targetRemoteId = order.remote_id || order.id;
      
      const remote = await createWooOrder(order, isUpdatingRemote ? targetRemoteId : null);
      
      const tipMeta = remote.meta_data?.find(m => m.key === '_yeepos_tip_amount');
      const tipAmount = tipMeta ? parseFloat(tipMeta.value) || 0 : (order.tip || 0);

      const newOrder = {
        ...order,
        id: remote.id,
        remote_id: remote.id,
        syncStatus: 1, 
        date_completed: remote.date_completed,
        sync_error: null,
        items: remote.line_items?.map(i => ({ 
          id: i.id,
          product_id: i.product_id,
          name: i.name, 
          quantity: i.quantity, 
          price: parseFloat(i.price) || (i.quantity ? parseFloat(i.total) / i.quantity : 0),
          total: parseFloat(i.total),
          meta_data: i.meta_data,
          variation: i.meta_data?.reduce((acc, meta) => ({ ...acc, [meta.key]: meta.value }), {}) || null
        })) || order.items,
        total: parseFloat(remote.total) || order.total,
        status: remote.status || order.status,
        customerName: `${remote.billing?.first_name || ''} ${remote.billing?.last_name || ''}`.trim() || order.customerName,
        customerEmail: remote.billing?.email || order.customerEmail,
        customerPhone: remote.billing?.phone || order.customerPhone,
        paymentMethod: remote.payment_method_title || order.paymentMethod,
        tip: tipAmount
      };
      
      const oldId = order.id;
      await db.orders.delete(oldId);
      await db.orders.put(newOrder); 
      
      syncedOrders.push({ oldId, newOrder });
      successCount++;
    } catch (innerErr) {
      failCount++;
      const newRetries = (order.sync_retries || 0) + 1;
      await db.orders.update(order.id, { 
        sync_retries: newRetries,
        sync_error: innerErr.message || 'Unknown error',
        syncStatus: newRetries >= 5 ? 2 : 0
      });
    }
  }

  return { count: eligibleOrders.length, success: successCount, failed: failCount, synced: syncedOrders };
};

/**
 * Fetch new orders from WooCommerce server
 */
const downloadRemoteOrders = async (syncCount) => {
  try {
    const remoteOrders = await fetchOrders(1, syncCount);
    if (!remoteOrders || remoteOrders.length === 0) return { count: 0 };

    let newCount = 0;
    let updateCount = 0;

    for (const remote of remoteOrders) {
      const existing = await db.orders.where('remote_id').equals(remote.id).first();
      
      const orderData = {
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
        syncStatus: 1,
        customerName: `${remote.billing?.first_name} ${remote.billing?.last_name}`,
        customerEmail: remote.billing?.email,
        paymentMethod: remote.payment_method_title,
        table: remote.meta_data?.find(m => m.key === '_yeepos_table_number')?.value || null
      };

      if (existing) {
        await db.orders.update(existing.id, orderData);
        updateCount++;
      } else {
        const isCashierOrder = remote.meta_data?.some(m => m.key === '_yeepos_cashier_id');
        const isNewStatus = remote.status === 'processing' || remote.status === 'on-hold';
        
        orderData._isNewOnline = (!isCashierOrder && isNewStatus) ? 1 : 0;
        await db.orders.put(orderData);
        newCount++;
      }
    }

    return { total: remoteOrders.length, new: newCount, updated: updateCount };
  } catch (err) {
    console.error('[YeePOS Sync] Failed to download orders:', err);
    return { error: err.message };
  }
};
