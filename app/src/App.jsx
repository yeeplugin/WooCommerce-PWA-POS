import React, { useEffect, useState, useRef } from 'react';
import { useCartStore } from './store/useCartStore';
import { toast } from './utils/toast';
import { updateApiNonce, setApiConfig, fetchSettings, fetchTaxRates, fetchPaymentGateways, fetchCountries, fetchCategories, fetchCustomers, createWooOrder, fetchOrders, fetchProducts, fetchTables } from './api/woocommerce';
import { syncOrders } from './utils/syncEngine';

import { db } from './db/indexedDB';

import { MobileNav } from './layout/MobileNav';
import { BarcodeScannerModal } from './features/sale/BarcodeScannerModal';
import { LanguageProvider, useTranslation } from './utils/i18n';

// Feature Views and Hooks
import { Sidebar } from './layout/Sidebar';
import { SaleView } from './features/sale/SaleView';
import { ReportsView } from './features/reports/ReportsView';
import { SettingsView } from './features/settings/SettingsView';
import { TableDashboard } from './features/sale/TableDashboard';
import { OrdersView } from './features/orders/OrdersView';
import { CustomersView } from './features/customers/CustomersView';
import { ProductsView } from './features/products/ProductsView';
import { LoginView } from './features/auth/LoginView';
import { CustomerDisplay } from './features/display/CustomerDisplay';
import { useCFDBroadcast } from './hooks/useCFDBroadcast';
import { buildOccupiedTableMap } from './utils/tableStatus';
import { InitialSetupLoader } from './components/InitialSetupLoader';
import { StoreSelector } from './components/StoreSelector';
import { RegisterSelector } from './components/RegisterSelector';
import { ClosingReportModal } from './components/ClosingReportModal';
import { fetchStores, claimRegister, releaseRegister, fetchSessionSummary } from './api/woocommerce';

// Check if this tab should render the Customer-Facing Display
const isCustomerDisplay = new URLSearchParams(window.location.search).get('display') === 'customer';

function App() {
  const [posSettings, setPosSettings] = useState(() => {
    const saved = localStorage.getItem('pos_global_settings');
    const wpLocale = window.yeePOSData?.locale || 'en';
    const defaultSettings = { 
      autoPrint: false, 
      forceOffline: false, 
      autoSyncInterval: 10, 
      language: wpLocale,
      theme: 'dark',
      initialSyncCount: 100
    };
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });

  // Theme Management — runs at App level so it applies on Login screen too
  useEffect(() => {
    const applyTheme = (themeValue) => {
      let isDark = false;
      if (themeValue === 'dark') {
        isDark = true;
      } else if (themeValue === 'light') {
        isDark = false;
      } else {
        // Auto — match system
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }

      const darkColor = '#050505';
      const lightColor = '#f9fafb';

      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      // Update both theme-color meta tags (dark + light media variants)
      const darkMeta = document.querySelector('meta[name="theme-color"][media*="dark"]');
      const lightMeta = document.querySelector('meta[name="theme-color"][media*="light"]');

      if (themeValue === 'auto') {
        // Auto mode: restore media-based defaults so OS picks the right one
        if (darkMeta) darkMeta.setAttribute('content', darkColor);
        if (lightMeta) lightMeta.setAttribute('content', lightColor);
      } else {
        // Manual mode: force both meta tags to the same color
        const forcedColor = isDark ? darkColor : lightColor;
        if (darkMeta) darkMeta.setAttribute('content', forcedColor);
        if (lightMeta) lightMeta.setAttribute('content', forcedColor);
      }
    };

    applyTheme(posSettings.theme || 'auto');

    // Listener for system theme changes if in auto mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (posSettings.theme === 'auto') {
        applyTheme('auto');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [posSettings.theme]);

  // Handle case where we only need the customer display
  if (isCustomerDisplay) {
    return (
      <LanguageProvider initialLanguage={posSettings.language || 'en'}>
         <CustomerDisplay />
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider 
      initialLanguage={posSettings.language || 'en'}
      onLanguageChange={(newLang) => setPosSettings(prev => ({ ...prev, language: newLang }))}
    >
       <MainApp posSettings={posSettings} setPosSettings={setPosSettings} />
    </LanguageProvider>
  );
}

function MainApp({ posSettings, setPosSettings }) {
  const { t } = useTranslation();
  const isBranchActive = window.yeePOSData?.activeModules?.branchActive === true;
  const [view, setView] = useState('sale'); // 'sale', 'customers', or 'products'
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [countries, setCountries] = useState([]);
  const [tables, setTables] = useState([]);
  const [taxConfig, setTaxConfig] = useState({ enabled: false, rate: 0, label: 'Tax', pricesIncludeTax: false });
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [paymentGateways, setPaymentGateways] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastCreatedOrder, setLastCreatedOrder] = useState(null);
  const [couponsEnabled, setCouponsEnabled] = useState(() => localStorage.getItem('pos_coupons_enabled') === 'true');
  const [shopSettings, setShopSettings] = useState({
    shopAddress: '',
    shopPhone: ''
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('isSidebarCollapsed') === 'true');

  useEffect(() => {
    localStorage.setItem('isSidebarCollapsed', isSidebarCollapsed);
  }, [isSidebarCollapsed]);

  const [parkedOrdersCount, setParkedOrdersCount] = useState(0);
  const [freeTablesCount, setFreeTablesCount] = useState(0);
  const [newOnlineOrdersCount, setNewOnlineOrdersCount] = useState(0);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [shouldOpenCheckoutOnResume, setShouldOpenCheckoutOnResume] = useState(false);
  
  // Closing Report state
  const [isClosingReportOpen, setIsClosingReportOpen] = useState(false);
  const [sessionSummary, setSessionSummary] = useState(null);
  const [closingCallback, setClosingCallback] = useState(null);

  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
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
  
  // Update the unread online orders count from IndexedDB
  const refreshNewOrdersCount = async () => {
    try {
      // Count orders flagged as new online orders
      const count = await db.orders.where('_isNewOnline').equals(1).count();
      setNewOnlineOrdersCount(count);
    } catch (err) {
      console.error('[YeePOS] Failed to count new orders:', err);
    }
  };
  const [lastSyncTime, setLastSyncTime] = useState(() => {
    const saved = localStorage.getItem('pos_last_sync_time');
    return saved ? new Date(saved) : null;
  });
  const [currentUser, setCurrentUser] = useState(window.yeePOSData?.currentUser || null);
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(() => {
    const saved = localStorage.getItem('pos_selected_store');
    return saved ? JSON.parse(saved) : null;
  });
  const [selectedRegister, setSelectedRegister] = useState(() => {
    const saved = localStorage.getItem('pos_selected_register');
    return saved ? JSON.parse(saved) : null;
  });
  const [setupProgress, setSetupProgress] = useState(null);
  const isSyncingRef = useRef(false);
  const isFoodEnabled = window.yeePOSData?.activeModules?.food || false;
  useEffect(() => {
    localStorage.setItem('pos_global_settings', JSON.stringify(posSettings));
  }, [posSettings]);


  // Customer-Facing Display Broadcast
  const cfd = useCFDBroadcast(priceFormatConfig);


  
  const cart = useCartStore((state) => state.cart);
  const addToCart = useCartStore((state) => state.addToCart);
  const removeFromCart = useCartStore((state) => state.removeFromCart);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const updatePrice = useCartStore((state) => state.updatePrice);
  const updateItemDetails = useCartStore((state) => state.updateItemDetails);
  const setCart = useCartStore((state) => state.setCart);
  const getCartTotal = useCartStore((state) => state.getCartTotal);
  const clearCart = useCartStore((state) => state.clearCart);
  const resumingOrderId = useCartStore((state) => state.resumingOrderId);
  const setResumingOrderId = useCartStore((state) => state.setResumingOrderId);
  const originalOrderMetadata = useCartStore((state) => state.originalOrderMetadata);

  // Broadcast cart changes to Customer-Facing Display
  useEffect(() => {
    if (cart.length > 0) {
      const rawTotal = getCartTotal();
      let sub = rawTotal;
      let tax = 0;
      let tot = rawTotal;
      if (taxConfig.enabled) {
        if (taxConfig.pricesIncludeTax) {
          tot = rawTotal;
          tax = tot - (tot / (1 + taxConfig.rate / 100));
          sub = tot - tax;
        } else {
          sub = rawTotal;
          tax = sub * (taxConfig.rate / 100);
          tot = sub + tax;
        }
      }
      cfd.broadcastCartUpdate(cart, sub, tax, tot, taxConfig);
    } else {
      cfd.broadcastIdle(shopSettings.shopName || window.yeePOSData?.siteTitle);
    }
  }, [cart, taxConfig]);

  useEffect(() => {
    if (currentUser) {
      const initialize = async () => {
        // Step 1: Fetch Stores (Workflow 2)
        const availableStores = await fetchStores();
        setStores(availableStores);

        // Step 2: Multi-store logic (Workflow 3)
        if (availableStores.length >= 1) {
          // If branch module is not active, auto-select the first store/register (Old Way)
          if (!isBranchActive && !selectedStore) {
            const firstStore = availableStores[0];
            setSelectedStore(firstStore);
            localStorage.setItem('pos_selected_store', JSON.stringify(firstStore));
            
            if (firstStore.registers && firstStore.registers.length > 0) {
              const firstReg = firstStore.registers[0];
              setSelectedRegister(firstReg);
              localStorage.setItem('pos_selected_register', JSON.stringify(firstReg));
            }
          } else if (selectedStore) {
            // If already selected, check if it's still in the available list
            const currentStore = availableStores.find(s => s.id === selectedStore.id);
            if (!currentStore) {
               setSelectedStore(null);
               setSelectedRegister(null);
               localStorage.removeItem('pos_selected_store');
               localStorage.removeItem('pos_selected_register');
            } else {
               // Update the store data (in case registers changed)
               setSelectedStore(currentStore);
               localStorage.setItem('pos_selected_store', JSON.stringify(currentStore));
               
               // Check if selected register still exists in this store
               if (selectedRegister && currentStore.registers) {
                  const regExists = currentStore.registers.find(r => r.name === selectedRegister.name);
                  if (!regExists) {
                    setSelectedRegister(null);
                    localStorage.removeItem('pos_selected_register');
                  }
               }
            }
          }
        } else {
          // Fallback to main
          const fallbackStore = { 
            id: 'main', 
            name: window.yeePOSData?.siteTitle || 'Main Store', 
            is_main: true,
            registers: [{ name: 'Default Register' }]
          };
          handleSelectStore(fallbackStore);
        }

        await loadLocalData(); // Load local data first for instant UI
        
        // Detect if this is the first login by checking product count
        const productCount = await db.products.count().catch(() => 0);
        const isFirstLoad = productCount === 0;

        if (isFirstLoad) {
          setSetupProgress({ percent: 5, message: t('setup.connecting', 'Đang kết nối đến máy chủ...') });
          await loadInitialData(false, true); // Wait for setup to finish
          setSetupProgress(null);
        } else {
          loadInitialData(true); // Then sync in the background
        }
      };
      initialize();
    }
  }, [currentUser?.id]);
  
  // Workflow: Trigger initial sync when a register is selected (if cache was cleared)
  useEffect(() => {
    if (selectedRegister && selectedStore && currentUser) {
      const checkAndSync = async () => {
        const productCount = await db.products.count().catch(() => 0);
        if (productCount === 0) {
          console.log('[YeePOS] Register selected and cache is empty. Starting initial sync...');
          setSetupProgress({ percent: 5, message: t('setup.connecting', 'Đang kết nối đến máy chủ...') });
          await loadInitialData(false, true);
          setSetupProgress(null);
        }
      };
      checkAndSync();
    }
  }, [selectedRegister?.name, selectedStore?.id]);

  // Session Heartbeat: Detect if admin force logged us out
  useEffect(() => {
    if (!currentUser || !selectedStore || !selectedRegister) return;

    const checkSession = async () => {
      try {
        const latestStores = await fetchStores();
        const currentStoreData = latestStores.find(s => s.id === selectedStore.id);
        
        if (currentStoreData) {
          const currentRegData = currentStoreData.registers?.find(r => r.name === selectedRegister.name);
          
          // If register info is missing or someone else took it (active_user exists and it's not us)
          // Note: Backend handle_stores only returns active_user if it's NOT the current user
          if (currentRegData && currentRegData.active_user) {
            console.warn('[YeePOS] Session invalidated by Admin or another user.');
            toast.error(t('registers.session_invalidated', 'Phiên làm việc đã kết thúc hoặc bị quản trị viên đăng xuất.'));
            setSelectedRegister(null);
            localStorage.removeItem('pos_selected_register');
          }
        }
      } catch (err) {
        console.warn('[YeePOS] Failed to check session heartbeat');
      }
    };

    const interval = setInterval(checkSession, 300000); // Check every 5m
    return () => clearInterval(interval);
  }, [currentUser, selectedStore, selectedRegister]);

  const handleSelectStore = async (store) => {
    // Release old register if changing store
    if (selectedStore && selectedRegister) {
      await releaseRegister(selectedStore.id, selectedRegister.name);
    }
    
    setSelectedStore(store);
    localStorage.setItem('pos_selected_store', JSON.stringify(store));
    
    // Always clear selected register when changing store
    setSelectedRegister(null);
    localStorage.removeItem('pos_selected_register');
  };

  const handleSelectRegister = async (register, storeId = null) => {
    const targetStoreId = storeId || selectedStore?.id;
    if (!targetStoreId) return false;

    try {
      // Claim on server (Workflow 5: Active check)
      await claimRegister(targetStoreId, register.name);

      // --- Optimization: Clear cache if branch/register changed ---
      if (isBranchActive) {
        const lastStoreId = localStorage.getItem('yeepos_last_store_id');
        const lastRegisterName = localStorage.getItem('yeepos_last_register_name');

        if (lastStoreId !== String(targetStoreId) || lastRegisterName !== register.name) {
          console.log('[YeePOS] Store/Register changed. Clearing local cache for fresh sync...');
          try {
            await Promise.all([
              db.products.clear(),
              db.dining_tables.clear(),
              db.orders.where('status').equals('parked').delete(), // Only clear parked orders
              db.settings.delete('categories'),
              db.settings.delete('payment_gateways')
            ]);
            // Force reload products in state
            setProducts([]);
            setCategories([]);
            if (isFoodEnabled) setTables([]);
          } catch (e) {
            console.error('[YeePOS] Failed to clear cache:', e);
          }
        }
        
        localStorage.setItem('yeepos_last_store_id', targetStoreId);
        localStorage.setItem('yeepos_last_register_name', register.name);
      }
      // --- End Optimization ---
      
      setSelectedRegister(register);
      localStorage.setItem('pos_selected_register', JSON.stringify(register));
      setView('sale'); // Always return to sale view after register selection
      return true;
    } catch (err) {
      toast.error(err.message || t('registers.claim_error', 'Không thể đăng nhập vào máy này.'));
      return false;
    }
  };

  const persistApiConfig = async (userData = null) => {
    const config = {
      apiUrl: window.yeePOSData?.apiUrl,
      nonce: userData?.nonce || window.yeePOSData?.nonce
    };
    try {
      await db.settings.put({ id: 'api_config', value: config });
      setApiConfig(config);
    } catch (err) {
      console.error('[YeePOS] Failed to persist API config:', err);
    }
  };

  const handleLoginSuccess = async (user) => {
    // Update API nonce and persist config BEFORE setting user state
    if (user.nonce) {
      updateApiNonce(user.nonce);
      await persistApiConfig(user);
    }
    setCurrentUser(user);
  };

  const handleShowClosingReport = async (callback) => {
    if (isBranchActive && selectedRegister?.enable_closing_report === 'yes' && selectedStore && selectedRegister) {
      try {
        const summary = await fetchSessionSummary(selectedStore.id, selectedRegister.name);
        if (summary) {
          setSessionSummary(summary);
          setClosingCallback(() => callback);
          setIsClosingReportOpen(true);
          return;
        }
      } catch (err) {
        console.error('[YeePOS] Failed to fetch session summary:', err);
      }
    }
    // If not enabled or failed, just call callback
    callback('');
  };

  const handleCloseRegister = async () => {
    handleShowClosingReport(async (note) => {
      if (selectedStore && selectedRegister) {
        await releaseRegister(selectedStore.id, selectedRegister.name, note);
        setSelectedRegister(null);
        setSelectedStore(null);
        localStorage.removeItem('pos_selected_register');
        localStorage.removeItem('pos_selected_store');
        window.location.reload();
      }
    });
  };

  const handleLogout = async () => {
    const isReportEnabled = selectedRegister?.enable_closing_report === 'yes';
    if (!isReportEnabled && !confirm(t('settings.logout_confirm'))) return;

    handleShowClosingReport(async (note) => {
      try {
        // Release register if any
        if (selectedStore && selectedRegister) {
          await releaseRegister(selectedStore.id, selectedRegister.name, note);
        }

        // Call the API endpoint
        await fetch(`${window.yeePOSData.apiUrl}yeepos/v1/logout`, {
          method: 'POST',
          headers: {
            'X-WP-Nonce': window.yeePOSData.nonce
          }
        });
      } catch (err) {
        console.error('[YeePOS] API Logout failed:', err);
      } finally {
        setCurrentUser(null);
        setSelectedStore(null);
        setSelectedRegister(null);
        localStorage.removeItem('yeepos_user');
        localStorage.removeItem('pos_selected_register');
        localStorage.removeItem('pos_selected_store');
        window.location.reload();
      }
    });
  };

  // Format a WC API product into the lightweight POS cache format
  const formatProduct = (p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    price: parseFloat(p.price || 0),
    regular_price: p.regular_price || '',
    sale_price: p.sale_price || '',
    sku: p.sku || `SKU-${p.id}`,
    image: p.images?.[0]?.src || '',
    stock: p.stock_quantity || 0,
    manage_stock: p.manage_stock,
    sold_individually: p.sold_individually,
    categories: p.categories || [],
    meta_data: p.meta_data || [],
    _yeepos_addons: p._yeepos_addons || []
  });

  const syncProducts = async () => {
    if (isSyncingRef.current) return false;
    isSyncingRef.current = true;
    try {
      // Only fetch initialSyncCount products (default 100) — Cache-on-Demand
      const syncCount = posSettings.initialSyncCount || 100;
      const apiProducts = await fetchProducts(
        1, 
        syncCount, 
        isBranchActive ? selectedStore?.id : null,
        isBranchActive ? selectedRegister?.name : null
      );
      
      if (apiProducts?.length > 0) {
        const formattedProducts = apiProducts.map(formatProduct);
        // Use bulkPut (upsert) instead of clear+bulkAdd
        // This preserves cached products from previous searches/cart additions
        await db.products.bulkPut(formattedProducts);
        // Load ALL local products (cached + freshly synced)
        const allLocal = await db.products.toArray();
        setProducts(allLocal);
        console.log(`[YeePOS] Synced ${formattedProducts.length} products, total local cache: ${allLocal.length}`);
        return true;
      }
    } catch (err) {
      console.error('Failed to sync products:', err);
    } finally {
      isSyncingRef.current = false;
    }
    return false;
  };

  const downloadOrdersFromServer = () => syncOrders({ initialSyncCount: posSettings.initialSyncCount || 100 });
  const syncPendingOrders = () => syncOrders();

  const syncPendingOrdersInternal = async () => {
    if (isSyncingRef.current || !navigator.onLine || posSettings.forceOffline) return;
    isSyncingRef.current = true;
    try {
      const result = await syncOrders();
      
      await refreshNewOrdersCount();
      window.dispatchEvent(new CustomEvent('yeepos_sync_finished', { detail: result }));
    } finally {
      isSyncingRef.current = false;
    }
  };

  const loadLocalData = async () => {
    try {
      console.log('[YeePOS] Loading local data from IndexedDB...');
      const [localProducts, localCustomers, localTables, localGateways, localCountries, localCategories] = await Promise.all([
        db.products.toArray().catch(() => []),
        db.customers.toArray().catch(() => []),
        isFoodEnabled ? db.dining_tables.toArray().catch(() => []) : Promise.resolve([]),
        db.settings.get('payment_gateways').then(s => s?.data || []).catch(() => []),
        db.settings.get('countries').then(s => s?.data || []).catch(() => []),
        db.settings.get('categories').then(s => s?.data || []).catch(() => [])
      ]);

      console.log(`[YeePOS] Local data loaded: ${localProducts.length} products, ${localCustomers.length} customers`);
      
      setProducts(localProducts);
      setCustomers(localCustomers);
      const allowedGateways = window.yeePOSData?.enabledGateways || ['cash', 'cod', 'bacs', 'cheque', 'chip_and_pin'];
      setPaymentGateways(localGateways.filter(g => allowedGateways.includes(g.id)));
      setCountries(localCountries);
      setCategories(localCategories);
      
      const savedCouponsEnabled = localStorage.getItem('pos_coupons_enabled') === 'true';
      setCouponsEnabled(savedCouponsEnabled);
      
      if (isFoodEnabled) {
        setTables(localTables);
      }

      // Load small config objects from localStorage
      try {
        const savedTax = localStorage.getItem('pos_tax_config');
        if (savedTax) setTaxConfig(JSON.parse(savedTax));
        
        const savedShop = localStorage.getItem('pos_shop_settings');
        if (savedShop) setShopSettings(JSON.parse(savedShop));

        const savedPrice = localStorage.getItem('pos_price_format_config');
        if (savedPrice) setPriceFormatConfig(JSON.parse(savedPrice));
      } catch (e) {
        console.error('[YeePOS] Failed to parse local config:', e);
      }

      // Always count parked orders on load, regardless of module
      updateParkedOrdersCount(localTables);
      refreshNewOrdersCount(); // Initial count on load
      setLoading(false);
      return true;
    } catch (err) {
      console.error('[YeePOS] Failed to load local data:', err);
      setLoading(false);
      return false;
    }
  };

  const loadInitialData = async (isSilent = true, isFirstLoad = false) => {
    const updateProgress = (percent, msg) => {
      if (isFirstLoad) setSetupProgress({ percent, message: msg });
    };

    if (!isSilent) {
      setLoading(true);
      setIsManualSyncing(true);
    }

    // Persist latest config for Background Sync
    await persistApiConfig();

    try {
      updateProgress(15, t('setup.settings', 'Đang tải cài đặt hệ thống...'));
      // 1. Load Everything (Essential for Manual Sync)
      const [generalSettings, taxSettings, taxRates, apiGateways] = await Promise.all([
        fetchSettings('general'),
        fetchSettings('tax'),
        fetchTaxRates(),
        fetchPaymentGateways()
      ]);

      const shopInfo = (isBranchActive && selectedStore) ? {
        shopName: selectedStore.name || window.yeePOSData?.siteTitle || 'YEEPOS STORE',
        shopAddress: selectedStore.address || '',
        shopPhone: selectedStore.phone || ''
      } : {
        shopName: window.yeePOSData?.siteTitle || 'YEEPOS STORE',
        shopAddress: `${generalSettings.find(s => s.id === 'woocommerce_store_address')?.value || ''}, ${generalSettings.find(s => s.id === 'woocommerce_store_city')?.value || ''}`,
        shopPhone: generalSettings.find(s => s.id === 'woocommerce_store_postcode')?.value || '' 
      };
      setShopSettings(shopInfo);
      const allowedGateways = window.yeePOSData?.enabledGateways || ['cash', 'cod', 'bacs', 'cheque', 'chip_and_pin'];
      const enabledGateways = apiGateways.filter(g => g.enabled && allowedGateways.includes(g.id));
      setPaymentGateways(enabledGateways);
      db.settings.put({ id: 'payment_gateways', data: enabledGateways }).catch(() => {});

      const allSettings = [...generalSettings, ...taxSettings];
      const taxEnabledSetting = allSettings.find(s => s.id === 'woocommerce_calc_taxes');
      const pricesIncludeTaxSetting = allSettings.find(s => s.id === 'woocommerce_prices_include_tax');
      
      const isTaxEnabled = taxEnabledSetting?.value === 'yes';
      const pricesIncludeTax = pricesIncludeTaxSetting?.value === 'yes';
      
      const couponsEnabledSetting = allSettings.find(s => s.id === 'woocommerce_enable_coupons');
      const isCouponsEnabled = couponsEnabledSetting?.value === 'yes';
      setCouponsEnabled(isCouponsEnabled);
      localStorage.setItem('pos_coupons_enabled', isCouponsEnabled);

      let activeTaxRate = 0;
      let taxLabel = 'Tax';

      if (isTaxEnabled && taxRates.length > 0) {
        activeTaxRate = parseFloat(taxRates[0].rate || 0);
        taxLabel = taxRates[0].name || 'Tax';
      }

      const newTaxConfig = {
        enabled: isTaxEnabled,
        rate: activeTaxRate,
        label: taxLabel,
        pricesIncludeTax: pricesIncludeTax
      };
      setTaxConfig(newTaxConfig);
      localStorage.setItem('pos_tax_config', JSON.stringify(newTaxConfig));

      updateProgress(40, t('setup.customers', 'Đang đồng bộ dữ liệu khách hàng...'));
      // Load Countries, Categories, Customers
      const [apiCountries, apiCategories, apiCustomers] = await Promise.all([
        fetchCountries(),
        fetchCategories(
          isBranchActive ? selectedStore?.id : null,
          isBranchActive ? selectedRegister?.name : null
        ),
        fetchCustomers(1, posSettings.initialSyncCount || 100)
      ]);

      setCountries(apiCountries);
      setCategories(apiCategories);
      db.settings.put({ id: 'countries', data: apiCountries }).catch(() => {});
      db.settings.put({ id: 'categories', data: apiCategories }).catch(() => {});

      if (apiCustomers?.length > 0) {
        await db.customers.clear();
        await db.customers.bulkAdd(apiCustomers);
        setCustomers(apiCustomers);
      }

      // Load Dynamic Tables (Only if Food module is active)
      if (isFoodEnabled) {
        let apiTables = [];
        if (isBranchActive && selectedStore?.table_data) {
          apiTables = selectedStore.table_data;
          console.log(`[YeePOS] Using branch-specific tables for store: ${selectedStore.name}`);
        } else {
          apiTables = await fetchTables();
        }

        if (apiTables?.length > 0) {
          try {
            await db.dining_tables.clear();
            await db.dining_tables.bulkAdd(apiTables);
          } catch (e) {
            console.error('[YeePOS] Could not save tables:', e);
          }
          setTables(apiTables);
        }
      }

      // 1.5 Extract Price Format Config
      const newPriceConfig = {
        currency: allSettings.find(s => s.id === 'woocommerce_currency')?.value || 'USD',
        currencyPos: allSettings.find(s => s.id === 'woocommerce_currency_pos')?.value || 'left',
        thousandSep: allSettings.find(s => s.id === 'woocommerce_price_thousand_sep')?.value || ',',
        decimalSep: allSettings.find(s => s.id === 'woocommerce_price_decimal_sep')?.value || '.',
        numDecimals: parseInt(allSettings.find(s => s.id === 'woocommerce_price_num_decimals')?.value) || 2
      };
      setPriceFormatConfig(newPriceConfig);
      localStorage.setItem('pos_price_format_config', JSON.stringify(newPriceConfig));
      localStorage.setItem('pos_shop_settings', JSON.stringify(shopInfo));

      updateProgress(65, t('setup.products', 'Đang tải danh mục sản phẩm và đơn hàng...'));
      // 2. Sync Products, Pending Orders & Download Online Orders
      const syncResults = await Promise.all([
        syncProducts(),
        syncPendingOrders(),
        downloadOrdersFromServer()
      ]);

      const pendingResult = syncResults[1];

      window.dispatchEvent(new CustomEvent('yeepos_sync_finished', { detail: pendingResult }));

      updateProgress(95, t('setup.finishing', 'Đang hoàn tất thiết lập...'));
      const now = new Date();
      setLastSyncTime(now);
      localStorage.setItem('pos_last_sync_time', now.toISOString());

    } catch (err) {
      console.error('Initial data load failed:', err);
      // Fallback is handled by loadLocalData called earlier during initialization
    } finally {
      if (!isSilent) {
        setLoading(false);
        setIsManualSyncing(false);
      }
      // apiTables might not be defined if fetchTables failed or returned nothing, so fallback to tables.
      // But we can just pass the fetched tables if available, or fetch again from local DB.
      // Actually, since this is in a finally block, apiTables is not in scope.
      // We can just fetch tables from Dexie directly to be safe, because state is not updated yet.
      if (isFoodEnabled) {
        const currentTables = await db.dining_tables.toArray().catch(() => []);
        updateParkedOrdersCount(currentTables);
      }
    }
  };

  // Modern Background Sync + Fallback Timer
  useEffect(() => {
    if (posSettings.autoSyncInterval <= 0) return;

    const performAutoSync = async () => {
      // Prefer Background Sync API if supported
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        try {
          const registration = await navigator.serviceWorker.ready;
          if (registration.sync) {
            console.log('[YeePOS] Requesting Background Sync via API...');
            await registration.sync.register('yeepos-sync-orders');
            return; // API will handle it
          }
        } catch (err) {
          console.warn('[YeePOS] Background Sync registration failed, falling back to timer:', err);
        }
      }

      // Fallback: Custom Interval Timer
      console.log('[YeePOS] Performing Auto-Sync via Fallback Timer...');
      await syncPendingOrdersInternal();
    };

    const intervalId = setInterval(performAutoSync, posSettings.autoSyncInterval * 60 * 1000);

    // Also trigger once on start
    performAutoSync();

    return () => clearInterval(intervalId);
  }, [posSettings.autoSyncInterval, posSettings.forceOffline]);

  const handleClearLocalData = async () => {
    if (!confirm(t('settings.clear_data_confirm'))) return;
    setLoading(true);
    try {
      await Promise.all([
        db.products.clear(),
        db.orders.clear(),
        db.customers.clear()
      ]);
      setProducts([]);
      setCustomers([]);
      setParkedOrdersCount(0);
      toast.success(t('settings.clear_data_success'));
    } catch (err) {
      console.error('Failed to clear local data', err);
    } finally {
      setLoading(false);
    }
  };

  const updateParkedOrdersCount = async (currentTables = null) => {
    try {
      // Count all active offline orders (Parked only for consistency with UI)
      const parkedCount = await db.orders
        .where('status')
        .equals('parked')
        .count();
      setParkedOrdersCount(parkedCount);

      // Calculate Free Tables — only load active orders (not all 100k)
      const activeTables = currentTables || tables;
      const totalTables = activeTables.length;
      const activeOrders = await db.orders
        .where('status').anyOf(['parked', 'processing', 'on-hold'])
        .toArray();
      const occupiedMapping = buildOccupiedTableMap(activeOrders, activeTables);
      const occupiedCount = Object.keys(occupiedMapping).length;
      console.log(`[YeePOS] Tables: ${totalTables} total, ${occupiedCount} occupied, ${totalTables - occupiedCount} free`);
      setFreeTablesCount(Math.max(0, totalTables - occupiedCount));

    } catch (err) {
      console.error('Failed to update parked orders count', err);
    }
  };

  // Cache-on-Demand: When user clicks/adds a product from online search,
  // persist it to IndexedDB + React state so it stays available offline
  const handleCacheProduct = async (product) => {
    try {
      // Save to IndexedDB (upsert)
      await db.products.put(product);
      // Add to React state if not already present
      setProducts(prev => {
        if (prev.some(p => p.id === product.id)) return prev;
        return [...prev, product];
      });
    } catch (err) {
      console.error('[YeePOS] Failed to cache product:', err);
    }
  };

  const handleCacheCustomer = async (customer) => {
    try {
      await db.customers.put(customer);
      setCustomers(prev => {
        if (prev.some(c => c.id === customer.id)) return prev;
        return [...prev, customer];
      });
    } catch (err) {
      console.error('[YeePOS] Failed to cache customer:', err);
    }
  };

  const handleCacheOrder = async (order) => {
    try {
      await db.orders.put(order);
    } catch (err) {
      console.error('[YeePOS] Failed to cache order:', err);
    }
  };

  const handleCheckout = async (checkoutData) => {
    if (!checkoutData) return;
    
    // 1. Generate Local Identity first for Offline-First reliability. 
    // Re-use existing ID if updating an already created pending/parked order.
    const localId = checkoutData.id || resumingOrderId || `offline-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const isOnlinePayment = String(checkoutData.paymentMethod).toLowerCase() === 'online_checkout';
    
    // Inject cashier meta_data
    const meta_data = [
      ...(checkoutData.meta_data || []),
      { key: '_yeepos_cashier_id', value: currentUser?.id },
      { key: '_yeepos_cashier_name', value: currentUser?.display_name || currentUser?.user_email },
      { key: '_yeepos_store_id', value: selectedStore?.id },
      { key: '_yeepos_register_name', value: selectedRegister?.name }
    ];

    // Map customer details for local storage
    const selectedCustomer = checkoutData.customerId ? customers.find(c => c.id.toString() === checkoutData.customerId) : null;
    const customerName = selectedCustomer ? `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim() : (checkoutData.customerName || 'Walk-in Customer');
    const customerEmail = selectedCustomer ? selectedCustomer.email : (checkoutData.customerEmail || '');
    const customerPhone = selectedCustomer ? (selectedCustomer.billing?.phone || selectedCustomer.phone) : (checkoutData.customerPhone || '');

    // Prepare initial local order object
    const localOrderData = {
      ...checkoutData,
      id: localId,
      customerName,
      customerEmail,
      customerPhone,
      items: checkoutData.items.map(i => ({
        ...i,
        id: i.id || `local-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
      })),
      status: checkoutData.status || (isOnlinePayment ? 'pending' : 'completed'),
      date: new Date(),
      syncStatus: 0,
      meta_data
    };

    // 2. SAVE LOCALLY IMMEDIATELY
    console.log("[YeePOS] Saving order locally first...", localId);
    await db.orders.put(localOrderData);

    // 3. OFFLINE PAYMENT BRANCH (Non-blocking)
    if (!isOnlinePayment) {
      console.log("[YeePOS] Offline-First: Finalizing UI and syncing in background.");
      
      // Finalize POS UI State
      setLastCreatedOrder(localOrderData);
      clearCart();
      if (resumingOrderId && resumingOrderId !== localId) {
         await db.orders.delete(resumingOrderId);
      }
      updateParkedOrdersCount();

      // Trigger background sync WITHOUT await
      setTimeout(() => {
        syncPendingOrdersInternal().catch(e => console.warn('[YeePOS] BG Sync failed:', e));
      }, 1000);

      return localOrderData;
    }

    // 4. ONLINE PAYMENT BRANCH (Blocking - needs payment_url)
    try {
      console.log("[YeePOS] Online Payment: Waiting for server response...");
      
      // Determine if we are updating an existing remote order
      const targetOrderId = checkoutData.id || resumingOrderId;
      const isUpdatingRemoteOrder = targetOrderId && !String(targetOrderId).toLowerCase().startsWith('parked') && !String(targetOrderId).toLowerCase().startsWith('offline');

      const remoteOrder = await createWooOrder({ ...checkoutData, meta_data }, isUpdatingRemoteOrder ? targetOrderId : null);
      
      // Build order data to return to UI (for iframe payment URL)
      const updatedOrder = {
        ...localOrderData,
        id: remoteOrder.id,
        remote_id: remoteOrder.id,
        syncStatus: 1,
        order_key: remoteOrder.order_key,
        payment_url: remoteOrder.payment_url,
        status: remoteOrder.status
      };
      
      // Delete temp local record — the order now lives on the server.
      // Do NOT save back to IndexedDB to avoid "pending" orders piling up
      // in Parked Orders every time the user retries online payment.
      await db.orders.delete(localId);
      
      if (resumingOrderId && resumingOrderId !== localId) {
        await db.orders.delete(resumingOrderId);
      }
      
      updateParkedOrdersCount();
      return updatedOrder;
      
    } catch (error) {
      console.error('[YeePOS] Online Checkout Failed:', error);
      // Even if online fails, the order is still in IndexedDB with syncStatus 0
      // We can redirect the user back to the cart or show a sync warning.
      toast.error(t('checkout.online_error_fallback'));
      throw error;
    }
  };

  const handleSaveOrder = async () => {
    if (cart.length === 0) return;

    // Clear old order if it was a resume
    if (resumingOrderId) {
      await db.orders.delete(resumingOrderId);
    }

    await db.orders.put({
      items: [...cart],
      total: getCartTotal(),
      status: originalOrderMetadata?.status || 'parked',
      table: originalOrderMetadata?.table || null,
      _yeepos_table_number: originalOrderMetadata?._yeepos_table_number || null,
      serviceType: originalOrderMetadata?.serviceType || 'takeaway',
      date: new Date(),
      syncStatus: 0,
      id: resumingOrderId || `PARKED-${Date.now()}`
    });

    clearCart();
    updateParkedOrdersCount();
  };

  const handleResumeOrder = async (order) => {
    if (!order || !order.items) {
      toast.error(t('orders.invalid_data'));
      return;
    }

    if (cart.length > 0) {
      if (!confirm(t('orders.cart_replace_confirm'))) return;
    }

    // Standardize items for POS cart
    const standardizedItems = order.items.map(item => {
      // Create a unique cartItemId if missing
      const cartItemId = item.cartItemId || `cart_resumed_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      
      const price = parseFloat(item.price) || 0;
      const quantity = parseInt(item.quantity) || 0;
      
      // If synced from WooCommerce, item.id is the WC line item ID.
      // We need to preserve product_id for lookup and item.id for WC updates.
      return {
        ...item,
        cartItemId,
        id: item.id, // WC item_id if synced, or product_id if local
        product_id: item.product_id || item.id,
        price: price,
        quantity: quantity,
        total: item.total ? parseFloat(item.total) : (price * quantity),
        basePrice: item.basePrice || price
      };
    });

    setCart(standardizedItems);
    setLastCreatedOrder(null);
    setResumingOrderId(order.id, {
      table: order.table,
      _yeepos_table_number: order._yeepos_table_number,
      serviceType: order.serviceType,
      status: order.status,
      customer_id: order.customer_id,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone
    });
    updateParkedOrdersCount();
    setView('sale');
  };

  const handleTransferTable = async (orderId, newTable) => {
    try {
      await db.orders.update(orderId, { table: newTable });
      // If it's a synced order, we'd ideally sync the metadata too, 
      // but for now local update is critical for Dashboard.
      return true;
    } catch (err) {
      console.error('Failed to transfer table', err);
      return false;
    }
  };

  const handleDeleteOrder = async (orderId, skipConfirm = false) => {
    // skipConfirm parameter kept for interface compatibility, but ignored as per user request to always skip
    await db.orders.delete(orderId);
    updateParkedOrdersCount();
    return true;
  };

  const formatPrice = (price) => {
    const { currency, currencyPos, thousandSep, decimalSep, numDecimals } = priceFormatConfig;
    
    // Get currency symbol or fallback
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

  return (
    <>
      {!currentUser ? (
        <LoginView 
          onLoginSuccess={handleLoginSuccess} 
          posSettings={posSettings}
          setPosSettings={setPosSettings}
        />
      ) : (setupProgress) ? (
        <InitialSetupLoader progress={setupProgress.percent} message={setupProgress.message} />
      ) : (window.yeePOSData?.activeModules?.branchActive && !selectedStore) ? (
        <StoreSelector stores={stores} onSelect={handleSelectStore} />
      ) : (window.yeePOSData?.activeModules?.branchActive && selectedStore && !selectedRegister) ? (
        <RegisterSelector 
          store={selectedStore} 
          onSelect={handleSelectRegister} 
          onBack={() => {
            setSelectedStore(null);
            localStorage.removeItem('pos_selected_store');
          }}
        />
      ) : (
        <div className="flex flex-col md:flex-row h-[100dvh] w-full bg-[#0A0A0E] overflow-hidden text-gray-300 antialiased font-sans">
          {/* Desktop Sidebar */}
          <div className="hidden md:flex">
            <Sidebar 
              view={view} 
              setView={setView} 
              freeTablesCount={freeTablesCount}
              newOnlineOrdersCount={newOnlineOrdersCount}
              onViewOrders={() => setNewOnlineOrdersCount(0)}
              isCollapsed={isSidebarCollapsed}
              onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              selectedStore={selectedStore}
              selectedRegister={selectedRegister}
            />
          </div>
          
          <main className="flex-1 flex flex-col relative overflow-hidden bg-[#0a0a0e]">
            {/* Feature Views */}
            {view === 'sale' ? (
              <SaleView 
                products={products} 
                categories={categories}
                customers={customers}
                paymentGateways={paymentGateways}
                loading={loading} 
                addToCart={addToCart} 
                formatPrice={formatPrice} 
                cart={cart}
                removeFromCart={removeFromCart}
                updateQuantity={updateQuantity}
                updatePrice={updatePrice}
                updateItemDetails={updateItemDetails}
                getCartTotal={getCartTotal}
                clearCart={clearCart}
                handleCheckout={handleCheckout}
                handleSaveOrder={handleSaveOrder}
                handleResumeOrder={handleResumeOrder}
                handleDeleteOrder={handleDeleteOrder}
                handleSync={loadInitialData}
                taxConfig={taxConfig}
                lastCreatedOrder={lastCreatedOrder}
                setLastCreatedOrder={setLastCreatedOrder}
                resumingOrderId={resumingOrderId}
                originalOrderMetadata={originalOrderMetadata}
                parkedOrdersCount={parkedOrdersCount}
                shopSettings={shopSettings}
                posSettings={posSettings}
                selectedRegister={selectedRegister}
                tables={tables}
                cfd={cfd}
                onCacheProduct={handleCacheProduct}
                onNavigate={setView}
                // Pass the auto-open state
                initialCheckoutOpen={shouldOpenCheckoutOnResume}
                setInitialCheckoutOpen={setShouldOpenCheckoutOnResume}
                couponsEnabled={couponsEnabled}
                // Scanner controls
                onToggleScanner={() => setIsBarcodeModalOpen(!isBarcodeModalOpen)}
              />
            ) : view === 'reports' ? (
              <ReportsView formatPrice={formatPrice} />
            ) : view === 'settings' ? (
              <SettingsView 
                shopSettings={shopSettings}
                posSettings={posSettings}
                setPosSettings={setPosSettings}
                currentUser={currentUser}
                selectedRegister={selectedRegister}
                isBranchActive={isBranchActive}
                handleSync={loadInitialData}
                handleClearData={handleClearLocalData}
                handleLogout={handleLogout}
                onCloseRegister={handleCloseRegister}
                isSyncing={isManualSyncing}
                lastSyncTime={lastSyncTime}
              />
            ) : view === 'tables' ? (
              <TableDashboard 
                formatPrice={formatPrice}
                onResumeOrder={(order) => {
                  handleResumeOrder(order);
                  setView('sale');
                }}
                onCheckoutOrder={(order) => {
                  handleResumeOrder(order);
                  setShouldOpenCheckoutOnResume(true);
                  setView('sale');
                }}
                onTransferTable={handleTransferTable}
                onClearTable={(id) => handleDeleteOrder(id, true)}
                tables={tables}
              />
            ) : view === 'orders' ? (
              <OrdersView 
                formatPrice={formatPrice} 
                shopSettings={posSettings} 
                onOrderRead={refreshNewOrdersCount} // Sync badge when order is read
                onResumeOrder={(order) => handleResumeOrder(order)}
                onCacheOrder={handleCacheOrder}
              />
            ) : view === 'customers' ? (
              <CustomersView 
                customers={customers} 
                loading={loading} 
                selectedCustomer={selectedCustomer}
                setSelectedCustomer={setSelectedCustomer}
                refreshCustomers={loadInitialData}
                countries={countries}
                onCacheCustomer={handleCacheCustomer}
              />
            ) : (
              <ProductsView 
                products={products}
                categories={categories}
                loading={loading}
                selectedProduct={selectedProduct}
                setSelectedProduct={setSelectedProduct}
                refreshProducts={loadInitialData}
                formatPrice={formatPrice}
                onCacheProduct={handleCacheProduct}
              />
            )}

            {/* Mobile Navigation */}
            <MobileNav 
              view={view} 
              setView={setView} 
              onOpenScanner={() => setIsBarcodeModalOpen(true)}
              isBranchActive={isBranchActive}
              onCloseRegister={handleCloseRegister}
              selectedRegister={selectedRegister}
            />
          </main>
        </div>
      )}

      {/* Global Modals */}
      {isBarcodeModalOpen && (
        <BarcodeScannerModal 
          onClose={() => setIsBarcodeModalOpen(false)}
          onScan={(code) => {
             // We can handle global scan here if needed
             // For now, let SaleView handle it or pass to SaleView
             window.dispatchEvent(new CustomEvent('yeepos_barcode_scan', { detail: code }));
          }}
          formatPrice={formatPrice}
        />
      )}

      {isClosingReportOpen && (
        <ClosingReportModal 
          data={sessionSummary}
          formatPrice={formatPrice}
          showNotes={selectedRegister?.enable_final_notes === 'yes'}
          onConfirm={(note) => {
            setIsClosingReportOpen(false);
            if (closingCallback) closingCallback(note);
          }}
          onCancel={() => {
            setIsClosingReportOpen(false);
            setClosingCallback(null);
          }}
        />
      )}
    </>
  );
}

export default App;
