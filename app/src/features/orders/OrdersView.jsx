import { useState, useEffect, useRef } from 'react';
import { db } from '../../db/indexedDB';
import { printReceipt } from '../../utils/receiptUtils';
import { sendOrderEmail, fetchOrders, updateOrder, createRefund, createOrderNote, searchOrdersOnline } from '../../api/woocommerce';
import toast from '../../utils/toast';
import { useTranslation } from '../../utils/i18n';

export function OrdersView({ formatPrice, shopSettings, onOrderRead, onResumeOrder, onCacheOrder }) {
  const { t, isRTL } = useTranslation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterStaff, setFilterStaff] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [emailInput, setEmailInput] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSyncingOnline, setIsSyncingOnline] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [onlineSearchResults, setOnlineSearchResults] = useState([]);
  const searchTimeoutRef = useRef(null);
  
  // Refund State
  const [isRefundMode, setIsRefundMode] = useState(false);
  const [refundItems, setRefundItems] = useState([]);
  const [refundRestock, setRefundRestock] = useState(true);

  // Email Modal State
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Resize State
  const [sidebarWidth, setSidebarWidth] = useState(() => parseInt(localStorage.getItem('ordersSidebarWidth')) || 480);
  const [isResizing, setIsResizing] = useState(false);

  // Auto-Refresh Trigger
  const [syncTrigger, setSyncTrigger] = useState(0);

  useEffect(() => {
    const handleSync = (e) => {
      const result = e.detail;
      
      // If the currently selected order was just synced, update its ID reactively
      if (result?.pending?.synced?.length > 0) {
        setSelectedOrder(current => {
          if (!current) return current;
          const matching = result.pending.synced.find(s => s.oldId === current.id);
          return matching ? matching.newOrder : current;
        });
      }
      
      setSyncTrigger(prev => prev + 1);
    };
    window.addEventListener('yeepos_sync_finished', handleSync);
    return () => window.removeEventListener('yeepos_sync_finished', handleSync);
  }, []);

  // Debounced online search for Cache-on-Demand
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!searchTerm || searchTerm.length < 2 || !navigator.onLine) {
      setIsSearchingOnline(false);
      return;
    }

    setIsSearchingOnline(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchOrdersOnline(searchTerm);
        if (results.length > 0) {
          // Identify un-cached orders
          const existingIds = new Set((await db.orders.toArray()).map(o => o.id));
          const newOrders = results.filter(o => !existingIds.has(o.id));
          
          setOnlineSearchResults(newOrders);
        } else {
          setOnlineSearchResults([]);
        }
      } catch (err) {
        console.error('[YeePOS] Online order search failed:', err);
      } finally {
        setIsSearchingOnline(false);
      }
    }, 500); // 500ms debounce since order search might be heavier

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchTerm]);

  useEffect(() => {
    loadOrders();
  }, [currentPage, filterStatus, filterStaff, filterDate, searchTerm, syncTrigger]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterStaff, filterDate, searchTerm]);

  useEffect(() => {
    if (selectedOrder) {
      setEmailInput(selectedOrder.customerEmail || '');
    } else {
      setEmailInput('');
    }
  }, [selectedOrder]);

  const handleSendEmail = async () => {
    setShowEmailModal(true);
  };

  const handleConfirmSendEmail = async (email) => {
    if (!email || !email.includes('@')) {
      toast.error(t('orders.invalid_email'));
      return;
    }

    setIsSendingEmail(true);
    try {
      await sendOrderEmail(selectedOrder.id, email);
      if (selectedOrder.syncStatus === 1) {
        const cashierName = window.yeePOSData?.currentUser?.display_name || 'System';
        await createOrderNote(selectedOrder.id, `Receipt email sent to ${email} by ${cashierName} via POS`);
      }
      toast.success(t('orders.receipt_sent_success'));
      setShowEmailModal(false);
    } catch (error) {
      console.error(error);
      toast.error(error.message || t('orders.receipt_sent_error'));
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleUpdateStatus = async (status) => {
    if (!confirm(t('orders.confirm_status', { status }))) return;
    
    setIsUpdatingStatus(true);
    try {
      if (selectedOrder.syncStatus === 1) {
        await updateOrder(selectedOrder.id, { status });
      }
      
      await db.orders.update(selectedOrder.id, { status, syncStatus: selectedOrder.syncStatus === 1 ? 1 : 0 });
      setSelectedOrder({ ...selectedOrder, status });
      
      if (selectedOrder.syncStatus === 1) {
        const cashierName = window.yeePOSData?.currentUser?.display_name || 'System';
        await createOrderNote(selectedOrder.id, `Order marked as ${status} by ${cashierName} via POS`);
      }
      
      toast.success(t('orders.status_marked', { status }));
      loadOrders();
    } catch (error) {
      console.error(error);
      toast.error(t('orders.status_error', { status }));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const switchToRefundMode = () => {
    setRefundItems(selectedOrder.items.map(i => ({
      id: i.id,
      product_id: i.product_id,
      name: i.name,
      price: parseFloat(i.price) || (i.quantity ? parseFloat(i.total) / i.quantity : 0),
      maxQty: i.quantity,
      refundQty: i.quantity, // default to full refund of items
      checked: true // default new refund mode to all selected
    })));
    setRefundRestock(true);
    setIsRefundMode(true);
  };

  const calculateCurrentRefundTotal = () => {
    if (!selectedOrder) return 0;
    const itemsToRefund = refundItems.filter(i => i.checked && i.refundQty > 0);
    const originalSubtotal = selectedOrder.items.reduce((acc, i) => acc + (parseFloat(i.total) || 0), 0);
    const refundItemsSubtotal = itemsToRefund.reduce((acc, i) => acc + (i.price * i.refundQty), 0);
    
    if (originalSubtotal <= 0) return 0;
    
    const ratio = refundItemsSubtotal / originalSubtotal;
    // Round to 2 decimals to match currency
    return Math.min(selectedOrder.total, parseFloat((selectedOrder.total * ratio).toFixed(2)));
  };

  const handleToggleSelectAll = (checked) => {
    setRefundItems(refundItems.map(item => ({ ...item, checked })));
  };

  const submitRefund = async () => {
    
    setIsUpdatingStatus(true);
    try {
      const itemsToRefund = refundItems.filter(i => i.checked && i.refundQty > 0);
      
      // Calculate proportional refund amount to include taxes and discounts
      const originalSubtotal = selectedOrder.items.reduce((acc, i) => acc + (parseFloat(i.total) || 0), 0);
      const refundItemsSubtotal = itemsToRefund.reduce((acc, i) => acc + (i.price * i.refundQty), 0);
      const ratio = originalSubtotal > 0 ? (refundItemsSubtotal / originalSubtotal) : 0;
      
      // Ensure we don't exceed total order amount, especially for rounding
      const refundAmount = Math.min(selectedOrder.total, parseFloat((selectedOrder.total * ratio).toFixed(2)));
      
      const payloadLineItems = itemsToRefund.map(i => ({
        id: i.id, // WC item_id
        quantity: i.refundQty,
        refund_total: (i.price * i.refundQty).toString()
      }));

      if (selectedOrder.syncStatus === 1) {
        await createRefund(selectedOrder.id, refundAmount, payloadLineItems, refundRestock);
        const cashierName = window.yeePOSData?.currentUser?.display_name || 'System';
        await createOrderNote(selectedOrder.id, `Refund processed by ${cashierName} via POS: ${formatPrice(refundAmount)} refunded.`);
      }

      // Update local db
      const updatedItems = selectedOrder.items.map(item => {
        const refundItem = itemsToRefund.find(ri => ri.id === item.id);
        if (refundItem) {
          return {
            ...item,
            quantity: item.quantity - refundItem.refundQty,
            total: item.total - (refundItem.price * refundItem.refundQty)
          };
        }
        return item;
      }).filter(item => item.quantity > 0);

      const isFullRefund = updatedItems.length === 0 && itemsToRefund.length === selectedOrder.items.length;
      const newStatus = isFullRefund ? 'refunded' : selectedOrder.status;
      const newTotal = Math.max(0, selectedOrder.total - refundAmount);

      await db.orders.update(selectedOrder.id, { 
        items: updatedItems,
        total: newTotal,
        status: newStatus 
      });

      setSelectedOrder({ ...selectedOrder, items: updatedItems, total: newTotal, status: newStatus });
      setIsRefundMode(false);
      toast.success(t('orders.refund_success'));
      loadOrders();
    } catch (error) {
      console.error(error);
      toast.error(t('orders.refund_error', { error: error.message }));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSyncOnlineOrders = async () => {
    setIsSyncingOnline(true);
    try {
      const remoteOrders = await fetchOrders(1, 100); // Fetch latest 100 orders for better coverage
      if (remoteOrders && remoteOrders.length > 0) {
        const formattedOrders = remoteOrders.map(o => {
          const total = parseFloat(o.total) || 0;
          const taxAmount = parseFloat(o.total_tax) || 0;
          const discountTotal = parseFloat(o.discount_total) || 0;
          const shippingTotal = parseFloat(o.shipping_total) || 0;
          
          // Extract tip from meta_data
          const tipMeta = o.meta_data?.find(m => m.key === '_yeepos_tip_amount');
          const tip = tipMeta ? parseFloat(tipMeta.value) || 0 : 0;
          
          // Calculate subtotal for display consistency: Total + Discount - Tax - Shipping - Tip
          const subtotal = total + discountTotal - taxAmount - shippingTotal - tip;

          return {
            id: o.id, // Explicit ID maps exactly to WooCommerce ID
            remote_id: o.id,
            items: o.line_items?.map(i => ({ 
              id: i.id, // WC item_id
              product_id: i.product_id,
              name: i.name, 
              quantity: i.quantity, 
              price: parseFloat(i.price) || (i.quantity ? parseFloat(i.total) / i.quantity : 0),
              total: parseFloat(i.total),
              meta_data: i.meta_data
            })) || [],
            total,
            subtotal,
            taxAmount,
            discountTotal,
            shippingTotal,
            tip,
            status: o.status,
            date: new Date(o.date_created),
            syncStatus: 1, // Represents 100% cloud synced
            customerName: `${o.billing?.first_name || ''} ${o.billing?.last_name || ''}`.trim() || t('orders.online_guest'),
            customerEmail: o.billing?.email || '',
            customerPhone: o.billing?.phone || '',
            paymentMethod: o.payment_method_title || o.payment_method || t('orders.online_payment'),
            _raw_meta: o.meta_data // Keep for cashier check
          };
        });

        // Detect truly new orders (missing from local DB) and apply "New" flag
        for (const order of formattedOrders) {
          const existing = await db.orders.get(order.id);
          if (!existing) {
             const isCashierOrder = order._raw_meta?.some(m => m.key === '_yeepos_cashier_id');
             const isNewStatus = order.status === 'processing' || order.status === 'on-hold';
             if (!isCashierOrder && isNewStatus) {
               order._isNewOnline = 1;
             }
          } else {
             // Preserve existing new flag if we are just updating
             order._isNewOnline = existing._isNewOnline;
          }
          delete order._raw_meta; // Cleanup
        }
        
        await db.orders.bulkPut(formattedOrders);
        toast.success(t('orders.cloud_sync_success', { count: formattedOrders.length }));
        loadOrders();
        if (onOrderRead) onOrderRead(); // Refresh sidebar badge
      } else {
        toast.success(t('orders.no_cloud_orders'));
      }
    } catch (error) {
      console.error('[YeePOS] Sync Error:', error);
      toast.error(t('orders.cloud_sync_error'));
    } finally {
      setIsSyncingOnline(false);
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      let allItems;

      // Optimization: Use indexed query when only filtering by status (most common case)
      const hasComplexFilters = searchTerm || filterDate || filterStaff !== 'all';

      if (!hasComplexFilters && filterStatus !== 'all') {
        // Fast path: indexed status query
        allItems = await db.orders.where('status').equals(filterStatus).reverse().sortBy('id');
      } else if (!hasComplexFilters && filterStatus === 'all') {
        // Fast path: no filters, just get recent orders (limit to prevent memory issues)
        allItems = await db.orders.orderBy('id').reverse().limit(2000).toArray();
      } else {
        // Slow path: complex filtering — limit to 2000 most recent orders
        allItems = await db.orders.orderBy('id').reverse().limit(2000).toArray();
      }
      
      const results = allItems.filter(order => {
        const matchesSearch = !searchTerm || 
          order.id.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
          (order.customerName && order.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (order.customerEmail && order.customerEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (order.customerPhone && order.customerPhone.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesStatus = filterStatus === 'all' || (order.status || 'completed') === filterStatus;
        const matchesStaff = filterStaff === 'all' || (order.cashier || order.staffName || 'Admin') === filterStaff;
        
        const orderDateStr = order.date ? new Date(order.date).toLocaleDateString('en-CA') : ''; 
        const matchesDate = !filterDate || orderDateStr === filterDate;
        
        return matchesSearch && matchesStatus && matchesStaff && matchesDate;
      });

      setTotalCount(results.length);
      
      // Paginate the filtered results
      let finalResults = results;
      
      // Inject online search results if they match the current search term
      if (searchTerm && onlineSearchResults.length > 0) {
        const localIds = new Set(results.map(o => o.id));
        const missingFromLocal = onlineSearchResults.filter(o => !localIds.has(o.id));
        finalResults = [...results, ...missingFromLocal];
      }

      const paginatedResults = finalResults.slice((currentPage - 1) * perPage, currentPage * perPage);
      setOrders(paginatedResults);
      
      // Auto-refresh the selected order details panel to reflect sync changes
      setOrders(currentOrders => {
        // We use a functional state update to access the latest selectedOrder safely without adding it to dependencies
        setSelectedOrder(currentSelected => {
          if (!currentSelected) return currentSelected;
          
          // Try to find the latest version in the results
          const latestVersion = [...allItems, ...onlineSearchResults].find(o => o.id === currentSelected.id);
          if (latestVersion) {
             return latestVersion;
          }
          
          return null;
        });
        return paginatedResults;
      });
      
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const baseStatuses = ['pending', 'processing', 'on-hold', 'parked', 'completed', 'cancelled', 'refunded', 'failed'];
  const uniqueStatuses = [...new Set(['all', ...baseStatuses, ...orders.map(o => o.status || 'completed')])];
  const uniqueStaffs = ['all', ...new Set(orders.map(o => o.cashier || o.staffName || 'Admin'))];

  const filteredOrders = orders; // Now handled inside loadOrders with pagination

  return (
    <div className="flex-1 flex flex-row h-full bg-[var(--bg-page)] overflow-hidden relative">
      
      {/* Global Resizing Overlay */}
      {isResizing && (
        <div 
          className="fixed inset-0 z-[200] cursor-col-resize select-none"
          onMouseMove={(e) => {
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth > 300 && newWidth < Math.min(900, window.innerWidth - 300)) {
              setSidebarWidth(newWidth);
            }
          }}
          onMouseUp={() => {
            setIsResizing(false);
            localStorage.setItem('ordersSidebarWidth', sidebarWidth);
          }}
          onMouseLeave={() => {
            setIsResizing(false);
            localStorage.setItem('ordersSidebarWidth', sidebarWidth);
          }}
        />
      )}

      {/* Email Receipt Modal Overlay */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
           <div className="bg-[var(--bg-card)] border border-[var(--border-main)] w-[400px] max-w-full rounded-[24px] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95">
              <header className="p-6 border-b border-[var(--border-main)] flex items-center justify-between bg-[var(--bg-header)]">
                 <h3 className="text-[var(--text-main)] text-lg font-black uppercase tracking-tight">{t('orders.email_receipt')}</h3>
                 <button onClick={() => setShowEmailModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                   <span className="material-icons-outlined">close</span>
                 </button>
              </header>
              
              <div className="p-6 space-y-4">
                 <div className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest ml-1">{t('orders.customer_email')}</div>
                 <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-icons-outlined text-[var(--text-muted)] text-sm">email</span>
                    <input 
                      type="email"
                      placeholder={t('orders.email_placeholder')}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-main)] rounded-xl py-4 pl-12 pr-4 text-[var(--text-main)] text-sm focus:outline-none focus:border-[var(--brand-primary)] transition-all"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      autoFocus
                    />
                 </div>
              </div>
              
              <footer className="p-6 border-t border-[var(--border-main)] bg-[var(--bg-header)] flex gap-3">
                 <button 
                   onClick={() => setShowEmailModal(false)}
                   className="flex-1 bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--text-muted)] py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:text-[var(--text-main)] transition-all"
                 >
                   {t('sale.cancel')}
                 </button>
                 <button
                   onClick={() => handleConfirmSendEmail(emailInput)}
                   disabled={isSendingEmail || !emailInput}
                   className="flex-1 bg-[var(--brand-primary)] hover:bg-[color-mix(in srgb, var(--brand-primary), black 15%)] py-3 rounded-xl text-white font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   <span className={`material-icons-outlined ${isSendingEmail ? 'animate-spin' : ''}`}>{isSendingEmail ? 'sync' : 'send'}</span>
                   {isSendingEmail ? t('orders.sending') : t('orders.send_now')}
                 </button>
              </footer>
           </div>
        </div>
      )}

      {/* Main Content Column (Left) */}
      <div className={`flex-1 flex flex-col min-w-0 h-full border-r border-[var(--border-main)] transition-all duration-300 ${isRefundMode ? 'pointer-events-none opacity-60 grayscale-[0.5]' : ''} ${selectedOrder && window.innerWidth < 1024 ? 'hidden' : 'flex'}`}>
        <header className="px-4 md:px-8 py-4 md:py-6 bg-[var(--bg-header)] border-b border-[var(--border-main)] flex flex-col gap-4 shrink-0">
          <div className="flex items-center justify-between">
             <div>
                <h1 className="text-[var(--text-main)] text-lg md:text-xl font-black uppercase tracking-tight flex items-center gap-1.5">
                   <span className="material-icons-outlined text-[var(--brand-primary)]">history</span>
                   {t('orders.title')}
                </h1>
                <p className="text-[var(--text-muted)] text-[8px] md:text-[10px] font-bold uppercase tracking-widest mt-0.5">{t('orders.subtitle')}</p>
             </div>
             <div className="flex items-center gap-2">
                <button 
                  onClick={handleSyncOnlineOrders}
                  disabled={isSyncingOnline}
                  className="bg-[var(--brand-primary)] hover:bg-[color-mix(in srgb, var(--brand-primary), black 15%)] text-white px-3 md:px-4 py-2 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-[var(--brand-primary)]/20 font-black text-[9px] md:text-[10px] uppercase tracking-widest disabled:opacity-50"
                >
                   <span className={`material-icons-outlined text-sm ${isSyncingOnline ? 'animate-spin' : ''}`}>{isSyncingOnline ? 'sync' : 'cloud_download'}</span>
                   <span className="hidden sm:inline">{isSyncingOnline ? t('orders.syncing') : t('orders.sync_cloud')}</span>
                </button>
             </div>
          </div>

          <div className="flex flex-col gap-3">
             <div className="relative flex-1">
                <span className={`absolute ${isRTL ? 'right-3 md:right-4' : 'left-3 md:left-4'} top-1/2 -translate-y-1/2 material-icons-outlined text-[var(--text-muted)] text-sm`}>search</span>
                <input 
                  type="text" 
                  placeholder={t('orders.search_placeholder')}
                  className={`w-full bg-[var(--bg-input)] border border-[var(--border-main)] rounded-xl py-2.5 ${isRTL ? 'pr-10 md:pr-12 pl-8' : 'pl-10 md:pl-12 pr-8'} text-[var(--text-main)] text-xs focus:outline-none focus:border-[var(--brand-primary)] transition-all`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {isSearchingOnline && (
                  <span className={`absolute ${isRTL ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 material-icons-outlined animate-spin text-[var(--brand-primary)] text-[16px]`}>sync</span>
                )}
             </div>
             <div className="grid grid-cols-2 lg:flex gap-2">
                <input 
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--text-main)] text-[9px] font-black px-3 py-2 rounded-xl focus:outline-none focus:border-[var(--brand-primary)] transition-all cursor-pointer w-full"
                />
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className={`bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--text-main)] text-[9px] font-black px-3 py-2 rounded-xl focus:outline-none focus:border-[var(--brand-primary)] transition-all capitalize appearance-none cursor-pointer w-full ${isRTL ? 'pl-7' : 'pr-7'}`}
                  style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239CA3AF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.4-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: isRTL ? 'left 0.6rem top 50%' : 'right 0.6rem top 50%', backgroundSize: '0.5rem auto' }}
                >
                   {uniqueStatuses.map(status => (
                     <option key={status} value={status}>{status === 'all' ? t('orders.all_status') : status.replace('-', ' ')}</option>
                   ))}
                </select>
             </div>
          </div>
        </header>

        {/* Orders List / Table Container */}
        <div className="flex-1 overflow-y-auto scrollbar-hide p-4 md:p-8 pb-16 md:pb-8 bg-[var(--bg-page)]">
           {/* Desktop Table View */}
           <div className="hidden lg:block bg-[var(--bg-card)] rounded-[2rem] border border-[var(--border-main)] overflow-hidden shadow-xl">
              <table className={`w-full ${isRTL ? 'text-right' : 'text-left'} border-collapse`}>
                <thead>
                  <tr className="border-b border-[var(--border-main)] bg-[var(--bg-header)]">
                    <th className="px-6 py-4 text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em]">{t('orders.col_order')}</th>
                    <th className="px-6 py-4 text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em]">{t('orders.col_date')}</th>
                    <th className="px-6 py-4 text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em]">{t('orders.col_customer')}</th>
                    <th className="px-6 py-4 text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em]">{t('orders.col_total')}</th>
                    <th className="px-6 py-4 text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em]">{t('orders.col_status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-main)]">
                  {loading ? (
                    <tr><td colSpan="5" className="py-20 text-center text-[var(--text-muted)] italic">{t('orders.reading_db')}</td></tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr><td colSpan="5" className="py-20 text-center text-[var(--text-muted)] italic">{t('orders.no_orders')}</td></tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr 
                        key={order.id} 
                        className={`hover:bg-[var(--bg-page)] transition-colors cursor-pointer group ${selectedOrder?.id === order.id ? 'bg-[var(--bg-page)]' : ''} ${order._isNewOnline ? `bg-[var(--brand-primary)]/5 ${isRTL ? 'border-r-4 border-r-[var(--brand-primary)]' : 'border-l-4 border-l-[var(--brand-primary)]'}` : ''}`}
                        onClick={async () => {
                          if (order.status === 'parked' && onResumeOrder) {
                            onResumeOrder(order);
                            return;
                          }
                          setSelectedOrder(order);
                          if (onCacheOrder) onCacheOrder(order);
                          if (order._isNewOnline) {
                            await db.orders.update(order.id, { _isNewOnline: 0 });
                            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, _isNewOnline: 0 } : o));
                            if (onOrderRead) onOrderRead();
                          }
                        }}
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--brand-primary)] font-black">#{order.id}</span>
                            {order._isNewOnline === 1 && (
                              <span className="text-[8px] font-black uppercase tracking-widest bg-[var(--brand-primary)] text-white px-1.5 py-0.5 rounded-full animate-pulse shadow-sm">{t('orders.new_label')}</span>
                            )}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] font-bold uppercase mt-0.5">{order.serviceType || 'online'}</div>
                        </td>
                        <td className="px-6 py-5 text-[var(--text-main)] text-xs font-bold">
                          {new Date(order.date).toLocaleDateString()}
                          <div className="text-[var(--text-muted)] text-[10px] mt-0.5">{new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-[var(--text-main)] font-bold text-sm">{order.customerName || t('customers.guest')}</span>
                          <div className="text-[var(--text-muted)] text-[10px] font-bold uppercase mt-0.5">{order.paymentMethod}</div>
                        </td>
                        <td className="px-6 py-5 text-[var(--text-main)] font-black">{formatPrice(order.total)}</td>
                        <td className="px-6 py-5">
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-tighter shadow-sm border ${
                            (order.status || 'completed') === 'completed' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                            (order.status) === 'processing' ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border-[var(--brand-primary)]/20' :
                            (order.status) === 'pending' || (order.status) === 'on-hold' || (order.status) === 'parked' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                            'bg-gray-500/10 text-[var(--text-muted)] border-[var(--border-main)]'
                          }`}>
                             <span className={`w-1 h-1 rounded-full ${
                               (order.status || 'completed') === 'completed' ? 'bg-green-500' :
                               (order.status) === 'processing' ? 'bg-[var(--brand-primary)]' :
                               (order.status) === 'pending' || (order.status) === 'on-hold' || (order.status) === 'parked' ? 'bg-amber-500 animate-pulse' :
                               'bg-gray-400'
                             }`}></span> {(order.status || 'completed')}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
           </div>

           {/* Mobile Card View */}
           <div className="lg:hidden space-y-4">
              {loading ? (
                <div className="py-20 text-center text-[var(--text-muted)] italic">{t('orders.reading_db')}</div>
              ) : filteredOrders.length === 0 ? (
                <div className="py-20 text-center text-[var(--text-muted)] italic">{t('orders.no_orders')}</div>
              ) : (
                filteredOrders.map((order) => (
                  <div 
                    key={order.id}
                    onClick={async () => {
                       if (order.status === 'parked' && onResumeOrder) {
                         onResumeOrder(order);
                         return;
                       }
                       setSelectedOrder(order);
                       if (onCacheOrder) onCacheOrder(order);
                       if (order._isNewOnline) {
                         await db.orders.update(order.id, { _isNewOnline: 0 });
                         setOrders(prev => prev.map(o => o.id === order.id ? { ...o, _isNewOnline: 0 } : o));
                         if (onOrderRead) onOrderRead();
                       }
                    }}
                    className={`bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-4 shadow-sm active:scale-[0.98] transition-all ${order._isNewOnline ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                       <div className="flex items-center gap-2">
                          <span className="text-[var(--brand-primary)] font-black text-sm">#{order.id}</span>
                          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                             (order.status || 'completed') === 'completed' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                             (order.status) === 'processing' ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border-[var(--brand-primary)]/20' :
                             (order.status) === 'pending' || (order.status) === 'on-hold' || (order.status) === 'parked' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                             'bg-gray-500/10 text-[var(--text-muted)] border-[var(--border-main)]'
                          }`}>
                             {(order.status || 'completed')}
                          </span>
                       </div>
                       <div className="text-[var(--text-main)] font-black">{formatPrice(order.total)}</div>
                    </div>
                    <div className="flex justify-between items-end">
                       <div>
                          <div className="text-[var(--text-main)] font-bold text-xs">{order.customerName || t('customers.guest')}</div>
                          <div className="text-[var(--text-muted)] text-[9px] font-bold uppercase tracking-tight mt-0.5">{order.paymentMethod}</div>
                       </div>
                       <div className="text-right">
                          <div className="text-[var(--text-muted)] text-[9px] font-bold uppercase">{new Date(order.date).toLocaleDateString()}</div>
                          <div className="text-[var(--text-muted)] text-[9px]">{new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                       </div>
                    </div>
                  </div>
                ))
              )}
           </div>
        </div>

        {/* Pagination Footer */}
        <footer className="px-8 py-4 bg-[var(--bg-card)] border-t border-[var(--border-main)] flex items-center justify-between shrink-0">
           <div className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest">
             {t('orders.showing_info', { 
               start: totalCount === 0 ? 0 : (currentPage - 1) * perPage + 1,
               end: Math.min(currentPage * perPage, totalCount),
               total: totalCount
             })}
           </div>
           <div className="flex items-center gap-2">
             <button 
               onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
               disabled={currentPage === 1}
               className="bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--text-main)] p-2 rounded-lg hover:bg-[var(--border-main)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
             >
               <span className="material-icons-outlined text-sm">{isRTL ? 'arrow_forward_ios' : 'arrow_back_ios'}</span>
             </button>
             <div className="px-4 py-2 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-xl text-[var(--text-main)] text-[10px] font-black uppercase tracking-widest min-w-[100px] text-center">
               {t('orders.page_info', { current: currentPage, total: Math.max(1, Math.ceil(totalCount / perPage)) })}
             </div>
             <button 
               onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / perPage), prev + 1))}
               disabled={currentPage >= Math.ceil(totalCount / perPage) || totalCount === 0}
               className="bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--text-main)] p-2 rounded-lg hover:bg-[var(--border-main)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
             >
               <span className="material-icons-outlined text-sm">{isRTL ? 'arrow_back_ios' : 'arrow_forward_ios'}</span>
             </button>
           </div>
        </footer>
      </div>

      {/* Resizer Handle */}
      <div 
        className={`w-4 cursor-col-resize shrink-0 z-10 flex items-center justify-center group bg-transparent hover:bg-[var(--brand-primary)]/5 transition-colors hidden lg:flex`}
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
      >
        <div className="h-8 w-0.5 rounded-full bg-[var(--border-main)] group-hover:bg-[var(--brand-primary)] flex flex-col items-center justify-center gap-0.5 transition-colors">
          <div className="w-[1.5px] h-[1.5px] rounded-full bg-current opacity-40" />
          <div className="w-[1.5px] h-[1.5px] rounded-full bg-current opacity-40" />
          <div className="w-[1.5px] h-[1.5px] rounded-full bg-current opacity-40" />
        </div>
      </div>

      {/* Order Detail Sidebar */}
      <aside 
        style={{ width: window.innerWidth < 1024 ? '100%' : `${sidebarWidth}px` }} 
        className={`
          bg-[var(--bg-sidebar)] flex flex-col h-full shrink-0 ${isRTL ? 'border-l' : 'border-r'} border-[var(--border-main)]
          ${selectedOrder && window.innerWidth < 1024 ? 'fixed inset-0 z-[120]' : 'hidden lg:flex'}
        `}
      >
           <header className="p-6 border-b border-[var(--border-main)] flex items-center justify-between bg-[var(--bg-header)]">
              <h2 className="text-[var(--text-main)] font-black uppercase tracking-tight">
                 {isRefundMode ? t('orders.refund_title') : t('orders.detail_title')}
              </h2>
              {selectedOrder && (
                 <div className="flex items-center gap-2">
                    {selectedOrder && !isRefundMode && selectedOrder.syncStatus === 1 && (
                      <a 
                        href={`/wp-admin/post.php?post=${selectedOrder.id}&action=edit`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--brand-primary)] bg-[var(--bg-input)] rounded-full transition-colors border border-[var(--border-main)]"
                      >
                        <span className="material-icons-outlined text-sm">open_in_new</span>
                      </a>
                    )}
                    <button 
                      onClick={() => isRefundMode ? setIsRefundMode(false) : setSelectedOrder(null)}
                      className="w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-input)] rounded-full transition-colors border border-[var(--border-main)]"
                    >
                      <span className="material-icons-outlined text-sm">{isRefundMode ? (isRTL ? 'arrow_forward' : 'arrow_back') : 'close'}</span>
                    </button>
                 </div>
              )}
           </header>

           {selectedOrder ? (
              <div className="flex flex-col flex-1 min-h-0">
                 {isRefundMode ? (
                    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-sidebar)]">
                       <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                          <div className="flex items-center justify-between ml-1">
                             <div className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest">{t('orders.select_refund_items')}</div>
                             <div 
                                onClick={() => handleToggleSelectAll(!refundItems.every(i => i.checked))}
                                className="flex items-center gap-2 cursor-pointer group"
                             >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${refundItems.every(i => i.checked) ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)]' : 'border-[var(--border-main)] group-hover:border-[var(--text-main)]'}`}>
                                   {refundItems.every(i => i.checked) && <span className="material-icons-outlined text-white text-[10px]">check</span>}
                                </div>
                                <span className="text-[10px] text-[var(--text-muted)] group-hover:text-[var(--text-main)] font-black uppercase tracking-widest transition-colors">{t('orders.select_all')}</span>
                             </div>
                          </div>
                          <div className="space-y-3">
                             {refundItems.map((item, idx) => (
                                <div 
                                  key={idx} 
                                  className={`group flex items-center gap-4 bg-[var(--bg-input)] p-4 rounded-2xl border transition-all ${item.checked ? 'border-[var(--brand-primary)]' : 'border-[var(--border-main)] opacity-50'}`}
                                >
                                   <div 
                                     onClick={() => {
                                        const newItems = [...refundItems];
                                        newItems[idx].checked = !newItems[idx].checked;
                                        setRefundItems(newItems);
                                     }}
                                     className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all ${item.checked ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)]' : 'border-[var(--border-main)] group-hover:border-[var(--text-muted)]'}`}
                                   >
                                      {item.checked && <span className="material-icons-outlined text-white text-sm">check</span>}
                                   </div>
                                   <div className="flex-1 min-w-0">
                                      <div className="text-[var(--text-main)] text-sm font-bold truncate">{item.name}</div>
                                      <div className="text-[var(--brand-primary)] text-xs font-black mt-1">{formatPrice(item.price)}</div>
                                   </div>
                                   {item.checked && (
                                      <div className="flex items-center bg-[var(--bg-page)] rounded-xl overflow-hidden border border-[var(--border-main)]">
                                         <button 
                                           onClick={() => {
                                              const newItems = [...refundItems];
                                              if(newItems[idx].refundQty > 0) newItems[idx].refundQty--;
                                              setRefundItems(newItems);
                                           }}
                                           className="w-8 h-8 flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--border-main)] transition-colors"
                                         ><span className="material-icons-outlined text-sm">remove</span></button>
                                         <div className="w-8 h-8 flex items-center justify-center text-[var(--text-main)] font-black text-xs">{item.refundQty}</div>
                                         <button 
                                           onClick={() => {
                                              const newItems = [...refundItems];
                                              if(newItems[idx].refundQty < item.maxQty) newItems[idx].refundQty++;
                                              setRefundItems(newItems);
                                           }}
                                           className="w-8 h-8 flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--border-main)] transition-colors"
                                         ><span className="material-icons-outlined text-sm">add</span></button>
                                      </div>
                                   )}
                                </div>
                             ))}
                          </div>
                          
                          <div className="p-4 bg-[var(--bg-input)] rounded-xl border border-[var(--border-main)] flex items-center gap-3">
                             <input 
                               type="checkbox" 
                               id="restock-sidebar"
                               checked={refundRestock}
                               onChange={(e) => setRefundRestock(e.target.checked)}
                               className="w-5 h-5 rounded border-[var(--border-main)] bg-[var(--bg-input)] accent-[var(--brand-primary)] cursor-pointer"
                             />
                             <label htmlFor="restock-sidebar" className="text-[var(--text-main)] text-[10px] font-black uppercase tracking-widest cursor-pointer select-none">
                                {t('orders.restock_items')}
                             </label>
                          </div>
                       </div>
                       <footer className="shrink-0 p-6 bg-[var(--bg-sidebar)] border-t border-[var(--border-main)]">
                          <div className="flex justify-between items-center mb-6">
                             <div>
                                <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">{t('orders.total_refund_label')}</div>
                                <div className="text-amber-500 font-black text-2xl">
                                   {formatPrice(calculateCurrentRefundTotal())}
                                </div>
                             </div>
                             <button 
                               onClick={() => setIsRefundMode(false)}
                               className="text-[var(--text-muted)] hover:text-[var(--text-main)] font-black uppercase tracking-widest text-[10px]"
                             >
                                {t('sale.cancel')}
                             </button>
                          </div>
                          <button
                            onClick={submitRefund}
                            disabled={isUpdatingStatus || calculateCurrentRefundTotal() <= 0}
                            className="w-full bg-amber-500 hover:bg-amber-600 py-4 rounded-xl text-white font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                             <span className="material-icons-outlined">{isUpdatingStatus ? 'sync' : 'currency_exchange'}</span>
                             {isUpdatingStatus ? t('orders.processing_refund') : t('orders.confirm_refund')}
                          </button>
                       </footer>
                    </div>
                 ) : (
                    <>
                       <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide bg-[var(--bg-sidebar)]">
                          <div className="flex flex-col items-center text-center">
                             <div className="w-20 h-20 rounded-[2.5rem] bg-[var(--brand-primary)]/10 flex items-center justify-center mb-4 border border-[var(--brand-primary)]/20 shadow-inner">
                                <span className="material-icons-outlined text-[var(--brand-primary)] text-3xl">receipt</span>
                             </div>
                             <h3 className="text-[var(--text-main)] text-xl font-black tracking-tight mb-1">#{selectedOrder.id}</h3>
                             <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest">{new Date(selectedOrder.date).toLocaleString()}</p>
                          </div>
                          <div className="space-y-6">
                             <div className="grid grid-cols-2 gap-4">
                                <div className="bg-[var(--bg-input)] p-4 rounded-3xl border border-[var(--border-main)]">
                                   <div className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest mb-1">{t('orders.col_customer')}</div>
                                   <div className="text-[var(--text-main)] font-bold text-sm truncate">{selectedOrder.customerName || t('customers.guest')}</div>
                                </div>
                                <div className="bg-[var(--bg-input)] p-4 rounded-3xl border border-[var(--border-main)]">
                                   <div className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest mb-1">{t('orders.col_payment')}</div>
                                   <div className="text-[var(--text-main)] font-bold text-sm truncate">{selectedOrder.paymentMethod}</div>
                                </div>
                             </div>
                             <div>
                                <h4 className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-[0.2em] mb-4 ml-1">{t('orders.order_items')}</h4>
                                <div className="bg-[var(--bg-card)] rounded-[2rem] border border-[var(--border-main)] overflow-hidden">
                                   {selectedOrder.items.map((item, idx) => (
                                      <div key={idx} className="p-4 flex items-center gap-4 border-b border-[var(--border-main)] last:border-0 hover:bg-[var(--bg-input)] transition-colors">
                                         <div className="w-10 h-10 rounded-xl bg-[var(--bg-page)] border border-[var(--border-main)] flex items-center justify-center text-[var(--text-main)] font-black text-xs shrink-0">
                                            {item.quantity}x
                                         </div>
                                         <div className="flex-1 min-w-0">
                                            <p className="text-[var(--text-main)] font-bold text-xs truncate mb-0.5">{item.name}</p>
                                            <p className="text-[var(--brand-primary)] text-[10px] font-black">{formatPrice(item.price)}</p>
                                         </div>
                                         <div className="text-[var(--text-main)] font-black text-xs">
                                            {formatPrice(item.total)}
                                         </div>
                                      </div>
                                   ))}
                                </div>
                             </div>
                             <div className="bg-[var(--bg-input)] p-6 rounded-[2rem] border border-[var(--border-main)] space-y-3">
                                <div className="flex justify-between text-xs">
                                   <span className="text-[var(--text-muted)] font-bold uppercase tracking-widest">{t('cart.subtotal')}</span>
                                   <span className="text-[var(--text-main)] font-black">{formatPrice(selectedOrder.total)}</span>
                                </div>
                                <div className="flex justify-between text-base pt-3 border-t border-[var(--border-main)]">
                                   <span className="text-[var(--text-main)] font-black uppercase tracking-tight">{t('cart.total')}</span>
                                   <span className="text-[var(--brand-primary)] font-black text-lg">{formatPrice(selectedOrder.total)}</span>
                                </div>
                             </div>
                          </div>
                       </div>
                       <footer className="p-6 border-t border-[var(--border-main)] bg-[var(--bg-card)] shrink-0">
                          <div className="grid grid-cols-2 gap-3 mb-3">
                             <button 
                               onClick={() => printReceipt(selectedOrder, shopSettings, t, formatPrice)}
                               className="bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--text-main)] py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-[var(--border-main)] transition-all flex flex-col items-center justify-center gap-1"
                             >
                               <span className="material-icons-outlined text-sm">print</span>
                               <span>{t('orders.print_btn')}</span>
                             </button>
                             <button 
                               onClick={handleSendEmail}
                               className="bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--text-main)] py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-[var(--border-main)] transition-all flex flex-col items-center justify-center gap-1"
                             >
                               <span className="material-icons-outlined text-sm">email</span>
                               <span>{t('orders.email_btn')}</span>
                             </button>
                             <button 
                               onClick={() => handleUpdateStatus('cancelled')}
                               disabled={isUpdatingStatus || selectedOrder.status === 'cancelled' || selectedOrder.status === 'refunded'}
                               className="bg-[var(--bg-input)] border border-[var(--border-main)] text-red-500 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-500/10 transition-all flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                             >
                               <span className="material-icons-outlined text-sm">cancel</span>
                               <span>{t('sale.cancel')}</span>
                             </button>
                             {(selectedOrder.status === 'on-hold' || selectedOrder.status === 'parked' || selectedOrder.status === 'pending') ? (
                               <button 
                                 onClick={() => onResumeOrder && onResumeOrder(selectedOrder)}
                                 className="bg-[var(--brand-primary)] text-white py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-[color-mix(in srgb, var(--brand-primary), black 15%)] transition-all flex flex-col items-center justify-center gap-1 shadow-lg shadow-[var(--brand-primary)]/20"
                               >
                                 <span className="material-icons-outlined text-sm">payments</span>
                                 <span>{t('orders.payment_btn')}</span>
                               </button>
                             ) : selectedOrder.status === 'processing' ? (
                               <button 
                                 onClick={() => handleUpdateStatus('completed')}
                                 disabled={isUpdatingStatus}
                                 className="bg-green-600 text-white py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-700 transition-all flex flex-col items-center justify-center gap-1 shadow-lg shadow-green-600/20 disabled:opacity-50"
                               >
                                 <span className="material-icons-outlined text-sm">check_circle</span>
                                 <span>{t('orders.complete_btn')}</span>
                               </button>
                             ) : (
                               <button 
                                 onClick={switchToRefundMode}
                                 disabled={isUpdatingStatus || selectedOrder.status === 'refunded' || selectedOrder.status === 'cancelled'}
                                 className="bg-[var(--bg-input)] border border-[var(--border-main)] text-amber-500 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-amber-500/10 transition-all flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                               >
                                 <span className="material-icons-outlined text-sm">currency_exchange</span>
                                 <span>{t('orders.refund_btn')}</span>
                               </button>
                             )}
                          </div>
                       </footer>
                    </>
                 )}
              </div>
           ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[var(--bg-sidebar)]">
                 <div className="w-20 h-20 bg-[var(--bg-input)] rounded-[2rem] flex items-center justify-center mb-4 text-[var(--text-muted)] border border-[var(--border-main)] shadow-inner">
                    <span className="material-icons-outlined text-4xl">receipt_long</span>
                 </div>
                 <h3 className="text-[var(--text-main)] font-bold mb-2">{t('orders.no_order_selected')}</h3>
                 <p className="text-[var(--text-muted)] text-xs leading-relaxed">{t('orders.no_order_selected_desc')}</p>
              </div>
           )}
        </aside>
    </div>
  );
}
