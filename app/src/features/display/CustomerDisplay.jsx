import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CHANNEL_NAME } from '../../hooks/useCFDBroadcast';
import { useTranslation } from '../../utils/i18n';
import logo from '../../assets/logo.png';

const formatPrice = (price, config) => {
  const { currency, currencyPos, thousandSep, decimalSep, numDecimals } = config || {
    currency: 'USD',
    currencyPos: 'left',
    thousandSep: ',',
    decimalSep: '.',
    numDecimals: 2
  };
  
  const currencyMap = { 'USD': '$', 'VND': '₫', 'EUR': '€', 'GBP': '£' };
  const symbol = currencyMap[currency] || currency;

  let formattedNumber = parseFloat(price || 0).toFixed(numDecimals);
  const parts = formattedNumber.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
  formattedNumber = parts.join(decimalSep);

  switch (currencyPos) {
    case 'left': return `${symbol}${formattedNumber}`;
    case 'right': return `${formattedNumber}${symbol}`;
    case 'left_space': return `${symbol} ${formattedNumber}`;
    case 'right_space': return `${formattedNumber} ${symbol}`;
    default: return `${symbol}${formattedNumber}`;
  }
};

/**
 * Customer-Facing Display Component
 * Runs in a separate browser tab/window, receives data via BroadcastChannel.
 */
export function CustomerDisplay() {
  const { t, language } = useTranslation();
  const [screen, setScreen] = useState('idle'); // 'idle', 'cart', 'checkout', 'complete'
  const [cartData, setCartData] = useState({ items: [], itemCount: 0, subtotal: 0, taxAmount: 0, total: 0, taxConfig: {} });
  const [checkoutData, setCheckoutData] = useState({});
  const [completeData, setCompleteData] = useState({});
  const [paymentUrl, setPaymentUrl] = useState('');
  const [priceFormatConfig, setPriceFormatConfig] = useState(() => {
    const saved = localStorage.getItem('pos_price_format_config');
    return saved ? JSON.parse(saved) : {
      currency: 'USD',
      currencyPos: 'left',
      thousandSep: ',',
      decimalSep: '.',
      numDecimals: 2
    };
  });
  const [shopName, setShopName] = useState(window.yeePOSData?.siteTitle || 'YeePOS');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [animatingItemId, setAnimatingItemId] = useState(null);
  const completeTimerRef = useRef(null);
  const prevItemCountRef = useRef(0);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // BroadcastChannel Listener
  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME);

    channel.onmessage = (event) => {
      const { type, payload } = event.data;

      // Update price format config if present in the payload
      if (payload && payload.priceFormatConfig) {
        setPriceFormatConfig(payload.priceFormatConfig);
      }

      switch (type) {
        case 'cart_update':
          // Detect newly added item for animation
          if (payload.items.length > cartData.items.length) {
            const newItem = payload.items[payload.items.length - 1];
            setAnimatingItemId(newItem?.id);
            setTimeout(() => setAnimatingItemId(null), 600);
          }
          setCartData(payload);
          if (payload.items.length > 0) {
            setScreen('cart');
          } else {
            setScreen('idle');
          }
          break;

        case 'checkout_open':
          setCheckoutData(payload);
          setScreen('checkout');
          break;

        case 'processing':
          if (payload.isProcessing) {
            setScreen('processing');
          } else {
            // If processing stops but we aren't complete, go back to checkout summary
            setScreen((prev) => (prev === 'processing' ? 'checkout' : prev));
          }
          break;

        case 'order_complete':
          setCompleteData(payload);
          setScreen('complete');
          // Auto-return to idle after 10 seconds
          if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
          completeTimerRef.current = setTimeout(() => {
            setScreen('idle');
            setCartData({ items: [], itemCount: 0, subtotal: 0, taxAmount: 0, total: 0, taxConfig: {} });
          }, 10000);
          break;

        case 'idle':
          if (payload.shopName) setShopName(payload.shopName);
          setScreen('idle');
          setCartData({ items: [], itemCount: 0, subtotal: 0, taxAmount: 0, total: 0, taxConfig: {} });
          break;

        case 'payment_url':
          if (payload.url) {
            setPaymentUrl(payload.url);
            setScreen('payment_url');
          }
          break;

        default:
          break;
      }
    };

    return () => channel.close();
  }, [cartData.items.length]);

  // Render based on screen state
  return (
    <div className="dark fixed inset-0 bg-[var(--bg-page)] text-[var(--text-main)] font-sans overflow-hidden select-none cursor-default">
      {/* Ambient background gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-[var(--brand-primary)]/[0.05] blur-[150px]" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full bg-[var(--brand-primary)]/[0.03] blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col h-full">
        {screen === 'idle' && <IdleScreen shopName={shopName} currentTime={currentTime} t={t} language={language} />}
        {screen === 'cart' && <CartScreen data={cartData} animatingItemId={animatingItemId} currentTime={currentTime} shopName={shopName} t={t} language={language} priceFormatConfig={priceFormatConfig} />}
        {screen === 'checkout' && <CheckoutScreen data={checkoutData} currentTime={currentTime} shopName={shopName} t={t} language={language} priceFormatConfig={priceFormatConfig} />}
        {screen === 'processing' && <ProcessingScreen shopName={shopName} t={t} />}
        {screen === 'payment_url' && <PaymentUrlScreen url={paymentUrl} shopName={shopName} t={t} />}
        {screen === 'complete' && <CompleteScreen data={completeData} shopName={shopName} t={t} priceFormatConfig={priceFormatConfig} />}
      </div>
    </div>
  );
}

/* ─── PAYMENT URL SCREEN (IFRAME) ─── */
function PaymentUrlScreen({ url, shopName, t }) {
  const iframeRef = useRef(null);

  useEffect(() => {
    // Relay successful payment back to the POS via BroadcastChannel
    const handleIframeMessage = (event) => {
      if (event.data && event.data.type === 'yeepos_payment_success') {
        const channel = new BroadcastChannel(CHANNEL_NAME);
        channel.postMessage({ type: 'yeepos_payment_success', data: event.data });
        channel.close();
      }
    };

    window.addEventListener('message', handleIframeMessage);
    return () => window.removeEventListener('message', handleIframeMessage);
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-card)] animate-fade-in relative">
      <header className="px-6 py-4 flex items-center justify-between border-b border-[var(--border-main)] bg-[var(--bg-header)] shrink-0">
         <div className="flex items-center gap-3">
            <span className="material-icons-outlined text-[var(--brand-primary)]">shield</span>
            <span className="text-[var(--text-main)] font-black uppercase text-sm tracking-widest">{t('checkout.payment_online')}</span>
         </div>
         <span className="text-[var(--text-muted)] font-bold uppercase tracking-tight text-[10px]">{shopName}</span>
      </header>
      <div className="flex-1 relative">
         <div className="absolute inset-0 flex items-center justify-center -z-10">
            <div className="flex flex-col items-center gap-3">
               <div className="w-12 h-12 border-4 border-[var(--border-main)] border-t-[var(--brand-primary)] rounded-full animate-spin"></div>
               <p className="text-[var(--text-muted)] font-bold text-xs uppercase tracking-widest">{t('checkout.processing')}...</p>
            </div>
         </div>
         <iframe 
           ref={iframeRef}
           src={url} 
           className="w-full h-full border-none bg-transparent"
           title="CFD Payment"
         />
      </div>
    </div>
  );
}

/* ─── PROCESSING PAYMENT SCREEN ─── */
function ProcessingScreen({ shopName, t }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center animate-fade-in relative">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[var(--brand-primary)]/10 rounded-full blur-[100px] animate-pulse" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {/* Animated Processing Icon */}
        <div className="mb-12 relative">
          <div className="w-32 h-32 rounded-full border-4 border-t-[var(--brand-primary)] border-[var(--brand-primary)]/20 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-icons-outlined text-[var(--brand-primary)] text-4xl animate-pulse">payment</span>
          </div>
        </div>

        <h2 className="text-4xl font-black text-[var(--text-main)] mb-4 tracking-tight">{t('cfd.processing')}</h2>
        <p className="text-[var(--text-muted)] text-xl font-medium mb-8">{t('cfd.processing_subtitle')}</p>
        
        {/* Sub-label */}
        <div className="flex items-center gap-3 px-6 py-2 rounded-full bg-[var(--bg-card)] border border-[var(--border-main)]">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[var(--text-muted)] text-sm font-bold uppercase tracking-widest">{shopName} {t('cfd.secured')}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── IDLE / WELCOME SCREEN ─── */
function IdleScreen({ shopName, currentTime, t, language }) {
  const locale = language === 'vi' ? 'vi-VN' : 'en-US';
  return (
    <div className="flex-1 flex flex-col items-center justify-center animate-fade-in">
      {/* Logo */}
      <div className="mb-12 flex flex-col items-center">
        <img src={logo} alt="YeePOS" className="h-32 object-contain mb-6 drop-shadow-[0_0_20px_var(--brand-primary)]" />
        <div className="h-[2px] w-32 bg-gradient-to-r from-transparent via-[var(--brand-primary)]/50 to-transparent mb-8" />
        <p className="text-[var(--text-muted)] text-xl font-light tracking-[0.3em] uppercase">{shopName}</p>
      </div>

      {/* Welcome */}
      <div className="text-center mb-16">
        <h1 className="text-6xl font-black text-[var(--text-main)] mb-4 tracking-tight uppercase">{t('cfd.welcome')}</h1>
        <p className="text-[var(--text-muted)] text-xl font-light uppercase tracking-widest">{t('cfd.welcome_subtitle')}</p>
      </div>

      {/* Clock */}
      <div className="text-center">
        <p className="text-8xl font-black text-[var(--text-main)] tabular-nums tracking-tighter">
          {currentTime.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: true })}
        </p>
        <p className="text-[var(--text-muted)] text-base mt-4 font-black tracking-[0.2em] uppercase">
          {currentTime.toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Subtle pulse indicator */}
      <div className="absolute bottom-8 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[var(--text-muted)] text-xs font-black tracking-widest uppercase">{t('cfd.connected')}</span>
      </div>
    </div>
  );
}

/* ─── CART SCREEN (LIVE) ─── */
function CartScreen({ data, animatingItemId, currentTime, shopName, t, language, priceFormatConfig }) {
  const { items, itemCount, subtotal, taxAmount, total, taxConfig } = data;
  const locale = language === 'vi' ? 'vi-VN' : 'en-US';

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <header className="px-12 py-6 flex items-center justify-between border-b border-[var(--border-main)] shrink-0 bg-[var(--bg-card)]">
        <div className="flex items-center gap-4">
          <img src={logo} alt="YeePOS" className="h-10 object-contain drop-shadow-[0_0_10px_var(--brand-primary)]" />
          <div className="h-8 w-px bg-[var(--border-main)]" />
          <span className="text-[var(--text-muted)] text-sm font-black tracking-widest uppercase">{shopName}</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/20 rounded-full px-5 py-2 flex items-center gap-2">
            <span className="material-icons-outlined text-[var(--brand-primary)] text-[20px]">shopping_cart</span>
            <span className="text-[var(--brand-primary)] font-black uppercase text-sm tracking-widest">{itemCount} {t('sale.items')}</span>
          </div>
          <span className="text-[var(--text-muted)] text-sm tabular-nums font-black tracking-widest uppercase">
            {currentTime.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: true })}
          </span>
        </div>
      </header>

      {/* Items List */}
      <div className="flex-1 overflow-hidden flex flex-col px-12 py-6">
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
          {/* Table header */}
          <div className="flex items-center px-6 py-3 text-[var(--text-muted)] text-xs font-black uppercase tracking-[0.2em]">
            <span className="w-16 text-center">#</span>
            <span className="flex-1">{t('cfd.col_item')}</span>
            <span className="w-24 text-center">{t('cfd.col_qty')}</span>
            <span className="w-32 text-right">{t('cfd.col_price')}</span>
            <span className="w-36 text-right">{t('sale.total')}</span>
          </div>

          {items.map((item, idx) => (
            <div
              key={item.id}
              className={`flex items-center px-6 py-5 rounded-2xl transition-all duration-500 border ${
                animatingItemId === item.id
                  ? 'bg-[var(--brand-primary)]/10 border-[var(--brand-primary)]/30 scale-[1.01] shadow-lg shadow-[var(--brand-primary)]/10'
                  : 'bg-[var(--bg-card)] hover:bg-[var(--bg-card)]/80 border-[var(--border-main)] hover:border-[var(--brand-primary)]/50'
              }`}
            >
              <span className="w-16 text-center text-[var(--brand-primary)] font-black text-sm">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <h3 className="text-[var(--text-main)] font-black text-xl tracking-tight truncate uppercase">{item.name}</h3>
                {item.selectedAddons && item.selectedAddons.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {item.selectedAddons.map((addon, aIdx) => (
                      <span key={aIdx} className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest">
                        + {addon.name} {addon.selectedSize ? `(${addon.selectedSize.name})` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className="w-24 text-center">
                <span className="inline-flex items-center justify-center bg-[var(--bg-input)] border border-[var(--border-main)] rounded-xl px-4 py-2 text-[var(--text-main)] font-black text-lg min-w-[56px]">
                  {item.quantity}
                </span>
              </span>
              <span className="w-32 text-right text-[var(--text-muted)] font-black text-base tabular-nums">{formatPrice(item.price, priceFormatConfig)}</span>
              <span className="w-36 text-right text-[var(--brand-primary)] font-black text-2xl tabular-nums tracking-tight">{formatPrice(item.total, priceFormatConfig)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Totals Footer */}
      <footer className="px-12 py-10 border-t border-[var(--border-main)] bg-[var(--bg-card)] shrink-0 relative overflow-hidden">
        {/* Decorative brand glow */}
        <div className="absolute right-0 bottom-0 w-64 h-64 bg-[var(--brand-primary)]/10 blur-[80px] pointer-events-none" />
        <div className="max-w-2xl ml-auto space-y-4 relative z-10">
          <div className="flex justify-between items-center">
            <span className="text-[var(--text-muted)] text-base font-black uppercase tracking-widest">{t('sale.subtotal')}</span>
            <span className="text-[var(--text-main)] text-xl font-black tabular-nums">{formatPrice(subtotal, priceFormatConfig)}</span>
          </div>
          {taxConfig?.enabled && (
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)] text-base font-black uppercase tracking-widest">{taxConfig.label} ({taxConfig.rate}%)</span>
              <span className="text-[var(--text-main)] text-xl font-black tabular-nums">{formatPrice(taxAmount, priceFormatConfig)}</span>
            </div>
          )}
          <div className="h-px bg-[var(--border-main)] my-4" />
          <div className="flex justify-between items-center">
            <span className="text-[var(--text-main)] text-4xl font-black tracking-tighter uppercase">{t('sale.total')}</span>
            <span className="text-6xl font-black text-[var(--brand-primary)] tabular-nums tracking-tighter">{formatPrice(total, priceFormatConfig)}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── CHECKOUT SCREEN ─── */
function CheckoutScreen({ data, currentTime, shopName, t, language, priceFormatConfig }) {
  const { 
    items, subtotal, taxAmount, total, 
    customerName, paymentMethod, 
    orderDiscount, couponDiscount, couponCode, tip 
  } = data;
  const locale = language === 'vi' ? 'vi-VN' : 'en-US';

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <header className="px-12 py-6 flex items-center justify-between border-b border-[var(--border-main)] shrink-0 bg-[var(--bg-card)]">
        <div className="flex items-center gap-4">
          <img src={logo} alt="YeePOS" className="h-10 object-contain drop-shadow-[0_0_10px_var(--brand-primary)]" />
          <div className="h-8 w-px bg-[var(--border-main)]" />
          <span className="text-[var(--text-muted)] text-sm font-black tracking-widest uppercase">{shopName}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-amber-500 text-sm font-black uppercase tracking-widest">{t('cfd.processing')}</span>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-12">
        <div className="w-full max-w-2xl relative">
          {/* Decorative glowing behind card */}
          <div className="absolute inset-0 bg-[var(--brand-primary)]/20 blur-[100px] pointer-events-none rounded-full" />
          
          {/* Order Summary Card */}
          <div className="bg-[var(--bg-card)] border-2 border-[var(--brand-primary)]/30 rounded-3xl p-10 shadow-[0_0_40px_var(--brand-primary)]/10 relative overflow-hidden group z-10">
            <h2 className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] mb-8">{t('checkout.sales_summary')}</h2>

            {/* Items */}
            <div className="space-y-4 mb-8 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
              {items?.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--brand-primary)] font-black text-sm w-8">{item.quantity}×</span>
                    <span className="text-[var(--text-main)] font-black uppercase tracking-tight">{item.name}</span>
                  </div>
                  <span className="text-[var(--text-main)] font-black tabular-nums">{formatPrice(item.total || item.price * item.quantity, priceFormatConfig)}</span>
                </div>
              ))}
            </div>

            <div className="h-px bg-[var(--border-main)] mb-6" />

            {/* Totals */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)] font-medium">{t('sale.subtotal')}</span>
                <span className="text-[var(--text-main)] font-semibold tabular-nums">{formatPrice(subtotal, priceFormatConfig)}</span>
              </div>
              
              {orderDiscount > 0 && (
                <div className="flex justify-between">
                  <span className="text-emerald-500 font-medium">{t('checkout.discount_label')}</span>
                  <span className="text-emerald-400 font-semibold tabular-nums">-{formatPrice(orderDiscount, priceFormatConfig)}</span>
                </div>
              )}
              
              {couponDiscount > 0 && (
                <div className="flex justify-between">
                  <span className="text-emerald-500 font-medium">{t('checkout.coupon_label')} {couponCode ? `(${couponCode})` : ''}</span>
                  <span className="text-emerald-400 font-semibold tabular-nums">-{formatPrice(couponDiscount, priceFormatConfig)}</span>
                </div>
              )}

              {tip > 0 && (
                <div className="flex justify-between">
                  <span className="text-amber-500 font-medium">{t('checkout.tip_label')}</span>
                  <span className="text-amber-400 font-semibold tabular-nums">+{formatPrice(tip, priceFormatConfig)}</span>
                </div>
              )}

              {taxAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)] font-medium">{t('checkout.tax')}</span>
                  <span className="text-[var(--text-main)] font-semibold tabular-nums">{formatPrice(taxAmount, priceFormatConfig)}</span>
                </div>
              )}

              <div className="h-px bg-[var(--border-main)]" />
              <div className="flex justify-between items-center pt-2">
                <span className="text-2xl font-bold text-[var(--text-main)]">{t('sale.total')}</span>
                <span className="text-3xl font-black text-[var(--brand-primary)] tabular-nums">{formatPrice(total, priceFormatConfig)}</span>
              </div>
            </div>

            {/* Payment Method & Customer */}
            <div className="mt-8 pt-6 border-t border-[var(--border-main)] flex justify-between items-center">
              {customerName && (
                <div className="flex items-center gap-2">
                  <span className="material-icons-outlined text-[var(--text-muted)] text-[20px]">person</span>
                  <span className="text-[var(--text-muted)] text-sm font-medium">{customerName}</span>
                </div>
              )}
              {paymentMethod && (
                <div className="flex items-center gap-2">
                  <span className="material-icons-outlined text-[var(--text-muted)] text-[20px]">payment</span>
                  <span className="text-[var(--text-muted)] text-sm font-medium">{paymentMethod}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── ORDER COMPLETE / THANK YOU SCREEN ─── */
function CompleteScreen({ data, shopName, t, priceFormatConfig }) {
  const { 
    orderId, total, paymentMethod, changeAmount, customerName,
    orderDiscount, couponDiscount, couponCode, tip, subtotal, taxAmount
  } = data;
  const [progress, setProgress] = useState(100);

  // Auto-countdown progress bar (10 seconds)
  useEffect(() => {
    const start = Date.now();
    const duration = 10000;
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) clearInterval(timer);
    }, 50);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center animate-fade-in">
      {/* Success Checkmark */}
      <div className="mb-10 relative">
        <div className="w-32 h-32 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center animate-bounce-once">
          <span className="material-icons-outlined text-emerald-400" style={{ fontSize: '64px' }}>check_circle</span>
        </div>
        {/* Ring animation */}
        <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping" />
      </div>

      {/* Thank You */}
      <h1 className="text-7xl font-black text-[var(--text-main)] mb-4 tracking-tighter uppercase">{t('cfd.thank_you')}</h1>
      {customerName && customerName !== 'Walk-in Customer' && (
        <p className="text-2xl text-[var(--text-muted)] font-black uppercase tracking-widest mb-4">{customerName}</p>
      )}
      <p className="text-[var(--text-muted)] text-xl font-light uppercase tracking-[0.3em] mb-12">{t('cfd.success_subtitle')}</p>

      {/* Order Info Card */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl p-10 min-w-[500px] shadow-2xl mb-12 relative overflow-hidden group">
        {orderId && (
          <div className="flex justify-between items-center mb-8 pb-6 border-b border-[var(--border-main)]">
            <span className="text-[var(--text-muted)] text-xs font-black uppercase tracking-[0.2em]">{t('cfd.col_item')}</span>
            <span className="text-[var(--text-main)] font-black text-2xl tracking-tight">#{orderId}</span>
          </div>
        )}
        
        <div className="space-y-3 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-[var(--text-muted)] text-sm font-medium">{t('sale.subtotal')}</span>
            <span className="text-[var(--text-main)] font-semibold">{formatPrice(subtotal, priceFormatConfig)}</span>
          </div>

          {orderDiscount > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-emerald-500 text-sm font-medium">{t('checkout.discount_label')}</span>
              <span className="text-emerald-400 font-semibold">-{formatPrice(orderDiscount, priceFormatConfig)}</span>
            </div>
          )}

          {couponDiscount > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-emerald-500 text-sm font-medium">{t('checkout.coupon_label')} {couponCode ? `(${couponCode})` : ''}</span>
              <span className="text-emerald-400 font-semibold">-{formatPrice(couponDiscount, priceFormatConfig)}</span>
            </div>
          )}

          {tip > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-amber-500 text-sm font-medium">{t('checkout.tip_label')}</span>
              <span className="text-amber-400 font-semibold">+{formatPrice(tip, priceFormatConfig)}</span>
            </div>
          )}

          {taxAmount > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)] text-sm font-medium">{t('checkout.tax')}</span>
              <span className="text-[var(--text-main)] font-semibold">{formatPrice(taxAmount, priceFormatConfig)}</span>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center mb-4 pt-4 border-t border-[var(--border-main)]">
          <span className="text-[var(--text-main)] text-lg font-bold">{t('checkout.total_paid')}</span>
          <span className="text-3xl font-black text-[var(--brand-primary)] tabular-nums">{formatPrice(total, priceFormatConfig)}</span>
        </div>
        
        {paymentMethod && (
          <div className="flex justify-between items-center mb-4">
            <span className="text-[var(--text-muted)] text-sm font-medium">{t('orders.pay_method')}</span>
            <span className="text-[var(--text-main)] font-semibold">{paymentMethod}</span>
          </div>
        )}

        {changeAmount > 0 && (
          <div className="flex justify-between items-center pt-4 border-t border-[var(--border-main)]">
            <span className="text-amber-500 text-sm font-bold uppercase tracking-wider">{t('checkout.change_due')}</span>
            <span className="text-3xl font-black text-amber-400 tabular-nums">{formatPrice(changeAmount, priceFormatConfig)}</span>
          </div>
        )}
      </div>

      {/* Auto-return progress */}
      <div className="w-64">
        <div className="h-1 bg-[var(--bg-input)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--brand-primary)]/40 rounded-full transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[var(--text-muted)] text-xs text-center mt-2 font-medium">{t('cfd.returning')}</p>
      </div>

      {/* Shop name / Logo */}
      <div className="absolute bottom-8 flex items-center gap-3">
        <img src={logo} alt="YeePOS" className="h-8 object-contain opacity-50 grayscale hover:grayscale-0 transition-all" />
      </div>
    </div>
  );
}
