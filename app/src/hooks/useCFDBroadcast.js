import { useRef, useCallback, useEffect } from 'react';

const CHANNEL_NAME = 'yeepos_cfd';

/**
 * @param {Object} priceFormatConfig - The price formatting configuration from POS app.
 */
export function useCFDBroadcast(priceFormatConfig) {
  const channelRef = useRef(null);

  useEffect(() => {
    channelRef.current = new BroadcastChannel(CHANNEL_NAME);
    return () => {
      channelRef.current?.close();
    };
  }, []);

  const broadcast = useCallback((type, payload = {}) => {
    if (channelRef.current) {
      channelRef.current.postMessage({ type, payload, timestamp: Date.now() });
    }
  }, []);

  const broadcastCartUpdate = useCallback((cart, subtotal, taxAmount, total, taxConfig, formatPrice) => {
    broadcast('cart_update', {
      items: cart.map(item => ({
        id: item.cartItemId || item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
        variation: item.variation || null,
        selectedAddons: item.selectedAddons || [],
      })),
      itemCount: cart.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      taxAmount,
      total,
      taxConfig: {
        enabled: taxConfig.enabled,
        rate: taxConfig.rate,
        label: taxConfig.label,
      },
      priceFormatConfig,
    });
  }, [broadcast, priceFormatConfig]);

  const broadcastCheckoutOpen = useCallback((data) => {
    broadcast('checkout_open', {
      ...data,
      customerName: data.customerName || 'Walk-in Customer',
      priceFormatConfig,
    });
  }, [broadcast, priceFormatConfig]);

  const broadcastOrderComplete = useCallback((order) => {
    broadcast('order_complete', {
      ...order,
      orderId: order.id || order.remote_id,
      customerName: order.customerName || 'Walk-in Customer',
      priceFormatConfig,
    });
  }, [broadcast, priceFormatConfig]);

  const broadcastProcessing = useCallback((isProcessing) => {
    broadcast('processing', { isProcessing });
  }, [broadcast]);

  const broadcastIdle = useCallback((shopName) => {
    broadcast('idle', { shopName: shopName || 'YeePOS' });
  }, [broadcast]);

  const broadcastPaymentUrl = useCallback((url) => {
    broadcast('payment_url', { url });
  }, [broadcast]);

  return {
    broadcast,
    broadcastCartUpdate,
    broadcastCheckoutOpen,
    broadcastOrderComplete,
    broadcastProcessing,
    broadcastIdle,
    broadcastPaymentUrl,
  };
}


/**
 * Channel name constant for the receiver (CustomerDisplay) to import.
 */
export { CHANNEL_NAME };
