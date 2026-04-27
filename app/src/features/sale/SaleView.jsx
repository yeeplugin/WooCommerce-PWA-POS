import React, { useState, useRef, useEffect, useMemo } from 'react';
import { CartItemDetail } from './CartItemDetail';
import { ParkedOrdersModal } from './ParkedOrdersModal';
import { VariationSelectorModal } from './VariationSelectorModal';
import { CheckoutOverlay } from './CheckoutOverlay';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { useTranslation } from '../../utils/i18n';
import { searchProductsOnline } from '../../api/woocommerce';
import { db } from '../../db/indexedDB';
import { toast } from '../../utils/toast';

export function SaleView({ 
  products, 
  loading, 
  addToCart, 
  formatPrice, 
  cart, 
  removeFromCart, 
  updateQuantity, 
  updatePrice, 
  updateItemDetails, 
  getCartTotal, 
  clearCart, 
  handleCheckout, 
  handleSaveOrder, 
  handleResumeOrder, 
  handleDeleteOrder,
  handleSync,
  categories,
  taxConfig,
  posSettings,
  customers,
  paymentGateways,
  lastCreatedOrder,
  setLastCreatedOrder,
  resumingOrderId,
  originalOrderMetadata,
  shopSettings,
  parkedOrdersCount,
  tables,
  cfd,
  onCacheProduct,
  onNavigate,
  initialCheckoutOpen,
  setInitialCheckoutOpen,
  couponsEnabled
}) {
  const { t, isRTL } = useTranslation();
  const isFoodEnabled = window.yeePOSData?.activeModules?.food || false;
  // Price editing state
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editingPriceValue, setEditingPriceValue] = useState('');
  const priceInputRef = useRef(null);
  // Overlay states
  const [selectedItemForDetail, setSelectedItemForDetail] = useState(null);
  const [isDetailModeAddingNew, setIsDetailModeAddingNew] = useState(false);
  const [isParkedOrdersModalOpen, setIsParkedOrdersModalOpen] = useState(false);
  const [selectedProductForVariations, setSelectedProductForVariations] = useState(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  // Resize State
  const [sidebarWidth, setSidebarWidth] = useState(() => parseInt(localStorage.getItem('saleSidebarWidth')) || Math.floor(window.innerWidth * 0.6));
  const [isResizing, setIsResizing] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isHeaderMoreMenuOpen, setIsHeaderMoreMenuOpen] = useState(false);
  const [isCartOpenMobile, setIsCartOpenMobile] = useState(false);
  // Handheld Scanner Logic
  const scannerBuffer = useRef('');
  const lastKeyTime = useRef(0);
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Ignore if focus is in an input field (to allow manual SKU entry)
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
      const currentTime = Date.now();
      // If time between keys is too long, reset buffer (it might be human typing)
      if (currentTime - lastKeyTime.current > 50) {
        scannerBuffer.current = '';
      }
      // If Enter is pressed, process the buffer
      if (e.key === 'Enter') {
        if (scannerBuffer.current.length > 2) {
          const sku = scannerBuffer.current;
          const product = products.find(p => p.sku === sku);
          if (product) {
            playBeep();
            handleProductClick(product);
          }
          scannerBuffer.current = '';
        }
        return;
      }
      // Append character to buffer (only Alphanumeric for barcode generally)
      if (e.key.length === 1) {
        scannerBuffer.current += e.key;
        lastKeyTime.current = currentTime;
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [products]);
  const handleBarcodeScan = async (code) => {
    let product = products.find(p => p.sku === code);
    
    // Fallback: search online if not found locally
    if (!product && navigator.onLine) {
      try {
        const onlineResults = await searchProductsOnline(code);
        product = onlineResults.find(p => p.sku === code);
        if (product) {
          // Cache into IndexedDB for future use
          await db.products.put(product);
        }
      } catch (err) {
        console.error('[YeePOS] Online barcode search failed:', err);
      }
    }
    
    if (product) {
      playBeep();
      handleProductClick(product);
    } else {
      // If no product found by SKU, put the code into search box
      playBeep();
      setSearchQuery(code);
    }
  };

  // Listen for global barcode scan events
  useEffect(() => {
    const handleGlobalScan = (e) => {
      if (e.detail) handleBarcodeScan(e.detail);
    };
    window.addEventListener('yeepos_barcode_scan', handleGlobalScan);
    return () => window.removeEventListener('yeepos_barcode_scan', handleGlobalScan);
  }, [products, handleBarcodeScan]);

  // Sorting and Filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Category');
  const [listMode, setListMode] = useState(() => localStorage.getItem('pos_listMode') || 'list');
  const [sortOrder, setSortOrder] = useState(() => localStorage.getItem('pos_sortOrder') || 'name_asc');
  const [filterStock, setFilterStock] = useState(() => localStorage.getItem('pos_filterStock') || 'all');
  const [pinnedProductIds, setPinnedProductIds] = useState(() => {
    const saved = localStorage.getItem('pos_pinned_products');
    return saved ? JSON.parse(saved) : [];
  });
  // Persist settings
  useEffect(() => {
    localStorage.setItem('pos_listMode', listMode);
    localStorage.setItem('pos_sortOrder', sortOrder);
    localStorage.setItem('pos_filterStock', filterStock);
    localStorage.setItem('pos_pinned_products', JSON.stringify(pinnedProductIds));
  }, [listMode, sortOrder, filterStock, pinnedProductIds]);

  // Audio Feedback Logic
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
      console.warn('Audio feedback failed:', e);
    }
  };

  // === Cache-on-Demand: Hybrid Search State ===
  const [onlineSearchResults, setOnlineSearchResults] = useState([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Debounced online search: fires 300ms after user stops typing
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    // Only search online if query is 2+ chars and we're online
    if (!searchQuery || searchQuery.length < 2 || !navigator.onLine) {
      setOnlineSearchResults([]);
      setIsSearchingOnline(false);
      return;
    }

    setIsSearchingOnline(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchProductsOnline(searchQuery);
        // Only keep products NOT already in local cache
        const localIds = new Set(products.map(p => p.id));
        const newProducts = results.filter(p => !localIds.has(p.id));
        setOnlineSearchResults(newProducts);
      } catch (err) {
        console.error('[YeePOS] Online search failed:', err);
      } finally {
        setIsSearchingOnline(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, products]);

  // Advanced Filtering Logic
  const filteredAndSortedProducts = useMemo(() => {
    let result = [...products];

    // Merge online search results (avoid duplicates)
    if (searchQuery && onlineSearchResults.length > 0) {
      const existingIds = new Set(result.map(p => p.id));
      const newFromOnline = onlineSearchResults.filter(p => !existingIds.has(p.id));
      result = [...result, ...newFromOnline];
    }

    // Search filter
    if (searchQuery) {
       result = result.filter(p => 
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
          p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
       );
    }
    // Category filter
    if (selectedCategory && selectedCategory !== 'Category') {
       result = result.filter(p => p.categories?.some(c => c.id.toString() === selectedCategory));
    }
    // Stock filter
    if (filterStock === 'instock') {
       result = result.filter(p => !p.manage_stock || p.stock > 0);
    } else if (filterStock === 'outofstock') {
       result = result.filter(p => p.manage_stock && p.stock <= 0);
    }
    // Sort logic
    result.sort((a, b) => {
      const aPinned = pinnedProductIds.includes(a.id);
      const bPinned = pinnedProductIds.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      if (sortOrder === 'name_asc') return a.name.localeCompare(b.name);
      if (sortOrder === 'name_desc') return b.name.localeCompare(a.name);
      if (sortOrder === 'price_asc') return a.price - b.price;
      if (sortOrder === 'price_desc') return b.price - a.price;
      return 0;
    });
    return result;
  }, [products, onlineSearchResults, searchQuery, selectedCategory, sortOrder, filterStock, pinnedProductIds]);

  const [displayLimit, setDisplayLimit] = useState(40);
  const observerTarget = useRef(null);

  // Reset infinite scroll when filters change
  useEffect(() => {
    setDisplayLimit(40);
  }, [searchQuery, selectedCategory, sortOrder, filterStock]);

  // Infinite Scroll Logic
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && displayLimit < filteredAndSortedProducts.length) {
          setDisplayLimit(prev => prev + 40);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [displayLimit, filteredAndSortedProducts.length]);

  // Advanced Tax Calculation Logic
  const rawTotal = getCartTotal();
  let subtotal = rawTotal;
  let taxAmount = 0;
  let total = rawTotal;
  if (taxConfig.enabled) {
    if (taxConfig.pricesIncludeTax) {
      // Inclusive: Tax is already inside the price
      total = rawTotal;
      taxAmount = total - (total / (1 + taxConfig.rate / 100));
      subtotal = total - taxAmount;
    } else {
      // Exclusive: Tax is added on top
      subtotal = rawTotal;
      taxAmount = subtotal * (taxConfig.rate / 100);
      total = subtotal + taxAmount;
    }
  }
  const handleAddToCartWithAddons = (product) => {
    if (product._yeepos_addons && product._yeepos_addons.length > 0) {
      // Don't add to cart yet, open modal first
      setSelectedItemForDetail(product);
      setIsDetailModeAddingNew(true);
    } else {
      addToCart(product);
    }
  };
  const handleProductClick = (product) => {
    // If success screen is showing, any product click should clear it and start fresh
    if (lastCreatedOrder) {
      setLastCreatedOrder(null);
      setIsCheckoutOpen(false);
    } else if (isCheckoutOpen) {
      return;
    }

    // Cache the product for offline use
    if (onCacheProduct) {
      onCacheProduct(product);
    }
    // Robust check for variable products
    const isVariable = product.type === 'variable' || (product.variations && product.variations.length > 0);
    if (isVariable) {
      setSelectedProductForVariations(product);
    } else {
      handleAddToCartWithAddons(product);
    }
  };
  useEffect(() => {
    if (editingPriceId && priceInputRef.current) {
      priceInputRef.current.focus();
      priceInputRef.current.select();
    }
  }, [editingPriceId]);
  const handlePriceClick = (item) => {
    setEditingPriceId(item.cartItemId);
    setEditingPriceValue(item.price.toString());
  };
  const onCheckoutClose = () => {
    setIsCheckoutOpen(false);
    setLastCreatedOrder(null);
    setIsCartOpenMobile(false); // Mobile: new order, show product page
  };
  useEffect(() => {
    if (initialCheckoutOpen) {
      setIsCheckoutOpen(true);
      setInitialCheckoutOpen(false); // Reset so it doesn't open again on re-render
    }
  }, [initialCheckoutOpen]);
  const onSyncClick = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await handleSync();
    } catch (err) {
      console.error('Sync failed', err);
    } finally {
      setIsSyncing(false);
    }
  };
  const togglePin = (productId, e) => {
    e.stopPropagation();
    setPinnedProductIds(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };
  const handlePriceConfirm = (itemId) => {
    updatePrice(itemId, editingPriceValue);
    setEditingPriceId(null);
    setEditingPriceValue('');
  };
  const handlePriceKeyDown = (e, itemId) => {
    if (e.key === 'Enter') handlePriceConfirm(itemId);
    if (e.key === 'Escape') {
      setEditingPriceId(null);
      setEditingPriceValue('');
    }
  };
  return (
    <div className="flex-1 block md:flex md:flex-row h-full overflow-hidden relative">
      {/* Global Resizing Overlay */}
      {isResizing && (
        <div 
          className="fixed inset-0 z-[200] cursor-col-resize select-none"
          onMouseMove={(e) => {
            const newWidth = window.innerWidth - e.clientX;
            // constraints: min 300px, max roughly 70%
            if (newWidth > 300 && newWidth < Math.min(900, window.innerWidth - 300)) {
              setSidebarWidth(newWidth);
            }
          }}
          onMouseUp={() => {
            setIsResizing(false);
            localStorage.setItem('saleSidebarWidth', sidebarWidth);
          }}
          onMouseLeave={() => {
            setIsResizing(false);
            localStorage.setItem('saleSidebarWidth', sidebarWidth);
          }}
        />
      )}
      <main className={`flex-1 flex flex-col min-w-0 h-full bg-[var(--bg-page)] relative ${isResizing ? '' : 'transition-all duration-300'} ${isCheckoutOpen || selectedProductForVariations || isBarcodeModalOpen ? 'opacity-30 blur-[4px] pointer-events-none' : ''}`}>
        <header className="h-16 border-b border-[var(--border-main)] flex items-center px-3 md:px-4 gap-2 md:gap-4 bg-[var(--bg-header)] shrink-0 relative">
          {/* Search Container - Expanded on Mobile */}
          <div className="relative flex-[3] md:flex-1">
            <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px] md:text-[20px]">search</span>
            <input 
              type="text" 
              placeholder={t('sale.search_placeholder')} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--bg-input)] text-xs md:text-sm text-[var(--text-main)] rounded-xl px-9 md:px-10 py-2.5 md:py-2.5 outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/50 border border-[var(--border-main)] placeholder-[var(--text-muted)] transition-all font-medium"
            />
            {/* Online search indicator */}
            {isSearchingOnline && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 material-icons-outlined animate-spin text-[var(--brand-primary)] text-[14px] md:text-[16px]">sync</span>
            )}
          </div>

          {/* Desktop Buttons Container */}
          <div className="hidden md:flex flex-1 justify-end items-center gap-3">
              <button 
                onClick={() => setIsParkedOrdersModalOpen(true)}
                className="p-2 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 rounded-lg flex items-center gap-2 px-3 transition-all relative" 
                title={t('sale.saved_orders')}
              >
                 <span className="material-icons-outlined">inventory_2</span>
                 <span className="text-xs font-bold uppercase tracking-wider">{t('sale.saved')}</span>
                 {parkedOrdersCount > 0 && (
                   <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-[#141419] shadow-[0_0_10px_rgba(239,68,68,0.5)] z-30 animate-in zoom-in duration-200">
                     {parkedOrdersCount}
                   </span>
                 )}
              </button>
               <button 
                onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)} 
                className={`flex items-center justify-center p-2 h-full transition-all border-l border-r border-[var(--border-main)] px-5 ${isFilterPanelOpen ? 'bg-[var(--brand-primary)] text-white shadow-[inset_0_0_10px_rgba(0,0,0,0.2)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                title={t('sale.settings_filters')}
              >
                <span className="material-icons-outlined">tune</span>
              </button>
              <button 
                 onClick={() => setIsBarcodeModalOpen(true)}
                 className="w-12 h-12 flex items-center justify-center bg-[var(--bg-input)] hover:bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] rounded-xl transition-all border border-[var(--border-main)] shadow-lg group hover:border-[var(--brand-primary)]/50"
                 title={t('sale.barcode_scanner')}
              >
                <svg className="w-6 h-6 fill-current transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                  <path d="M2 5h2v14H2V5zm4 0h1v14H6V5zm3 0h3v14H9V5zm4 0h1v14h-1V5zm3 0h2v14h-2V5zm3 0h1v14h-1V5zM4 5h1v14H4V5zm10 0h2v14h-2V5z"/>
                </svg>
              </button>
              <button 
                onClick={onSyncClick}
                disabled={isSyncing}
                className="w-12 h-12 flex items-center justify-center bg-[var(--bg-input)] hover:bg-[var(--bg-page)] text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-xl transition-all border border-[var(--border-main)] shadow-lg group disabled:opacity-50"
                title={t('sale.sync_products')}
              >
                <span className={`material-icons-outlined text-[20px] transition-transform ${isSyncing ? 'animate-spin text-[var(--brand-primary)]' : 'group-hover:rotate-180'} duration-500`}>sync</span>
              </button>
          </div>

          {/* Mobile "More" Menu Button */}
          <div className="md:hidden relative">
            <button 
              onClick={() => setIsHeaderMoreMenuOpen(!isHeaderMoreMenuOpen)}
              className={`w-10 h-10 flex items-center justify-center rounded-xl border border-[var(--border-main)] transition-all ${isHeaderMoreMenuOpen ? 'bg-[var(--brand-primary)] text-white shadow-lg shadow-[var(--brand-primary)]/20 border-[var(--brand-primary)]' : 'bg-[var(--bg-card)] text-[var(--text-muted)]'}`}
            >
              <span className="material-icons-outlined">{isHeaderMoreMenuOpen ? 'close' : 'more_vert'}</span>
              {parkedOrdersCount > 0 && !isHeaderMoreMenuOpen && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full border border-[#141419] z-10">
                  {parkedOrdersCount}
                </span>
              )}
            </button>

            {/* Mobile Dropdown Menu */}
            {isHeaderMoreMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40 bg-black/10" 
                  onClick={() => setIsHeaderMoreMenuOpen(false)}
                />
                <div className="absolute top-12 right-0 w-[200px] bg-[var(--bg-header)] border border-[var(--border-main)] rounded-2xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                  <div className="p-2 space-y-1">
                    <button 
                      onClick={() => {
                        setIsHeaderMoreMenuOpen(false);
                        setIsParkedOrdersModalOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] transition-all relative"
                    >
                      <span className="material-icons-outlined">inventory_2</span>
                      <span className="text-xs font-bold uppercase tracking-wider">{t('sale.saved')}</span>
                      {parkedOrdersCount > 0 && (
                        <span className="ms-auto bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                          {parkedOrdersCount}
                        </span>
                      )}
                    </button>
                    
                    <button 
                      onClick={() => {
                        setIsHeaderMoreMenuOpen(false);
                        setIsFilterPanelOpen(!isFilterPanelOpen);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isFilterPanelOpen ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-input)]'}`}
                    >
                      <span className="material-icons-outlined">tune</span>
                      <span className="text-xs font-bold uppercase tracking-wider">{t('sale.settings_filters')}</span>
                    </button>

                    <button 
                      onClick={() => {
                        setIsHeaderMoreMenuOpen(false);
                        setIsBarcodeModalOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 transition-all"
                    >
                      <span className="material-icons-outlined">qr_code_scanner</span>
                      <span className="text-xs font-bold uppercase tracking-wider">{t('sale.barcode_scanner')}</span>
                    </button>

                    <button 
                      onClick={() => {
                        setIsHeaderMoreMenuOpen(false);
                        onSyncClick();
                      }}
                      disabled={isSyncing}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-all disabled:opacity-50"
                    >
                      <span className={`material-icons-outlined ${isSyncing ? 'animate-spin text-[var(--brand-primary)]' : ''}`}>sync</span>
                      <span className="text-xs font-bold uppercase tracking-wider">{t('sale.sync_products')}</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Categories List Horizontal */}
        <div className="h-12 border-b border-[var(--border-main)] bg-[var(--bg-card)] flex items-center px-2 gap-1 overflow-x-auto no-scrollbar shrink-0 shadow-sm">
          <button 
            onClick={() => setSelectedCategory('Category')}
            className={`px-5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${selectedCategory === 'Category' ? 'bg-[var(--brand-primary)] text-white shadow-lg' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-input)]'}`}
          >
            {t('sale.category_all')}
          </button>
          {categories?.map(cat => (
            <button 
              key={cat.id}
              onClick={() => setSelectedCategory(String(cat.id))}
              className={`px-5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${String(selectedCategory) === String(cat.id) ? 'bg-[var(--brand-primary)] text-white shadow-lg' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-input)]'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
        {/* Settings & Filter Panel (Glassmorphism) */}
        {isFilterPanelOpen && (
           <div className="bg-[var(--bg-card)]/95 backdrop-blur-xl border-b border-[var(--border-main)] px-8 py-10 animate-in slide-in-from-top-4 duration-300 z-30">
              <div className="w-full space-y-8">
                 {/* List Mode */}
                 <div className="flex items-center justify-between gap-8 border-b border-[var(--border-main)]/30 pb-4">
                    <label className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-[0.2em] shrink-0">{t('sale.grid')}/{t('sale.list')}</label>
                    <div className="flex bg-[var(--bg-page)] p-1 rounded-xl border border-[var(--border-main)] w-fit">
                       <button 
                         onClick={() => setListMode('grid')}
                         className={`px-6 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${listMode === 'grid' ? 'bg-[var(--brand-primary)] text-white shadow-lg' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                       >
                          <span className="material-icons-outlined text-sm">grid_view</span>
                          {t('sale.grid')}
                       </button>
                       <button 
                         onClick={() => setListMode('list')}
                         className={`px-6 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${listMode === 'list' ? 'bg-[var(--brand-primary)] text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                       >
                          <span className="material-icons-outlined text-sm">view_list</span>
                          {t('sale.list')}
                       </button>
                    </div>
                 </div>
                 {/* Display/Filter */}
                 <div className="flex items-center justify-between gap-8 border-b border-[var(--border-main)]/30 pb-4">
                    <label className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-[0.2em] shrink-0">{t('sale.stock')}</label>
                    <select 
                      value={filterStock}
                      onChange={(e) => setFilterStock(e.target.value)}
                      className="w-64 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-xl px-4 py-3 text-xs text-[var(--text-main)] font-bold outline-none focus:border-[var(--brand-primary)] transition-all appearance-none text-right cursor-pointer"
                    >
                       <option value="all">{t('sale.category_all')}</option>
                       <option value="instock">{t('sale.stock')} (In)</option>
                       <option value="outofstock">{t('sale.out_of_stock')}</option>
                    </select>
                 </div>
                 {/* Sort Order */}
                 <div className="flex items-center justify-between gap-8 border-b border-[var(--border-main)]/30 pb-4">
                    <label className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-[0.2em] shrink-0">{t('sale.sort_by')}</label>
                    <select 
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value)}
                      className="w-64 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-xl px-4 py-3 text-xs text-[var(--text-main)] font-bold outline-none focus:border-[var(--brand-primary)] transition-all appearance-none text-right cursor-pointer"
                    >
                       <option value="name_asc">{t('sale.sort_name_asc')}</option>
                       <option value="name_desc">{t('sale.sort_name_desc')}</option>
                       <option value="price_asc">{t('sale.sort_price_asc')}</option>
                       <option value="price_desc">{t('sale.sort_price_desc')}</option>
                    </select>
                 </div>
                 {/* Reset Button */}
                 <div className="pt-4">
                    <button 
                      onClick={() => {
                        setListMode('list');
                        setSortOrder('name_asc');
                        setFilterStock('all');
                        setSelectedCategory('Category');
                        setSearchQuery('');
                      }}
                      className="w-full py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl border border-red-500/20 text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                       {t('sale.cancel')}
                    </button>
                 </div>
              </div>
           </div>
        )}
        <div className="flex-1 relative overflow-hidden bg-[var(--bg-page)]">
          <div className="absolute inset-0 overflow-y-auto pb-32 md:pb-4">
            {loading ? (
               <div className="flex justify-center items-center h-full">
                 <span className="material-icons-outlined animate-spin text-[var(--brand-primary)] text-[32px]">sync</span>
               </div>
            ) : (
               <div className={listMode === 'grid' ? 'grid grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5 gap-4 p-4' : 'flex flex-col'}>
                  {filteredAndSortedProducts.slice(0, displayLimit).map(product => {
                    const isVariable = product.type === 'variable' || (product.variations && product.variations.length > 0);
                    if (listMode === 'grid') {
                       return (
                         <div 
                           key={product.id} 
                           onClick={() => handleProductClick(product)} 
                           className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl overflow-hidden hover:border-[var(--brand-primary)] transition-all cursor-pointer group flex flex-col items-center p-4 relative shadow-lg hover:shadow-[var(--brand-primary)]/10"
                         >
                            <div className="w-full aspect-square bg-white rounded-xl mb-4 flex items-center justify-center p-2 relative overflow-hidden">
                               {product.image ? (
                                 <img src={product.image} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500" alt={product.name} />
                               ) : (
                                 <span className="material-icons-outlined text-gray-200 text-[48px]">image</span>
                               )}
                            </div>
                            <div className="text-center flex-1 w-full">
                               <h3 className="font-bold text-[var(--text-main)] text-sm truncate mb-1 group-hover:text-[var(--brand-primary)] transition-colors whitespace-normal line-clamp-2 min-h-[40px] leading-tight">{product.name}</h3>
                               <div className="text-[var(--brand-primary)] font-black text-sm">
                                  {product.sale_price ? formatPrice(product.sale_price) : formatPrice(product.price)}
                                </div>
                            </div>
                            <button 
                              onClick={(e) => togglePin(product.id, e)}
                              className={`absolute top-2 right-2 p-1.5 rounded-lg transition-all z-20 ${pinnedProductIds.includes(product.id) ? 'bg-[var(--brand-primary)] text-white shadow-lg' : 'text-gray-300 hover:text-white bg-black/40 opacity-10 group-hover:opacity-100'}`}
                            >
                               <span className="material-icons-outlined text-sm">push_pin</span>
                            </button>
                            {product.manage_stock && product.stock <= 0 && (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[2px] z-20">
                                 <span className="bg-red-500 text-white text-[10px] font-black uppercase px-2 py-1 rounded shadow-lg">{t('sale.out_of_stock')}</span>
                              </div>
                            )}
                         </div>
                       );
                    }
                    return (
                      <div key={product.id} onClick={() => handleProductClick(product)} className="flex items-center p-3 border-b border-[var(--border-main)]/50 hover:bg-[var(--bg-card)] cursor-pointer transition-colors group relative">
                         <div className="w-16 h-16 bg-white rounded relative flex-shrink-0 flex items-center justify-center overflow-hidden p-1 mr-4 border border-[var(--border-main)]/30">
                           {product.image ? (
                             <img src={product.image} className="w-full h-full object-contain" alt={product.name} />
                           ) : (
                             <span className="material-icons-outlined text-gray-700 text-[24px]">image</span>
                           )}
                         </div>
                         <div className="flex-1 min-w-0 pr-4">
                           <h3 className="font-bold text-[var(--text-main)] text-[15px] truncate mb-0.5 group-hover:text-[var(--brand-primary)] transition-colors">{product.name}</h3>
                           <div className="flex items-center text-sm gap-2 mb-0.5">
                             {product.sale_price 
                               ? <><span className="text-gray-500 line-through text-xs">{formatPrice(product.regular_price)}</span><span className="text-[var(--brand-primary)] font-bold">{formatPrice(product.sale_price)}</span></>
                               : <span className="text-[var(--brand-primary)] font-bold">{formatPrice(product.price)}</span>
                             }
                           </div>
                           <div className="text-xs text-[var(--text-muted)] flex items-center gap-3">
                              {product.manage_stock ? (
                                <span className={product.stock <= 0 ? 'text-red-500 font-bold' : ''}>{t('sale.stock')}: {product.stock}</span>
                              ) : (
                                <span className="text-emerald-500 font-bold">{t('sale.in_stock')}</span>
                              )}
                              <span className="text-[var(--border-main)]">|</span>
                              <span>{t('sale.sku')}: {product.sku}</span>
                           </div>
                         </div>
                         <button 
                            onClick={(e) => togglePin(product.id, e)}
                            className={`p-2 transition-all ${pinnedProductIds.includes(product.id) ? 'text-[var(--brand-primary)]' : 'text-gray-400 opacity-10 group-hover:opacity-100 hover:text-white'}`}
                         >
                            <span className="material-icons-outlined">push_pin</span>
                         </button>
                      </div>
                    );
                  })}
                  {/* Infinite Scroll Sensor */}
                  {filteredAndSortedProducts.length > displayLimit && (
                    <div ref={observerTarget} className="h-20 flex items-center justify-center">
                      <span className="material-icons-outlined animate-spin text-[var(--brand-primary)]">sync</span>
                    </div>
                  )}
               </div>
            )}
          </div>
        </div>
        {/* Barcode Scanner Modal (Inside main to only cover products) */}
        {isBarcodeModalOpen && (
          <BarcodeScannerModal 
            onClose={() => setIsBarcodeModalOpen(false)}
            onScan={handleBarcodeScan}
            formatPrice={formatPrice}
          />
        )}
      </main>
      {/* Note: Resizer Handle has been moved inside the aside to ensure it overlays everything */}
      {/* Cart Summary Bar - Mobile Only */}
      <div 
        onClick={() => setIsCartOpenMobile(true)}
        className={`md:hidden fixed bottom-16 left-0 right-0 h-16 bg-[var(--bg-card)] border-t border-[var(--border-main)] flex items-center justify-between px-6 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] active:scale-[0.98] transition-transform ${isCheckoutOpen || selectedItemForDetail || selectedProductForVariations || isBarcodeModalOpen || cart.length === 0 ? 'hidden' : ''}`}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="material-icons-outlined text-[var(--brand-primary)]">shopping_basket</span>
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-[var(--bg-card)]">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            )}
          </div>
          <div>
            <div className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest">{t('sale.total')}</div>
            <div className="text-lg font-black text-[var(--text-main)] leading-none">{formatPrice(total)}</div>
          </div>
        </div>
        <button 
          onClick={() => setIsCartOpenMobile(true)}
          className="bg-[var(--brand-primary)] text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-[var(--brand-primary)]/30"
        >
          {t('sale.view_cart')}
        </button>
      </div>

      {/* Cart Aside Column / Bottom Sheet Container */}
      {(window.innerWidth >= 768 || isCartOpenMobile) && (
        <aside 
          style={{ 
            width: window.innerWidth < 768 ? '100vw' : `${sidebarWidth}px`,
            height: window.innerWidth < 768 ? '100dvh' : 'auto'
          }} 
          className={`
            bg-[var(--bg-sidebar)] ${isRTL ? 'border-r' : 'border-l'} border-[var(--border-main)] flex flex-col z-[9999] md:z-10 shrink-0 
            ${isRTL ? 'shadow-[10px_0_30px_rgba(0,0,0,0.2)]' : 'shadow-[-10px_0_30px_rgba(0,0,0,0.2)]'} 
            overflow-hidden
            fixed md:relative inset-0 md:inset-auto
            ${window.innerWidth < 768 ? 'animate-in slide-in-from-bottom duration-300' : ''}
            ${selectedProductForVariations || isBarcodeModalOpen ? 'opacity-30 blur-[2px] pointer-events-none' : ''}
          `}
        >
          {/* Full-Height Resizer Handle for the entire sidebar */}
          <div 
            className={`hidden md:flex absolute top-0 bottom-0 ${isRTL ? 'right-0 translate-x-1/2' : 'left-0 -translate-x-1/2'} w-6 cursor-col-resize z-[100] items-center justify-center group bg-transparent hover:bg-[var(--brand-primary)]/10 transition-colors`}
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizing(true);
            }}
          >
            <div className="h-10 w-1.5 flex flex-col items-center justify-center gap-1 rounded-full bg-white/20 group-hover:bg-[var(--brand-primary)] border border-black/10 shadow-sm transition-colors">
              <div className="w-1 h-1 rounded-full bg-white opacity-60" />
              <div className="w-1 h-1 rounded-full bg-white opacity-60" />
              <div className="w-1 h-1 rounded-full bg-white opacity-60" />
            </div>
          </div>
        {!isCheckoutOpen && (
          <header className="h-16 px-5 border-b border-[var(--border-main)] flex justify-between items-center bg-[var(--bg-header)] shrink-0">
            <div className="flex items-center gap-3">
              {window.innerWidth < 768 && (
                <button 
                  onClick={() => setIsCartOpenMobile(false)}
                  className="flex items-center gap-1.5 text-[var(--brand-primary)] hover:text-[color-mix(in srgb, var(--brand-primary), black 15%)] transition-colors -ms-1"
                >
                  <span className="material-icons-outlined text-[20px]">arrow_back</span>
                  <span className="text-xs font-black uppercase tracking-widest">{t('sale.back')}</span>
                </button>
              )}
              <h2 className="text-[var(--text-main)] font-bold text-[15px]">{t('sale.new_order')}</h2>
            </div>
            <span className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-widest">{t('sale.in_progress')}</span>
          </header>
        )}
        {/* Desktop: Show inline CheckoutOverlay */}
        {isCheckoutOpen ? (
          <div className="hidden md:flex flex-1 overflow-hidden">
            <CheckoutOverlay 
              cart={cart}
              subtotal={subtotal}
              taxAmount={taxAmount}
              total={total}
              taxConfig={taxConfig}
              formatPrice={formatPrice}
              customers={customers}
              paymentGateways={paymentGateways}
              lastCreatedOrder={lastCreatedOrder}
              setLastCreatedOrder={setLastCreatedOrder}
              resumingOrderId={resumingOrderId}
              originalOrderMetadata={originalOrderMetadata}
              shopSettings={shopSettings}
              posSettings={posSettings}
              tables={tables}
              cfd={cfd}
              onNavigate={onNavigate}
              onClose={onCheckoutClose}
              onFinalize={handleCheckout}
              clearCart={clearCart}
              inline={true}
              couponsEnabled={couponsEnabled}
            />
          </div>
        ) : null}
        {/* Desktop: Show inline CartItemDetail OR cart list */}
        {selectedItemForDetail ? (
          <div className="hidden md:flex flex-1 overflow-hidden">
            <CartItemDetail 
              item={selectedItemForDetail}
              inline={true}
              onClose={() => {
                setSelectedItemForDetail(null);
                setIsDetailModeAddingNew(false);
              }}
              onUpdate={(id, updates) => {
                const targetId = isDetailModeAddingNew ? null : selectedItemForDetail.cartItemId;
                if (isDetailModeAddingNew) {
                  addToCart({ ...selectedItemForDetail, ...updates });
                } else {
                  updateItemDetails(targetId, updates);
                }
                setSelectedItemForDetail(null);
                setIsDetailModeAddingNew(false);
              }}
              formatPrice={formatPrice}
            />
          </div>
        ) : null}
        <div className={`flex-1 overflow-y-auto w-full ${selectedItemForDetail || isCheckoutOpen ? 'hidden md:hidden' : ''}`}>
           {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-700 opacity-30">
                 <span className="material-icons-outlined mb-4">shopping_cart</span>
                 <p className="text-sm font-medium">{t('sale.cart_empty')}</p>
              </div>
           ) : (
              cart.map(item => {
                const originalPrice = item.regular_price || item.price;
                const discountAmount = originalPrice - item.price;
                const hasDiscount = discountAmount > 0;
                return (
                  <div key={item.cartItemId} className="flex items-center p-4 border-b border-[var(--border-main)] group hover:bg-[var(--bg-page)] transition-colors relative">
                    <div className="flex-1 min-w-0 pe-10">
                      {/* Row 1: Item Name and Remove Button */}
                      <div className="flex justify-between items-start mb-2 md:mb-0">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[var(--text-main)] font-bold text-[13px] md:text-sm line-clamp-2 md:truncate leading-tight mb-1">{item.name}</h4>
                          
                          {/* Selected Addons Display */}
                          {item.selectedAddons && item.selectedAddons.length > 0 && (
                            <div className="flex flex-wrap gap-x-2 gap-y-0.5 opacity-80">
                              {item.selectedAddons.map((addon, aIdx) => (
                                <span key={aIdx} className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                                  <span className="font-bold uppercase opacity-60">{addon.groupName}:</span>
                                  <span className="text-[var(--text-main)] font-medium">
                                    {addon.name}{addon.selectedSize && ` (${addon.selectedSize.name})`}
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {/* Mobile Remove Button */}
                        <button 
                          onClick={() => removeFromCart(item.cartItemId)} 
                          className="md:hidden text-gray-400 hover:text-red-500 p-1 -mt-1 -me-1"
                        >
                          <span className="material-icons-outlined text-[18px]">close</span>
                        </button>
                      </div>

                      {/* Row 2: Price Info & Controls */}
                      <div className="flex justify-between items-center mt-2.5 md:mt-1 pt-2 md:pt-0 border-t md:border-0 border-[var(--border-main)]/30">
                        <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                          {/* Unit Price */}
                          <div className="flex items-center gap-1.5">
                            {editingPriceId === item.cartItemId ? (
                              <input
                                ref={priceInputRef}
                                type="number"
                                value={editingPriceValue}
                                onChange={(e) => setEditingPriceValue(e.target.value)}
                                onBlur={() => handlePriceConfirm(item.cartItemId)}
                                onKeyDown={(e) => handlePriceKeyDown(e, item.cartItemId)}
                                className="w-20 bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)] rounded px-1.5 py-0.5 text-[var(--brand-primary)] font-bold text-xs"
                              />
                            ) : (
                              <>
                                {hasDiscount && <span className="text-[var(--text-muted)] line-through text-[10px]">{formatPrice(originalPrice)}</span>}
                                <button onClick={() => handlePriceClick(item)} className="text-[var(--brand-primary)] font-bold text-xs hover:underline decoration-dotted underline-offset-2">
                                  {formatPrice(item.price)}
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Quantity Controls */}
                          <div className="flex items-center bg-[var(--bg-input)] rounded-lg p-0.5 border border-[var(--border-main)]/50 scale-90 md:scale-100 origin-right">
                            <button onClick={() => updateQuantity(item.cartItemId, Math.max(1, item.quantity - 1))} className="w-8 h-7 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--brand-primary)]"><span className="material-icons-outlined text-[14px]">remove</span></button>
                            <span className="w-6 text-center text-[var(--text-main)] text-xs font-bold">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)} className="w-8 h-7 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--brand-primary)]"><span className="material-icons-outlined text-[14px]">add</span></button>
                          </div>
                          
                          {/* Line Total */}
                          <span className={`text-[var(--text-main)] font-black text-xs md:text-sm min-w-[50px] ${isRTL ? 'text-left' : 'text-right'}`}>
                            {formatPrice(item.total)}
                          </span>

                          {/* Desktop Remove Button */}
                          <button 
                            onClick={() => removeFromCart(item.cartItemId)} 
                            className="hidden md:flex text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <span className="material-icons-outlined text-[18px]">delete_outline</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    <button 
                       onClick={() => setSelectedItemForDetail(item)}
                       className={`absolute ${isRTL ? 'left-0 border-r' : 'right-0 border-l'} top-0 bottom-0 w-10 border-[var(--border-main)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--bg-input)] transition-colors z-20`}
                    >
                       <span className="material-icons-outlined text-xl">{isRTL ? 'chevron_left' : 'chevron_right'}</span>
                    </button>
                  </div>
                );
              })
           )}
        </div>
        {/* Hide footer on desktop when showing inline detail or checkout */}
        <footer className={`border-t border-[var(--border-main)] bg-[var(--bg-card)] shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] ${selectedItemForDetail || isCheckoutOpen ? 'hidden md:hidden' : ''}`}>
           <div className="px-5 py-4 flex flex-col gap-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)] font-medium tracking-wide">{t('sale.subtotal')}</span>
                <span className="text-[var(--text-main)] font-bold">{formatPrice(subtotal)}</span>
              </div>
              {taxConfig.enabled && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)] font-medium tracking-wide">{taxConfig.label} ({taxConfig.rate}%)</span>
                  <span className="text-[var(--text-main)] font-bold">{formatPrice(taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between mt-2 pt-3 border-t border-[var(--border-main)]">
                <span className="text-2xl font-bold text-[var(--text-main)] tracking-tight uppercase">{t('sale.total')}</span>
                <span className="text-3xl font-bold text-[var(--text-main)] tracking-tighter">{formatPrice(total)}</span>
              </div>
           </div>
            <div className="flex h-16 w-full text-xs font-bold uppercase tracking-widest">
               <button onClick={() => { 
                 setLastCreatedOrder(null); 
                 clearCart(); 
                 setIsCartOpenMobile(false);
               }} className="flex-1 flex items-center justify-center gap-2 text-red-500 hover:bg-red-500/5 transition-colors border-t border-r border-[var(--border-main)]"><span className="material-icons-outlined">delete_sweep</span> {t('sale.cancel')}</button>
               <button 
                 onClick={() => { 
                   setLastCreatedOrder(null); 
                   if (resumingOrderId) {
                     handleSaveOrder();
                     setIsCartOpenMobile(false);
                   } else if (isFoodEnabled) {
                     // F&B Mode: Open table dashboard to select a table
                     onNavigate('tables'); 
                     setIsCartOpenMobile(false);
                   } else {
                     // Retail Mode: Just park the order directly
                     handleSaveOrder(); 
                     setIsCartOpenMobile(false);
                   }
                 }} 
                 className="flex-1 flex items-center justify-center gap-2 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 transition-colors border-t border-[var(--border-main)]"
               >
                 <span className="material-icons-outlined">{resumingOrderId ? 'update' : 'save'}</span> 
                 {resumingOrderId ? t('sale.update_table') : (isFoodEnabled ? t('sale.save_to_table') : t('sale.park_order'))}
               </button>
               <button 
                 onClick={() => {
                  if (cart.length === 0) return toast.error(t('sale.cart_empty_toast'));
                  setLastCreatedOrder(null);
                  setIsCheckoutOpen(true);
                }} 
                 className="w-1/2 flex items-center justify-center gap-2 bg-[var(--brand-primary)] hover:bg-[color-mix(in srgb, var(--brand-primary), black 15%)] text-white transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
               >
                 <span className="material-icons-outlined">check_circle</span> {t('sale.checkout')}
               </button>
            </div>
        </footer>
      </aside>
      )}
      
      {/* Global Overlays - Rendered outside conditional aside and main for mobile visibility */}
      {selectedProductForVariations && (
        <VariationSelectorModal 
          product={selectedProductForVariations}
          onClose={() => setSelectedProductForVariations(null)}
          onSelect={handleAddToCartWithAddons}
          formatPrice={formatPrice}
        />
      )}

      {/* Mobile-only: CartItemDetail as full-screen overlay */}
      {selectedItemForDetail && (
        <div className="md:hidden">
          <CartItemDetail 
            item={selectedItemForDetail} 
            onClose={() => {
              setSelectedItemForDetail(null);
              setIsDetailModeAddingNew(false);
            }}
            onUpdate={(id, updates) => {
              const targetId = isDetailModeAddingNew ? null : selectedItemForDetail.cartItemId;
              if (isDetailModeAddingNew) {
                addToCart({ ...selectedItemForDetail, ...updates });
              } else {
                updateItemDetails(targetId, updates);
              }
              setSelectedItemForDetail(null);
              setIsDetailModeAddingNew(false);
            }}
            formatPrice={formatPrice}
          />
        </div>
      )}

      {/* Mobile-only: CheckoutOverlay as full-screen overlay */}
      {isCheckoutOpen && window.innerWidth < 768 && (
        <div className="md:hidden">
          <CheckoutOverlay 
            cart={cart}
            subtotal={subtotal}
            taxAmount={taxAmount}
            total={total}
            taxConfig={taxConfig}
            formatPrice={formatPrice}
            customers={customers}
            paymentGateways={paymentGateways}
            lastCreatedOrder={lastCreatedOrder}
            setLastCreatedOrder={setLastCreatedOrder}
            resumingOrderId={resumingOrderId}
            originalOrderMetadata={originalOrderMetadata}
            shopSettings={shopSettings}
            posSettings={posSettings}
            tables={tables}
            cfd={cfd}
            onNavigate={onNavigate}
            onClose={onCheckoutClose}
            onFinalize={handleCheckout}
            clearCart={clearCart}
            couponsEnabled={couponsEnabled}
          />
        </div>
      )}

      {/* Global Overlays */}
      {isParkedOrdersModalOpen && (
        <ParkedOrdersModal 
          onClose={() => setIsParkedOrdersModalOpen(false)}
          onResume={handleResumeOrder}
          onDelete={handleDeleteOrder}
          formatPrice={formatPrice}
        />
      )}
    </div>
  );
}
