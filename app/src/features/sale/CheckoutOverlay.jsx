import React, { useState, useEffect, useRef } from 'react';
import { CustomerSelectorModal } from './CustomerSelectorModal';
import { DiscountSelectorModal } from './DiscountSelectorModal';
import { TableSelectorModal } from './TableSelectorModal';
import { ShippingAddressModal } from './ShippingAddressModal';
import { fetchCouponByCode } from '../../api/woocommerce';
import { printReceipt } from '../../utils/receiptUtils';
import { sendOrderEmail } from '../../api/woocommerce';
import toast from '../../utils/toast';
import { db } from '../../db/indexedDB';
import { buildOccupiedTableMap } from '../../utils/tableStatus';
import { useTranslation } from '../../utils/i18n';

export function CheckoutOverlay({ 
  onClose, 
  cart, 
  subtotal, 
  taxAmount, 
  total, 
  taxConfig, 
  formatPrice,
  onFinalize,
  customers = [],
  paymentGateways = [],
  lastCreatedOrder = null,
  setLastCreatedOrder,
  resumingOrderId = null,
  originalOrderMetadata = null,
  shopSettings = {},
  posSettings = {},
  tables = [],
  cfd,
  clearCart,
  onNavigate,
  inline = false,
  couponsEnabled = true
}) {
  const { t } = useTranslation();
  const [receivedAmount, setReceivedAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(paymentGateways[0]?.id || 'cash');
  const [couponCode, setCouponCode] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isShippingModalOpen, setIsShippingModalOpen] = useState(false);
  const [tipAmount, setTipAmount] = useState(0);
  const [orderNote, setOrderNote] = useState('');
  const isFoodEnabled = window.yeePOSData?.activeModules?.food || false;
  const [serviceType, setServiceType] = useState(isFoodEnabled ? 'dine_in' : 'takeaway');
  const [selectedTable, setSelectedTable] = useState('');
  const [shippingDetails, setShippingDetails] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    address_1: '',
    address_2: '',
    city: '',
    state: '',
    postcode: '',
    country: 'VN'
  });
  
  const [successEmailInput, setSuccessEmailInput] = useState('');
  const [isSendingSuccessEmail, setIsSendingSuccessEmail] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [occupiedTables, setOccupiedTables] = useState({});
  const [paymentMode, setPaymentMode] = useState('offline'); // 'offline' or 'online'
  const [paymentUrl, setPaymentUrl] = useState(''); // For online payment frame
  const [isProcessingOnline, setIsProcessingOnline] = useState(false); // Flag to prevent early success screen
  const [pendingOrder, setPendingOrder] = useState(null); // Temporary storage for online order result
  const [itemsListHeight, setItemsListHeight] = useState(() => {
    const saved = localStorage.getItem('yeepos_checkout_items_height');
    return saved ? parseInt(saved) : 180;
  });
  const isResizingRef = useRef(false);
  const iframeRef = useRef(null);

  useEffect(() => {
    const handleMove = (clientY) => {
      if (!isResizingRef.current) return;
      // 180 is a baseline offset for Header + Pricing Summary padding
      const newHeight = Math.max(80, Math.min(600, clientY - 220)); 
      setItemsListHeight(newHeight);
    };

    const handleMouseMove = (e) => handleMove(e.clientY);
    const handleTouchMove = (e) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientY);
      }
    };

    const handleEnd = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.cursor = 'default';
        localStorage.setItem('yeepos_checkout_items_height', itemsListHeight.toString());
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [itemsListHeight]);

  useEffect(() => {
    if (lastCreatedOrder) {
      setSuccessEmailInput(lastCreatedOrder.customerEmail || '');
    }
  }, [lastCreatedOrder]);

  useEffect(() => {
    if (resumingOrderId && originalOrderMetadata) {
      if (originalOrderMetadata.serviceType) {
        setServiceType(originalOrderMetadata.serviceType);
      }
      if (originalOrderMetadata.table || originalOrderMetadata._yeepos_table_number) {
        setSelectedTable(originalOrderMetadata.table || originalOrderMetadata._yeepos_table_number);
      }
    }
  }, [resumingOrderId, originalOrderMetadata]);

  // Listen for sync completion to update the Order ID on the success screen
  useEffect(() => {
    const handleSync = (e) => {
      const result = e.detail;
      if (lastCreatedOrder && result?.pending?.synced?.length > 0) {
        // Look for the currently displayed order in the list of synced orders
        const matching = result.pending.synced.find(s => s.oldId === lastCreatedOrder.id);
        if (matching) {
          console.log('[YeePOS] Background sync updated displayed order:', matching.newOrder.id);
          setLastCreatedOrder(matching.newOrder);
        }
      }
    };

    window.addEventListener('yeepos_sync_finished', handleSync);
    return () => window.removeEventListener('yeepos_sync_finished', handleSync);
  }, [lastCreatedOrder, setLastCreatedOrder]);

  const handleSendSuccessEmail = async () => {
    if (!successEmailInput || !successEmailInput.includes('@')) {
      toast.error(t('checkout.valid_email_error'));
      return;
    }

    setIsSendingSuccessEmail(true);
    try {
      await sendOrderEmail(lastCreatedOrder.id, successEmailInput);
      toast.success(t('checkout.receipt_sent'));
    } catch (error) {
      console.error(error);
      toast.error(t('checkout.email_failed'));
    } finally {
      setIsSendingSuccessEmail(false);
    }
  };

  const successHandledRef = useRef(false);

  // Listen for success signal from Online Payment Iframe (Local and Remote CFD)
  useEffect(() => {
    successHandledRef.current = false; // Reset when remounted or dependencies change

    const handleIframeMessage = (event) => {
      if (event.data && event.data.type === 'yeepos_payment_success') {
        if (successHandledRef.current) return;
        successHandledRef.current = true;

        console.log('Online Payment Success detected via Message/CFD:', event.data);
        
        // Finalize order state since payment is 100% confirmed
        if (pendingOrder) {
          setLastCreatedOrder(pendingOrder);
          if (clearCart) clearCart();
          setPaymentMode('offline'); // Switch to success screen view mode
        }

        setPaymentUrl('');
        setIsProcessingOnline(false);
        setIsProcessing(false);
        toast.success(t('checkout.success'));
      }
    };

    const channel = new BroadcastChannel('yeepos_cfd');
    channel.onmessage = (event) => {
      if (event.data && event.data.type === 'yeepos_payment_success') {
        // CFD relays the message payload in event.data.data
        handleIframeMessage({ data: event.data.data || event.data });
      }
    };

    window.addEventListener('message', handleIframeMessage);
    return () => {
      window.removeEventListener('message', handleIframeMessage);
      channel.close();
    };
  }, [t, pendingOrder, setLastCreatedOrder, clearCart]);

  // Auto-print logic
  useEffect(() => {
    if (lastCreatedOrder && posSettings?.autoPrint) {
      printReceipt(lastCreatedOrder, shopSettings, t, formatPrice);
    }
  }, [lastCreatedOrder, posSettings?.autoPrint, shopSettings, t, formatPrice]);
  
  useEffect(() => {
    const loadOccupiedTables = async () => {
      try {
        const allOrders = await db.orders.toArray();
        const mapping = buildOccupiedTableMap(allOrders, tables);
        setOccupiedTables(mapping);
      } catch (err) {
        console.error('Failed to load occupied tables', err);
      }
    };
    loadOccupiedTables();
  }, [isTableModalOpen, tables]); // Refresh when modal opens

  useEffect(() => {
    if (paymentMode === 'online') {
      // We use a placeholder ID to satisfy API requirements.
      // The user will select the actual gateway on the server-side iframe page.
      setPaymentMethod('online_checkout');
      return;
    }
    
    // Determine default payment method for Offline mode
    if (paymentGateways.length > 0) {
      setPaymentMethod(paymentGateways[0].id);
    } else {
      setPaymentMethod('');
    }
  }, [paymentGateways, paymentMode]);

  
  // Coupon States
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponDiscount, setCouponDiscount] = useState(0);

  const finalTotal = Math.max(0, total - orderDiscount - couponDiscount + tipAmount);
  const changeAmount = (parseFloat(receivedAmount) || 0) - finalTotal;

  // Broadcast checkout state to Customer-Facing Display (reactive)
  React.useEffect(() => {
    if (cfd) {
      const customerObj = selectedCustomerId ? customers.find(c => c.id.toString() === selectedCustomerId) : null;
      cfd.broadcastCheckoutOpen({
        items: cart.map(item => ({
          id: item.cartItemId || item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
        })),
        subtotal,
        taxAmount,
        total: finalTotal,
        customerName: customerObj ? `${customerObj.first_name} ${customerObj.last_name}`.trim() : t('checkout.walk_in'),
        paymentMethod: paymentGateways.find(g => g.id === paymentMethod)?.title || paymentMethod,
        orderDiscount,
        couponDiscount,
        couponCode: appliedCoupon?.code,
        tip: tipAmount,
      });
    }
  }, [selectedCustomerId, paymentMethod, orderDiscount, couponDiscount, tipAmount, finalTotal, appliedCoupon]);

  // Broadcast processing state
  React.useEffect(() => {
    if (cfd) {
      cfd.broadcastProcessing(isProcessing);
    }
  }, [isProcessing, cfd]);

  const handlePlaceOrder = async (mode = 'completed') => {
    if (isProcessing) return;
    
    // mode could be 'offline', 'online', or 'on-hold'
    const orderStatus = mode === 'online' ? 'pending' : (mode === 'on-hold' ? 'on-hold' : 'completed');
    
    setIsProcessing(true);
    if (paymentMode === 'online') {
      setIsProcessingOnline(true);
    }
    
    try {
      const result = await onFinalize({
        id: pendingOrder?.id || null, // Priority to recently created online order
        customerId: selectedCustomerId,
        paymentMethod,
        serviceType,
        table: selectedTable,
        customer_note: orderNote,
        shipping: serviceType === 'shipping' ? shippingDetails : null,
        receivedAmount: parseFloat(receivedAmount) || 0,
        changeAmount,
        discount: parseFloat(orderDiscount) || 0,
        coupon: appliedCoupon ? appliedCoupon.code : null,
        couponId: appliedCoupon ? appliedCoupon.id : null,
        couponDiscount: couponDiscount,
        tip: tipAmount,
        items: cart,
        subtotal,
        taxAmount,
        total: finalTotal,
        status: orderStatus
      });

      // If it's an online payment, we prepare the iframe URL but don't finish yet
      console.log("[YeePOS] Order Result received in Overlay:", result);
      if (paymentMode === 'online' && result && result.id) {
         console.log("[YeePOS] Opening Payment Iframe for Order ID:", result.id);
         setPendingOrder(result);
         setPaymentUrl(result.payment_url);
         setIsProcessing(false);
         setIsProcessingOnline(false);
         return;
      }

      // Broadcast order completion to Customer-Facing Display
      if (cfd && orderStatus === 'completed') {
        const customerObj = selectedCustomerId ? customers.find(c => c.id.toString() === selectedCustomerId) : null;
        cfd.broadcastOrderComplete({
          total: finalTotal,
          paymentMethod: paymentGateways.find(g => g.id === paymentMethod)?.title || paymentMethod,
          changeAmount: Math.max(0, changeAmount),
          customerName: customerObj ? `${customerObj.first_name} ${customerObj.last_name}`.trim() : t('checkout.walk_in'),
          orderDiscount,
          couponDiscount,
          couponCode: appliedCoupon?.code,
          tip: tipAmount,
        });
      }
    } catch (err) {
      console.error('Checkout failed:', err);
      toast.error(err.message || t('checkout.coupon_validate_error'));
      setIsProcessing(false);
      setIsProcessingOnline(false);
    }
  };
  React.useEffect(() => {
    if (serviceType === 'shipping' && selectedCustomerId) {
      const customer = customers.find(c => c.id.toString() === selectedCustomerId);
      if (customer) {
        const addr = customer.shipping?.address_1 ? customer.shipping : customer.billing;
        if (addr) {
          setShippingDetails({
            first_name: addr.first_name || customer.first_name || '',
            last_name: addr.last_name || customer.last_name || '',
            phone: addr.phone || customer.billing?.phone || '',
            address_1: addr.address_1 || '',
            address_2: addr.address_2 || '',
            city: addr.city || '',
            state: addr.state || '',
            postcode: addr.postcode || '',
            country: addr.country || 'VN'
          });
        }
      }
    }
  }, [serviceType, selectedCustomerId, customers]);

  const handleSelectCustomer = (customer) => {
    setSelectedCustomerId(customer ? customer.id.toString() : '');
    setIsCustomerModalOpen(false);
  };

  const handleSelectDiscount = (amount) => {
    if (amount > 0 && appliedCoupon?.individual_use) {
      toast.error(t('checkout.coupon_individual_error'));
      return;
    }
    setOrderDiscount(amount);
    setIsDiscountModalOpen(false);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    
    setIsValidatingCoupon(true);
    setCouponError('');
    
    try {
      const coupon = await fetchCouponByCode(couponCode);
      
      if (!coupon) {
        setCouponError(t('checkout.coupon_not_exist'));
        setAppliedCoupon(null);
        setCouponDiscount(0);
        return;
      }

      // 1. Check expiry
      if (coupon.date_expires) {
        const expiryDate = new Date(coupon.date_expires);
        if (expiryDate < new Date()) {
          setCouponError(t('checkout.coupon_expired'));
          return;
        }
      }

      // 2. Check usage limit
      if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
        setCouponError(t('checkout.coupon_usage_limit'));
        return;
      }

      // 3. Minimum & Maximum amount
      const minAmount = parseFloat(coupon.minimum_amount || 0);
      const maxAmount = parseFloat(coupon.maximum_amount || 0);

      if (minAmount > 0 && total < minAmount) {
        setCouponError(t('checkout.coupon_min_amount', { amount: formatPrice(minAmount) }));
        return;
      }
      if (maxAmount > 0 && total > maxAmount) {
        setCouponError(t('checkout.coupon_max_amount', { amount: formatPrice(maxAmount) }));
        return;
      }

      // 4. Individual Use
      if (coupon.individual_use && orderDiscount > 0) {
        setCouponError(t('checkout.coupon_no_other_discount'));
        return;
      }

      // 5. Exclude Sale Items
      if (coupon.exclude_sale_items) {
        const hasSaleItems = cart.some(item => item.on_sale);
        if (hasSaleItems) {
          setCouponError(t('checkout.coupon_exclude_sale'));
          return;
        }
      }

      // 6. Product Restrictions
      if (coupon.product_ids && coupon.product_ids.length > 0) {
        const hasRequiredProduct = cart.some(item => coupon.product_ids.includes(item.id));
        if (!hasRequiredProduct) {
          setCouponError(t('checkout.coupon_no_product'));
          return;
        }
      }
      if (coupon.excluded_product_ids && coupon.excluded_product_ids.length > 0) {
        const hasExcludedProduct = cart.some(item => coupon.excluded_product_ids.includes(item.id));
        if (hasExcludedProduct) {
          setCouponError(t('checkout.coupon_excluded_product'));
          return;
        }
      }

      // 7. Category Restrictions
      if (coupon.product_categories && coupon.product_categories.length > 0) {
        const hasRequiredCategory = cart.some(item => 
          item.categories?.some(cat => coupon.product_categories.includes(cat.id))
        );
        if (!hasRequiredCategory) {
          setCouponError(t('checkout.coupon_no_category'));
          return;
        }
      }
      if (coupon.excluded_product_categories && coupon.excluded_product_categories.length > 0) {
        const hasExcludedCategory = cart.some(item => 
          item.categories?.some(cat => coupon.excluded_product_categories.includes(cat.id))
        );
        if (hasExcludedCategory) {
          setCouponError(t('checkout.coupon_excluded_category'));
          return;
        }
      }

      // If valid, calculate discount
      let discountAmount = 0;
      const couponAmount = parseFloat(coupon.amount);

      if (coupon.discount_type === 'percent') {
        discountAmount = (total * couponAmount) / 100;
      } else if (coupon.discount_type === 'fixed_cart') {
        discountAmount = couponAmount;
      }

      setAppliedCoupon(coupon);
      setCouponDiscount(discountAmount);
      setCouponError('');
    } catch (error) {
      setCouponError(t('checkout.coupon_validate_error'));
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  if (lastCreatedOrder && paymentMode === 'offline') {
    return (
      <div className={inline 
        ? 'relative flex flex-col bg-[var(--bg-page)] h-full w-full animate-in fade-in duration-300'
        : 'fixed inset-0 z-[99999] flex items-center justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-300'
      }>
        <div className={inline 
          ? 'flex-1 flex flex-col overflow-y-auto relative'
          : 'bg-[var(--bg-page)] w-full h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 overflow-y-auto relative'
        }>
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-[var(--bg-card)] border border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all z-50 hover:bg-[var(--bg-page)]"
          >
            <span className="material-icons-outlined">close</span>
          </button>
          
          <header className="px-6 py-8 flex flex-col items-center justify-center text-center gap-4 bg-[var(--bg-header)] border-b border-[var(--border-main)]">
             <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center animate-bounce">
                <span className="material-icons-outlined text-green-500 text-4xl">check_circle</span>
             </div>
             <div>
                <h2 className="text-[var(--text-main)] font-black text-2xl uppercase tracking-wider">{t('checkout.success')}</h2>
                <div className="flex items-center justify-center gap-2 mt-1">
                   {lastCreatedOrder.table && (
                     <span className="flex items-center gap-1 text-[10px] bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-[var(--brand-primary)]/20">
                        <span className="material-icons-outlined text-[10px]">event_seat</span> {lastCreatedOrder.table}
                     </span>
                   )}
                   {lastCreatedOrder.syncStatus === 1 ? (
                     <span className="flex items-center gap-1 text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> {t('checkout.online_sync')}
                     </span>
                   ) : (
                     <span className="flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> {t('checkout.offline_mode')}
                     </span>
                   )}
                </div>
             </div>
          </header>

          <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
             {/* Order Details Card */}
             <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl p-6 space-y-4 shadow-sm">
                <div className="flex justify-between items-center border-b border-[var(--border-main)] pb-4">
                   <div className="flex flex-col">
                       <span className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest">{t('checkout.order_id')}</span>
                       <div className="flex items-center gap-2 group/id">
                          <span key={lastCreatedOrder.id} className="text-[var(--text-main)] font-black text-lg animate-in zoom-in-95 fade-in duration-500">#{lastCreatedOrder.id}</span>
                          {lastCreatedOrder.syncStatus === 1 && (
                             <span className="material-icons-outlined text-green-500 text-sm animate-in slide-in-from-left-2 duration-500">verified</span>
                          )}
                       </div>
                   </div>
                   <div className="flex flex-col items-end">
                      <span className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest">{t('sale.saved')}</span>
                      <span className="text-[var(--text-main)] font-bold">{new Date().toLocaleDateString()}</span>
                   </div>
                </div>

                <div className="space-y-3">
                   <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-muted)]">{t('checkout.payment_method')}</span>
                      <span className="text-[var(--text-main)] font-bold uppercase">{lastCreatedOrder.paymentMethod}</span>
                   </div>
                   <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-muted)]">{t('checkout.service_type')}</span>
                      <span className="text-[var(--text-main)] font-bold uppercase">{lastCreatedOrder.serviceType}</span>
                   </div>
                   {lastCreatedOrder.table && (
                     <div className="flex justify-between text-sm">
                        <span className="text-[var(--text-muted)]">{t('tables.title')}</span>
                        <span className="text-[var(--brand-primary)] font-black">{lastCreatedOrder.table}</span>
                     </div>
                   )}
                </div>

                <div className="h-px bg-[var(--border-main)] opacity-50 my-2" />

                <div className="flex justify-between items-end">
                   <span className="text-[var(--text-main)] font-black uppercase tracking-widest text-lg">{t('checkout.total_paid')}</span>
                   <span className="text-[var(--brand-primary)] font-black text-3xl">{formatPrice(lastCreatedOrder.total)}</span>
                </div>
             </div>

             {/* Action Buttons */}
              <div className="grid grid-cols-1 gap-4">
                 <button 
                   className="w-full flex items-center justify-center gap-3 bg-white text-black py-5 rounded-2xl font-black uppercase tracking-[0.2em] hover:bg-gray-200 transition-all active:scale-95 shadow-xl"
                   onClick={() => printReceipt(lastCreatedOrder, shopSettings, t, formatPrice)}
                 >
                   <span className="material-icons-outlined !normal-case">print</span> {t('checkout.print_receipt')}
                 </button>
                 
                 <div className="space-y-2 mt-2">
                    <label className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest ml-1">{t('checkout.email_receipt')}</label>
                    <div className="flex gap-2">
                       <div className="relative flex-1">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 material-icons-outlined text-[var(--text-muted)] text-sm">email</span>
                          <input 
                            type="email"
                            placeholder="customer@email.com"
                            className="w-full bg-[var(--bg-input)] border border-[var(--border-main)] rounded-xl py-4 pl-10 pr-4 text-[var(--text-main)] text-xs focus:outline-none focus:border-[var(--brand-primary)] transition-all"
                            value={successEmailInput}
                            onChange={(e) => setSuccessEmailInput(e.target.value)}
                          />
                       </div>
                       <button 
                         onClick={handleSendSuccessEmail}
                         disabled={isSendingSuccessEmail}
                         className="bg-[var(--bg-card)] border border-[var(--border-main)] text-[var(--brand-primary)] px-6 rounded-xl font-black uppercase text-[10px] hover:bg-[var(--bg-page)] transition-all disabled:opacity-50 h-[52px]"
                       >
                          {isSendingSuccessEmail ? '...' : t('checkout.add_button').toUpperCase()}
                       </button>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 gap-4 opacity-50">
                    <button 
                      className="flex items-center justify-center gap-2 bg-[var(--bg-card)] border border-[var(--border-main)] text-[var(--text-main)] py-4 rounded-2xl font-bold uppercase text-xs cursor-not-allowed"
                    >
                       <span className="material-icons-outlined text-sm">sms</span> SMS Receipt Coming Soon
                    </button>
                 </div>
              </div>
          </div>

          <footer className="p-6 bg-[var(--bg-page)] border-t border-[var(--border-main)]">
             <button 
               onClick={onClose}
               className="w-full bg-[var(--brand-primary)] hover:bg-[color-mix(in srgb, var(--brand-primary), black 15%)] text-white py-6 rounded-2xl font-black uppercase tracking-[0.3em] shadow-lg shadow-[var(--brand-primary)]/20 transition-all active:scale-95 text-lg"
             >
               {t('sale.new')}
             </button>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className={inline
      ? 'relative flex flex-col bg-[var(--bg-page)] h-full w-full animate-in fade-in duration-300'
      : 'fixed inset-0 bg-[var(--bg-page)] z-[99999] flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl'
    }>
      <header className="h-16 px-6 border-b border-[var(--border-main)] flex items-center justify-between bg-[var(--bg-header)] shrink-0">
        <h2 className="text-[var(--text-main)] font-black text-lg tracking-tight uppercase">{t('checkout.sales_summary')}</h2>
        <div className="bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] text-[10px] font-black px-2 py-1 rounded border border-[var(--brand-primary)]/20 uppercase tracking-widest">{t('checkout.summary_step')}</div>
      </header>

      {/* FIXED TOP SECTION: Items List & Pricing Summary */}
      <div className="flex-none w-full border-b border-[var(--border-main)] shadow-sm z-10 bg-[var(--bg-card)]">
        {/* Table info at the top if Dine-in */}
        {serviceType === 'dine_in' && selectedTable && (
           <div className="mx-6 mt-4 bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/20 rounded-2xl p-4 flex items-center justify-between animate-in slide-in-from-top-4 duration-500">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-[var(--brand-primary)]/20 flex items-center justify-center">
                    <span className="material-icons-outlined text-[var(--brand-primary)]">event_seat</span>
                 </div>
                  <div>
                    <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest">{t('checkout.dining_at')}</p>
                    <p className="text-[var(--text-main)] font-black uppercase tracking-tight">{selectedTable}</p>
                  </div>
              </div>
              <div className="px-3 py-1 bg-[var(--brand-primary)]/20 rounded-full border border-[var(--brand-primary)]/30">
                 <span className="text-[9px] text-[var(--brand-primary)] font-black uppercase tracking-widest">{t('checkout.reserved')}</span>
              </div>
           </div>
        )}

        {/* Items List Summary - Resizable height */}
        <div 
          className="bg-[var(--bg-page)]/50 overflow-y-auto custom-scrollbar transition-[height] duration-75 select-none"
          style={{ height: `${itemsListHeight}px` }}
        >
           {cart.map((item, idx) => (
            <div key={item.cartItemId || (item.id + idx)} className="flex justify-between items-start group px-6 py-4 border-b border-[var(--border-main)]/30 last:border-b-0">
              <div className="flex gap-6 items-center">
                <span className="text-[var(--text-main)] font-bold text-sm w-4 text-center">{item.quantity}</span>
                <div>
                  <h4 className="text-[var(--text-main)] font-bold text-sm leading-tight group-hover:text-[var(--brand-primary)] transition-colors">{item.name}</h4>
                  {item.variation && (
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      {Object.entries(item.variation).map(([key, value]) => (
                        <div key={key} className="flex gap-1 text-[11px] items-center">
                          <span className="text-gray-500 font-bold uppercase tracking-wider">{key.replace('attribute_pa_', '')}:</span>
                          <span className="text-[var(--brand-primary)] font-black">{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                   {item.selectedAddons && item.selectedAddons.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                      {item.selectedAddons.map((addon, aIdx) => (
                        <span key={aIdx} className="text-[var(--text-muted)] text-[10px] italic">
                          + {addon.name} {addon.selectedSize ? `(${addon.selectedSize.name})` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
               <div className="text-right flex space-x-4 items-center pl-2 shrink-0">
                <span className="text-[var(--text-muted)] text-sm">{formatPrice(item.price)}</span>
                <span className="text-[var(--text-main)] font-bold text-sm min-w-[60px]">{formatPrice(item.total)}</span>
              </div>
            </div>
          ))}
        </div>

         {/* Pricing Summary */}
        <div className="bg-[var(--bg-card)] px-6 py-5">
          <div className="flex justify-end mb-2">
             <span className="text-[var(--text-main)] font-medium text-sm">{cart.reduce((total, item) => total + item.quantity, 0)} {t('sale.items')}</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[var(--text-main)] text-sm font-medium">
              <span>{t('sale.subtotal')}</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            {taxConfig.enabled && (
              <div className="flex justify-between items-center text-[var(--text-main)] text-sm font-medium">
                <span>{taxConfig.label} ({taxConfig.rate}%)</span>
                <span>{formatPrice(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1">
              <span className="text-2xl font-bold text-[var(--text-main)] tracking-tight">{t('sale.total')}</span>
              <span className="text-2xl font-bold text-[var(--text-main)] tracking-tight tabular-nums">{formatPrice(finalTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* DRAGGABLE DIVIDER HANDLE */}
      <div 
        className="h-4 w-full bg-transparent hover:bg-[var(--brand-primary)]/5 cursor-ns-resize flex items-center justify-center transition-colors group shrink-0"
        onMouseDown={(e) => {
          e.preventDefault();
          isResizingRef.current = true;
          document.body.style.cursor = 'ns-resize';
        }}
        onTouchStart={() => {
          isResizingRef.current = true;
        }}
      >
        <div className="w-8 h-0.5 rounded-full bg-[#2C2C35] group-hover:bg-[var(--brand-primary)] flex items-center justify-center gap-0.5 transition-colors">
          <div className="w-[1.5px] h-[1.5px] rounded-full bg-current opacity-40" />
          <div className="w-[1.5px] h-[1.5px] rounded-full bg-current opacity-40" />
          <div className="w-[1.5px] h-[1.5px] rounded-full bg-current opacity-40" />
        </div>
      </div>

      {/* SCROLLABLE BOTTOM SECTION: Form Fields */}
      <div className="flex-1 overflow-y-auto w-full px-6 pt-2 pb-10 space-y-6 custom-scrollbar bg-[var(--bg-page)]">
        {/* Form Fields Section */}
        <div className="space-y-6 pt-4">
          
          {/* Customer Row */}
          <div className="flex flex-col gap-2 group">
            <span className="text-[var(--text-main)] text-[15px] font-bold">{t('checkout.customer_label')}</span>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[var(--bg-input)]/30 p-4 rounded-xl border border-[var(--border-main)]/30">
              <div className="flex flex-col">
                <span className={`text-sm ${selectedCustomerId ? 'text-[var(--text-main)] font-black' : 'text-[var(--text-muted)]'}`}>
                  {selectedCustomerId ? (customers.find(c => c.id.toString() === selectedCustomerId)?.first_name || t('checkout.customer_label')) : t('checkout.walk_in')}
                </span>
                {selectedCustomerId && customers.find(c => c.id.toString() === selectedCustomerId)?.email && (
                  <span className="text-[10px] text-[var(--text-muted)]">{customers.find(c => c.id.toString() === selectedCustomerId).email}</span>
                )}
              </div>
              {selectedCustomerId ? (
                 <button 
                   onClick={() => setSelectedCustomerId('')}
                   className="bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg font-bold py-2.5 px-4 text-xs flex items-center justify-center gap-2 transition-colors w-full md:w-auto"
                 >
                   <span className="material-icons-outlined text-sm">remove_circle_outline</span>
                   {t('sale.remove')}
                 </button>
              ) : (
                <button 
                  onClick={() => setIsCustomerModalOpen(true)}
                  className="bg-[var(--brand-primary)] hover:bg-[color-mix(in srgb, var(--brand-primary), black 15%)] text-white rounded-lg font-bold py-2.5 px-6 text-sm flex items-center justify-center gap-1 transition-colors w-full md:w-auto shadow-sm"
                >
                  <span className="material-icons-outlined text-sm">person_add</span>
                  {t('checkout.add_button')}
                </button>
              )}
            </div>
          </div>

          {/* Order Discount Row */}
          <div className="flex flex-col gap-2 group">
            <span className="text-[var(--text-main)] text-[15px] font-bold">{t('checkout.discount_label')}</span>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[var(--bg-input)]/30 p-4 rounded-xl border border-[var(--border-main)]/30">
              <span className={`text-sm ${orderDiscount > 0 ? 'text-[var(--text-main)] font-black' : 'text-[var(--text-muted)]'}`}>{orderDiscount > 0 ? `-${formatPrice(orderDiscount)}` : formatPrice(0)}</span>
              {orderDiscount > 0 ? (
                 <button 
                   onClick={() => setOrderDiscount(0)}
                   className="bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg font-bold py-2.5 px-4 text-xs flex items-center justify-center gap-2 transition-colors w-full md:w-auto"
                 >
                   <span className="material-icons-outlined text-sm">remove_circle_outline</span>
                   {t('sale.remove')}
                 </button>
              ) : (
                <button 
                  onClick={() => setIsDiscountModalOpen(true)}
                  className="bg-[var(--brand-primary)] hover:bg-[color-mix(in srgb, var(--brand-primary), black 15%)] text-white rounded-lg font-bold py-2.5 px-6 text-sm flex items-center justify-center gap-1 transition-colors w-full md:w-auto shadow-sm"
                >
                  <span className="material-icons-outlined text-sm">local_offer</span>
                  {t('checkout.add_button')}
                </button>
              )}
            </div>
          </div>

          {couponsEnabled && (
            <div className="flex flex-col gap-2 group">
              <span className="text-[var(--text-main)] text-[15px] font-bold">{t('checkout.coupon_label')}</span>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[var(--bg-input)]/30 p-4 rounded-xl border border-[var(--border-main)]/30">
                <div className="relative flex-1">
                  {appliedCoupon ? (
                    <div className="flex flex-col bg-green-500/5 border border-green-500/20 rounded-lg px-4 py-2">
                        <span className="text-[var(--text-main)] font-black text-sm uppercase tracking-wide">{appliedCoupon.code}</span>
                        <span className="text-[10px] text-green-500 font-bold">-{formatPrice(couponDiscount)}</span>
                    </div>
                  ) : (
                    <>
                      <input 
                        type="text" 
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        className={`w-full bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg px-4 py-3 text-sm text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] transition-all ${
                          couponError ? 'border-red-500/50' : ''
                        }`}
                        placeholder={t('checkout.coupon_placeholder')}
                        disabled={isValidatingCoupon}
                      />
                      {couponError && <p className="absolute -bottom-5 left-0 text-[10px] text-red-500 animate-pulse">{couponError}</p>}
                    </>
                  )}
                </div>
                {appliedCoupon ? (
                  <button 
                    onClick={() => { setAppliedCoupon(null); setCouponDiscount(0); setCouponCode(''); }}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg font-bold py-2.5 px-4 text-xs flex items-center justify-center gap-2 transition-colors w-full md:w-auto"
                  >
                    <span className="material-icons-outlined text-sm">remove_circle_outline</span>
                    {t('sale.remove')}
                  </button>
                ) : (
                  <button 
                    onClick={handleApplyCoupon}
                    disabled={isValidatingCoupon || !couponCode}
                    className={`rounded-lg py-2.5 px-6 text-sm font-bold flex items-center justify-center gap-1 transition-colors w-full md:w-auto shadow-sm ${
                      isValidatingCoupon ? 'bg-gray-700 opacity-50 cursor-wait' : 'bg-[var(--brand-primary)] hover:bg-[color-mix(in srgb, var(--brand-primary), black 15%)] text-white'
                    }`}
                  >
                    {t('checkout.add_button')}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Tip Row - 2 Rows for easier mobile interaction */}
          <div className="flex flex-col gap-3 pt-2 pb-2 border-b border-[var(--border-main)]/10">
            <span className="text-[var(--text-main)] text-[15px] font-bold">{t('checkout.tip_label')}</span>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
                {[10, 15, 20].map(pct => {
                  const calculatedAmt = (total * pct) / 100;
                  return (
                    <button 
                      key={pct}
                      onClick={() => setTipAmount(calculatedAmt)}
                      className={`px-4 py-2.5 rounded-xl border text-xs font-black transition-all whitespace-nowrap ${
                        tipAmount === calculatedAmt 
                          ? 'bg-[var(--brand-primary)]/20 border-[var(--brand-primary)] text-[var(--brand-primary)]' 
                          : 'bg-[var(--bg-input)] border-[var(--border-main)] text-[var(--text-muted)] hover:border-gray-500'
                      }`}
                    >
                      {pct}%
                    </button>
                  );
                })}
              </div>
              <div className="relative flex-1 min-w-[120px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">
                  {formatPrice(0).replace(/[0-9.,\s]/g, '') || '$'}
                </span>
                <input 
                  type="number"
                  placeholder={t('sale.custom')}
                  value={tipAmount > 0 && ![10, 15, 20].includes(Math.round((tipAmount / total) * 100)) ? tipAmount : ''}
                  onChange={(e) => setTipAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-main)] rounded-xl pl-8 pr-2 py-2.5 text-sm text-[var(--text-main)] focus:ring-1 focus:ring-[var(--brand-primary)] placeholder-[var(--text-muted)] opacity-80 focus:opacity-100 transition-all outline-none"
                />
              </div>
              <button 
                onClick={() => setTipAmount(0)}
                className="text-gray-500 hover:text-red-500 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1 transition-colors px-2"
              >
                <span className="material-icons-outlined text-sm">restart_alt</span> {t('checkout.reset_button')}
              </button>
            </div>
          </div>


          {/* Service Type Selector */}
          <div className="flex flex-col gap-3 group">
            <span className="text-[var(--text-main)] text-[15px] font-bold">{t('checkout.service_type')}</span>
            <div className="grid grid-cols-3 gap-2 bg-[var(--bg-input)]/20 p-2 rounded-2xl border border-[var(--border-main)]/30">
              {[
                { id: 'takeaway', label: t('checkout.takeaway_label'), icon: 'shopping_bag' },
                isFoodEnabled && { id: 'dine_in', label: t('checkout.dine_in_label'), icon: 'restaurant' },
                { id: 'shipping', label: t('checkout.shipping_label'), icon: 'local_shipping' }
              ].filter(Boolean).map((type) => (
                <button 
                  key={type.id}
                  onClick={() => !resumingOrderId && setServiceType(type.id)}
                  className={`py-3 rounded-xl border border-transparent flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 ${
                    serviceType === type.id 
                      ? 'bg-[var(--brand-primary)] text-white shadow-md' 
                      : 'bg-[var(--bg-input)] text-[var(--text-muted)] hover:bg-[var(--bg-card)]/50'
                  } ${resumingOrderId ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <span className="material-icons-outlined text-xl">{type.icon}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Table Selector - Only for Dine-in */}
          {serviceType === 'dine_in' && (
            <div className="flex flex-col gap-2 animate-in fade-in duration-300">
              <span className="text-[var(--text-main)] text-[15px] font-bold">{t('tables.title')}</span>
              <div className="flex items-center justify-between gap-3 bg-[var(--bg-input)]/30 p-4 rounded-xl border border-[var(--border-main)]/30">
                <span className={`text-sm ${selectedTable ? 'text-[var(--brand-primary)] font-bold' : 'text-[var(--text-muted)]'}`}>
                  {selectedTable || t('tables.no_table')}
                </span>
                <button 
                  onClick={() => !resumingOrderId && setIsTableModalOpen(true)}
                  className={`bg-[var(--brand-primary)] hover:bg-[color-mix(in srgb, var(--brand-primary), black 15%)] text-white rounded-lg py-2.5 px-6 text-sm font-bold flex items-center justify-center gap-1 transition-colors shadow-sm ${
                    resumingOrderId ? 'opacity-50 cursor-not-allowed bg-gray-600' : ''
                  }`}
                  disabled={!!resumingOrderId}
                >
                  <span className="material-icons-outlined text-sm">table_restaurant</span>
                  {t('checkout.add_button')}
                </button>
              </div>
            </div>
          )}

          {/* Shipping Details - Only for Shipping */}
          {serviceType === 'shipping' && (
            <div className="flex flex-col gap-2 animate-in fade-in duration-300">
              <span className="text-[var(--text-main)] text-[15px] font-bold">{t('checkout.shipping_to')}</span>
              <div className="flex items-center justify-between gap-4 bg-[var(--bg-input)]/30 p-4 rounded-xl border border-[var(--border-main)]/30">
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {shippingDetails.first_name ? (
                    <>
                      <span className="text-[var(--brand-primary)] text-sm font-bold truncate">{shippingDetails.first_name} {shippingDetails.last_name}</span>
                      <span className="text-gray-400 text-xs truncate">{shippingDetails.address_1}, {shippingDetails.city}</span>
                    </>
                  ) : (
                    <span className="text-[var(--text-muted)] text-sm">{t('checkout.no_details')}</span>
                  )}
                </div>
                <button 
                  onClick={() => setIsShippingModalOpen(true)}
                  className="bg-[var(--brand-primary)] hover:bg-[color-mix(in srgb, var(--brand-primary), black 15%)] text-white rounded-lg py-2.5 px-6 text-sm font-bold flex items-center justify-center transition-colors shadow-sm"
                >
                  <span className="material-icons-outlined text-sm">local_shipping</span>
                  {t('checkout.add_button')}
                </button>
              </div>
            </div>
          )}

          {/* Payment Mode Switcher */}
          <div className="flex flex-col gap-3 animate-in slide-in-from-left duration-500">
             <span className="text-[var(--text-main)] text-[15px] font-bold">{t('checkout.payment_method')}</span>
             <div className="flex bg-[var(--bg-input)]/50 p-1.5 rounded-2xl border border-[var(--border-main)]/30 shadow-inner">
                <button 
                  onClick={() => setPaymentMode('offline')}
                  className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                    paymentMode === 'offline' ? 'bg-[var(--brand-primary)] text-white shadow-md' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                   <span className="material-icons-outlined text-base">payments</span>
                   {t('checkout.payment_offline')}
                </button>
                <button 
                  onClick={() => setPaymentMode('online')}
                  className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                    paymentMode === 'online' ? 'bg-[var(--brand-primary)] text-white shadow-md' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                   <span className="material-icons-outlined text-base">language</span>
                   {t('checkout.payment_online')}
                </button>
             </div>
          </div>

          {/* Payment Method Buttons - ONLY OFFLINE */}
          {paymentMode === 'offline' && (
            <div className="flex flex-col gap-3 group">
              <span className="text-[var(--text-muted)] text-[12px] font-black uppercase tracking-widest">
                {t('checkout.payment_offline')}
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {paymentGateways.length > 0 ? (
                  paymentGateways
                    .map((gateway) => (
                      <button
                        key={gateway.id}
                        onClick={() => setPaymentMethod(gateway.id)}
                        className={`py-4 px-4 rounded-xl border transition-all flex flex-col items-center justify-center gap-2 ${
                          paymentMethod === gateway.id
                            ? 'bg-[var(--brand-primary)] text-white border-transparent shadow-md scale-[1.02]'
                            : 'bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border-main)]/50 hover:bg-[var(--bg-page)]'
                        }`}
                      >
                        <span className="material-icons-outlined text-2xl">
                          {gateway.id === 'cash' ? 'payments' : 
                           gateway.id === 'cod' ? 'delivery_dining' : 
                           gateway.id === 'bacs' ? 'account_balance' : 
                           gateway.id === 'cheque' ? 'receipt_long' : 
                           gateway.id.includes('stripe') ? 'credit_card' :
                           gateway.id.includes('paypal') ? 'account_balance_wallet' :
                           'payment'}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-center leading-tight">
                          {gateway.title || gateway.method_title}
                        </span>
                      </button>
                    ))
                ) : (
                  <div className="col-span-full py-6 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-input)]/50 rounded-xl border border-dashed border-[var(--border-main)]">
                    {t('checkout.no_payment_methods')}
                  </div>
                )}
              </div>
            </div>
          )}


          {/* Received Input Row - Only for Offline Cash/COD */}
          {paymentMode === 'offline' && (paymentMethod === 'cod' || paymentMethod.toLowerCase().includes('cash')) && (
            <div className="flex flex-col gap-3 pt-6 border-t border-[var(--border-main)]/50 animate-in slide-in-from-bottom duration-500">
              <span className="text-[var(--text-main)] text-[15px] font-bold">{t('checkout.amount_received')}</span>
              <div className="flex flex-col gap-4">
                <div className="relative">
                  <input 
                    type="number" 
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-main)] rounded-2xl px-6 py-5 text-right text-[var(--text-main)] text-2xl focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] transition-all font-black shadow-inner"
                  />
                </div>
                {receivedAmount && (
                  <div className={`py-4 px-6 rounded-2xl border flex justify-between items-center animate-in zoom-in duration-300 ${
                    changeAmount >= 0 ? 'bg-green-500/10 border-green-500/20 shadow-sm shadow-green-500/10' : 'bg-red-500/10 border-red-500/20 shadow-sm shadow-red-500/10'
                  }`}>
                     <span className="text-[12px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                       {changeAmount >= 0 ? t('checkout.change_due') : t('checkout.balance_due')}
                     </span>
                     <span className={`text-2xl font-black tabular-nums ${changeAmount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                       {formatPrice(Math.abs(changeAmount))}
                     </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Order Note Row - Moved to bottom of payment step */}
          <div className="flex flex-col gap-2 mt-6 pt-6 border-t border-[var(--border-main)]/50 group">
            <div className="flex items-center gap-2">
              <span className="material-icons-outlined text-sm text-[var(--text-muted)]">notes</span>
              <span className="text-[var(--text-main)] text-[13px] font-bold uppercase tracking-wider">{t('checkout.note_label')}</span>
            </div>
            <textarea 
              value={orderNote}
              onChange={(e) => setOrderNote(e.target.value)}
              placeholder={t('checkout.note_placeholder')}
              rows="2"
              className="w-full bg-[var(--bg-input)] border border-[var(--border-main)] rounded-xl px-4 py-3.5 text-sm text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] transition-all resize-none custom-scrollbar shadow-inner"
            />
          </div>
        </div>
      </div>

      <footer className="h-16 border-t border-[var(--border-main)] bg-[var(--bg-header)] flex w-full">
        <button 
          onClick={onClose}
          className="flex-1 flex items-center justify-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-page)] font-bold uppercase tracking-widest text-xs transition-colors"
        >
          <span className="material-icons-outlined text-[18px]">close</span> {t('checkout.close')}
        </button>
        {serviceType === 'dine_in' && !resumingOrderId && (
           <button 
             onClick={() => handlePlaceOrder('on-hold')}
             disabled={isProcessing}
             className={`flex-1 flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-[10px] transition-all border-l border-[var(--border-main)] ${
               isProcessing ? 'text-[var(--text-muted)] opacity-50' : 'text-amber-500 hover:bg-amber-500/10'
             }`}
           >
             <span className="material-icons-outlined text-sm">event_seat</span>
             {t('checkout.save_book_table')}
           </button>
        )}
        <button 
          onClick={() => handlePlaceOrder(paymentMode)}
          disabled={isProcessing || (paymentMode === 'offline' && !paymentMethod)}
          className={`flex-[1.5] flex items-center justify-center gap-3 font-black uppercase tracking-widest text-sm transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] group ${
            isProcessing ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-[var(--brand-primary)] hover:bg-[color-mix(in srgb, var(--brand-primary), black 15%)] text-white active:scale-95 shadow-[0_4px_15px_rgba(14,165,233,0.3)]'
          }`}
        >
          {isProcessing ? (
             <>
               {t('checkout.finalizing')} <span className="material-icons-outlined animate-spin">sync</span>
             </>
          ) : (
             <>
               {serviceType === 'dine_in' ? t('checkout.pay_now') : t('checkout.place_order')} <span className="material-icons-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
             </>
          )}
        </button>
      </footer>

      {/* Customer Selector Modal Overlay */}
      {isCustomerModalOpen && (
        <CustomerSelectorModal 
          customers={customers}
          onClose={() => setIsCustomerModalOpen(false)}
          onSelect={handleSelectCustomer}
          onNavigate={(view) => {
            if (onNavigate) onNavigate(view);
            setIsCustomerModalOpen(false);
            onClose(); // Completely close checkout
          }}
        />
      )}

      {/* Discount Selector Modal Overlay */}
      {isDiscountModalOpen && (
        <DiscountSelectorModal 
          onClose={() => setIsDiscountModalOpen(false)}
          onSelect={handleSelectDiscount}
          currentDiscount={orderDiscount}
          totalBeforeDiscount={total}
          formatPrice={formatPrice}
        />
      )}

      {/* Table Selector Modal Overlay */}
      {isTableModalOpen && (
        <TableSelectorModal 
          onClose={() => setIsTableModalOpen(false)}
          tables={tables}
          selectedTable={selectedTable}
          occupiedTables={occupiedTables}
          onSelect={(tableName) => {
            setSelectedTable(tableName);
            setIsTableModalOpen(false);
          }}
        />
      )}

      {/* Shipping Address Modal Overlay */}
      {isShippingModalOpen && (
        <ShippingAddressModal 
          onClose={() => setIsShippingModalOpen(false)}
          onSave={(details) => {
            setShippingDetails(details);
            setIsShippingModalOpen(false);
          }}
          initialData={shippingDetails}
        />
      )}

      {/* Online Payment Iframe Modal Overlay */}
      {paymentUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
           <div className="bg-[#141419] border border-[#2C2C35] rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl animate-in zoom-in duration-300 overflow-hidden">
              <header className="px-6 py-4 border-b border-[#2C2C35] flex items-center justify-between shrink-0">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--brand-primary)]/20 flex items-center justify-center">
                       <span className="material-icons-outlined text-[var(--brand-primary)]">shield</span>
                    </div>
                    <div>
                       <h3 className="text-white font-black text-sm uppercase tracking-widest">{t('checkout.payment_online')}</h3>
                       <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">{paymentGateways.find(g => g.id === paymentMethod)?.title || paymentMethod}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                    {cfd && (
                      <button 
                        onClick={() => {
                          cfd.broadcastPaymentUrl(paymentUrl);
                          toast.success(t('checkout.sent_to_display'));
                        }}
                        className="text-[var(--brand-primary)] bg-[var(--brand-primary)]/10 hover:bg-[var(--brand-primary)]/20 px-3 py-1.5 flex items-center gap-2 rounded-lg text-xs font-bold uppercase transition-colors tracking-widest mr-2"
                        title="Cast to Customer Display"
                      >
                         <span className="material-icons-outlined text-sm">cast</span> {t('checkout.cast_screen')}
                      </button>
                    )}
                    <button 
                      onClick={() => setPaymentUrl('')}
                      className="text-gray-500 hover:text-white transition-colors"
                    >
                       <span className="material-icons-outlined">close</span>
                    </button>
                 </div>
              </header>

              <div className="flex-1 bg-white relative">
                 <div className="absolute inset-0 flex items-center justify-center -z-10">
                    <div className="flex flex-col items-center gap-3">
                       <div className="w-12 h-12 border-4 border-gray-200 border-t-[var(--brand-primary)] rounded-full animate-spin"></div>
                       <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">{t('checkout.finalizing')}...</p>
                    </div>
                 </div>
                  <iframe 
                    ref={iframeRef}
                    src={paymentUrl} 
                    className="w-full h-full border-none"
                    title="Payment Gate"
                  />
              </div>

               <footer className="p-6 border-t border-[#2C2C35] flex justify-between items-center gap-4">
                  <button 
                    onClick={() => setPaymentUrl('')}
                    className="text-gray-500 hover:text-white font-bold uppercase text-[10px] tracking-widest px-4"
                  >
                     {t('common.cancel')}
                  </button>
                  <button 
                    onClick={() => {
                        if (iframeRef.current) {
                            iframeRef.current.contentWindow.postMessage({ type: 'yeepos_trigger_payment' }, '*');
                        }
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-500 text-white px-8 py-5 rounded-xl font-black uppercase tracking-widest text-sm transition-all shadow-lg shadow-green-600/20 active:scale-95 flex items-center justify-center gap-3"
                  >
                     <span className="material-icons-outlined !normal-case">payments</span> 
                     {t('checkout.payment_button')}
                  </button>
               </footer>
            </div>
         </div>
      )}

      {/* Global Processing Loader Overlay */}
      {isProcessing && !paymentUrl && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
           <div className="bg-[#141419] border border-[#2C2C35] rounded-3xl p-10 flex flex-col items-center gap-6 shadow-2xl animate-in fade-in zoom-in duration-300">
              <div className="relative">
                 <div className="w-20 h-20 border-4 border-[var(--brand-primary)]/20 border-t-[var(--brand-primary)] rounded-full animate-spin"></div>
                 <div className="absolute inset-0 flex items-center justify-center">
                    <span className="material-icons-outlined text-[var(--brand-primary)] animate-pulse">shopping_cart</span>
                 </div>
              </div>
              <div className="text-center">
                 <h3 className="text-white font-black text-xl uppercase tracking-widest mb-2">{t('checkout.processing')}</h3>
                 <p className="text-gray-500 font-bold text-xs uppercase tracking-tight">{t('checkout.finalizing')}...</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
