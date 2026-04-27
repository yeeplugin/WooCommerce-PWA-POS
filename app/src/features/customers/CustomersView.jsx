import React, { useState, useEffect, useRef, useMemo } from 'react';
import { updateCustomer, createCustomer, searchCustomersOnline } from '../../api/woocommerce';
import { db } from '../../db/indexedDB';
import { TabBtn } from '../../components/common/TabBtn';
import { CField } from '../../components/common/CField';
import { SelectField } from '../../components/common/SelectField';
import { useTranslation } from '../../utils/i18n';

export function CustomersView({ customers, loading, selectedCustomer, setSelectedCustomer, refreshCustomers, countries = [], onCacheCustomer }) {
  const { t, isRTL } = useTranslation();
  const [activeTab, setActiveTab] = useState('general'); // 'general', 'billing', 'shipping'
  const [editStatus, setEditStatus] = useState('idle'); // 'idle', 'saving', 'success', 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [formData, setFormData] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Resize State
  const [sidebarWidth, setSidebarWidth] = useState(() => parseInt(localStorage.getItem('customersSidebarWidth')) || Math.floor(window.innerWidth * 0.4));
  const [isResizing, setIsResizing] = useState(false);

  // Cache-on-Demand state
  const [onlineSearchResults, setOnlineSearchResults] = useState([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Debounced online search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!searchQuery || searchQuery.length < 2 || !navigator.onLine) {
      setOnlineSearchResults([]);
      setIsSearchingOnline(false);
      return;
    }

    setIsSearchingOnline(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchCustomersOnline(searchQuery);
        const localIds = new Set(customers.map(c => c.id));
        const newItems = results.filter(c => c.id && !localIds.has(c.id));
        setOnlineSearchResults(newItems);
      } catch (err) {
        console.error('[YeePOS] Online customer search failed:', err);
      } finally {
        setIsSearchingOnline(false);
      }
    }, 300);

    setCurrentPage(1); // Reset to first page on search change
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, customers]);

  const filteredCustomers = useMemo(() => {
    let result = [...customers];

    if (searchQuery && onlineSearchResults.length > 0) {
      const existingIds = new Set(result.map(c => c.id));
      const newFromOnline = onlineSearchResults.filter(c => !existingIds.has(c.id));
      result = [...result, ...newFromOnline];
    }

    return result.filter(c => {
      const q = searchQuery.toLowerCase();
      return (
        c.first_name?.toLowerCase().includes(q) ||
        c.last_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.username?.toLowerCase().includes(q) ||
        c.billing?.phone?.toLowerCase().includes(q) ||
        c.id?.toString().includes(q)
      );
    });
  }, [customers, onlineSearchResults, searchQuery]);

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    if (selectedCustomer) {
      setFormData({
        first_name: selectedCustomer.first_name || '',
        last_name: selectedCustomer.last_name || '',
        email: selectedCustomer.email || '',
        billing: { ...(selectedCustomer.billing || {}) },
        shipping: { ...(selectedCustomer.shipping || {}) }
      });
      setIsCreating(false);
      setEditStatus('idle');
      setErrorMsg('');
    }
  }, [selectedCustomer]);

  const startNewCustomer = () => {
    setSelectedCustomer(null);
    setIsCreating(true);
    setActiveTab('general');
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      billing: { phone: '', company: '', address_1: '', address_2: '', city: '', postcode: '', state: '', country: '' },
      shipping: { first_name: '', last_name: '', company: '', address_1: '', address_2: '', city: '', postcode: '', state: '', country: '' }
    });
    setEditStatus('idle');
    setErrorMsg('');
  };

  const handleInputChange = (path, value) => {
    const newData = { ...formData };
    if (path.includes('.')) {
      const [main, sub] = path.split('.');
      
      // DEEP CLONE NESTED OBJECT TO AVOID MUTATION
      newData[main] = { ...newData[main] };
      
      // If country changes, clear state
      if (sub === 'country') {
        newData[main]['state'] = '';
      }
      
      newData[main][sub] = value;
    } else {
      newData[path] = value;
    }
    setFormData(newData);
    if (errorMsg) setErrorMsg('');
  };

  const sanitizeCustomerData = (data) => {
    const clean = {
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      email: data.email || '',
    };

    if (data.billing) {
      clean.billing = {};
      const fields = ['first_name', 'last_name', 'company', 'address_1', 'address_2', 'city', 'postcode', 'country', 'state', 'email', 'phone'];
      fields.forEach(f => {
        let val = data.billing[f];
        
        // Fix: Sync billing email with main email if billing email is missing
        if (f === 'email' && !val) {
          val = data.email;
        }
        
        // Only include if value is present and not an empty string for sensitive fields
        if (val !== undefined && val !== null && val !== '') {
          clean.billing[f] = val;
        }
      });
    }

    if (data.shipping) {
      clean.shipping = {};
      const fields = ['first_name', 'last_name', 'company', 'address_1', 'address_2', 'city', 'postcode', 'country', 'state'];
      fields.forEach(f => {
        let val = data.shipping[f];
        if (val !== undefined && val !== null && val !== '') {
          clean.shipping[f] = val;
        }
      });
    }

    return clean;
  };

  const handleSave = async () => {
    if (!formData.email) {
      setErrorMsg(t('customers.email_required'));
      return;
    }
    
    setEditStatus('saving');
    setErrorMsg('');

    try {
      const payload = sanitizeCustomerData(formData);
      console.log('Saving Customer Payload:', payload);

      if (isCreating) {
        // Check if customer with this email already exists
        const exists = customers.find(c => c.email.toLowerCase() === formData.email.toLowerCase());
        if (exists) {
          setErrorMsg(t('customers.email_exists'));
          setEditStatus('error');
          return;
        }

        const newCustomer = await createCustomer(payload);
        setIsCreating(false);
        setEditStatus('success');
        await refreshCustomers();
        setSelectedCustomer(newCustomer);
      } else {
        const updatedCustomer = await updateCustomer(selectedCustomer.id, payload);
        setEditStatus('success');
        await refreshCustomers();
        setSelectedCustomer(updatedCustomer);
      }
      setTimeout(() => setEditStatus('idle'), 3000);
    } catch (err) {
      console.error('Update Customer Error:', err);
      setEditStatus('error');
      setErrorMsg(err.message || t('customers.unexpected_error'));
    }
  };

  const getStates = (countryCode) => {
    const country = countries.find(c => c.code === countryCode);
    return country ? country.states : [];
  };

  const isDetailOpenMobile = (selectedCustomer || isCreating) && window.innerWidth < 1024;

  return (
    <div className="flex-1 flex overflow-hidden bg-[var(--bg-page)] relative">
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
            localStorage.setItem('customersSidebarWidth', sidebarWidth);
          }}
          onMouseLeave={() => {
            setIsResizing(false);
            localStorage.setItem('customersSidebarWidth', sidebarWidth);
          }}
        />
      )}

      {/* Customer List Panel */}
      <div className={`flex-1 flex flex-col min-w-0 bg-[var(--bg-page)] relative transition-all duration-300 ${isDetailOpenMobile ? 'hidden' : 'flex'}`}>
        <header className="h-16 border-b border-[var(--border-main)] flex items-center px-4 gap-4 bg-[var(--bg-header)] shrink-0">
          <div className="relative flex-1">
            <span className={`material-icons-outlined absolute ${isRTL ? 'right-2.5' : 'left-2.5'} top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[18px]`}>search</span>
            <input 
              type="text" 
              placeholder={t('customers.search_placeholder')} 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`w-full bg-[var(--bg-input)] text-[13px] text-[var(--text-main)] rounded ${isRTL ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2 outline-none focus:ring-1 focus:ring-[var(--brand-primary)] border border-[var(--border-main)] placeholder-[var(--text-muted)]`}
            />
            {isSearchingOnline && (
              <span className={`absolute ${isRTL ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 material-icons-outlined animate-spin text-[var(--brand-primary)] text-[16px]`}>sync</span>
            )}
          </div>
          <div className="flex justify-end items-center gap-3">
             <button onClick={() => refreshCustomers()} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)]"><span className="material-icons-outlined">sync</span></button>
          </div>
        </header>

        <div className="h-12 border-b border-[var(--border-main)] flex items-center px-4 justify-between bg-[var(--bg-page)] shrink-0">
           <span className="text-xs font-bold text-[var(--text-muted)] tracking-wider uppercase">{t('customers.list_title')}</span>
           <button onClick={startNewCustomer} className="text-[var(--brand-primary)] hover:text-[color-mix(in srgb, var(--brand-primary), black 15%)] flex items-center gap-1.5 bg-[var(--brand-primary)]/10 px-3 py-1.5 rounded-lg transition-colors">
             <span className="material-icons-outlined text-[18px]">person_add</span>
             <span className="text-[11px] font-bold uppercase tracking-tight">{t('customers.new_btn')}</span>
           </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-16 md:pb-0 bg-[var(--bg-page)] relative flex flex-col scrollbar-hide">
          <div className="flex-1">
            {loading ? (
              <div className="flex justify-center items-center h-48">
                <span className="material-icons-outlined animate-spin text-[var(--brand-primary)]">sync</span>
              </div>
            ) : (
              paginatedCustomers.map(customer => (
                <div 
                  key={customer.id} 
                  onClick={() => {
                    setSelectedCustomer(customer);
                    setIsCreating(false);
                    if (onCacheCustomer) onCacheCustomer(customer);
                  }}
                  className={`p-3 border-b border-[var(--border-main)]/50 cursor-pointer hover:bg-[var(--bg-card)] transition-colors group relative ${selectedCustomer?.id === customer.id ? `bg-[var(--bg-card)] ${isRTL ? 'border-r-4 border-r-[var(--brand-primary)]' : 'border-l-4 border-l-[var(--brand-primary)]'}` : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--bg-input)] flex items-center justify-center text-[var(--text-muted)] group-hover:bg-[var(--brand-primary)]/10 group-hover:text-[var(--brand-primary)] transition-all">
                      <span className="material-icons-outlined text-[20px]">person</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-[var(--text-main)] text-sm truncate group-hover:text-[var(--brand-primary)] transition-colors">
                          {customer.first_name} {customer.last_name}
                        </h3>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">#{customer.id}</span>
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] truncate">{customer.email}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination UI */}
          {!loading && totalPages > 1 && (
            <div className="sticky bottom-0 left-0 right-0 h-12 border-t border-[var(--border-main)] bg-[var(--bg-card)]/90 backdrop-blur-md flex items-center justify-between px-4 shrink-0 z-10">
              <span className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest">
                {currentPage} / {totalPages}
              </span>
              <div className="flex gap-1">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-[var(--border-main)] bg-[var(--bg-input)] text-[var(--text-main)] disabled:opacity-30 transition-all font-bold"
                >
                  <span className="material-icons-outlined text-sm">{isRTL ? 'chevron_right' : 'chevron_left'}</span>
                </button>
                <button 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-[var(--border-main)] bg-[var(--bg-input)] text-[var(--text-main)] disabled:opacity-30 transition-all font-bold"
                >
                  <span className="material-icons-outlined text-sm">{isRTL ? 'chevron_left' : 'chevron_right'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resizer Handle */}
      <div 
        className="w-[1px] relative cursor-col-resize shrink-0 z-20 group bg-[var(--border-main)] hidden lg:block"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
      >
        <div className="absolute inset-y-0 -left-1.5 -right-1.5 cursor-col-resize z-30" />
      </div>

       {/* Customer Detail Panel */}
      <div 
        style={{ width: window.innerWidth < 1024 ? '100%' : `${sidebarWidth}px`, flex: 'none' }} 
        className={`bg-[var(--bg-sidebar)] flex flex-col h-full overflow-hidden ${isDetailOpenMobile ? 'fixed inset-0 z-[120]' : 'hidden lg:flex'}`}
      >
        {(selectedCustomer || isCreating) && formData ? (
           <div className="flex flex-col h-full">
              <header className="p-4 md:p-6 border-b border-[var(--border-main)] flex flex-col gap-4 bg-[var(--bg-sidebar)]">
                  <div className="flex justify-between items-start">
                     <button 
                       onClick={() => { setSelectedCustomer(null); setIsCreating(false); }}
                       className="lg:hidden p-2 -ml-2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                     >
                       <span className="material-icons-outlined">{isRTL ? 'arrow_forward' : 'arrow_back'}</span>
                     </button>
                     <div className="flex gap-2">
                        {isCreating && (
                          <button onClick={() => setIsCreating(false)} className="px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-widest bg-[var(--bg-input)] text-[var(--text-muted)] border border-[var(--border-main)]">{t('customers.cancel_btn')}</button>
                        )}
                        <button 
                          onClick={handleSave}
                          disabled={editStatus === 'saving'}
                          className={`px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all ${editStatus === 'saving' ? 'bg-[var(--bg-input)] text-[var(--text-muted)] opacity-50' : 'bg-[var(--brand-primary)] text-white hover:bg-[color-mix(in srgb, var(--brand-primary), black 15%)]'} shadow-lg`}
                        >
                          {editStatus === 'saving' ? t('customers.saving') : t('customers.save_btn')}
                        </button>
                     </div>
                  </div>
                  <div className="flex gap-4">
                    <div className={`w-12 h-12 md:w-16 md:h-16 rounded-xl flex items-center justify-center text-white text-xl font-bold ${isCreating ? 'bg-amber-500 animate-pulse' : 'bg-[var(--brand-primary)]'}`}>
                      {isCreating ? '?' : (formData.first_name?.[0] || formData.email?.[0] || 'C')}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-lg md:text-xl font-bold text-[var(--text-main)] truncate">{isCreating ? t('customers.new_customer') : `${formData.first_name} ${formData.last_name}`}</h2>
                        <p className="text-[var(--text-muted)] text-[10px] md:text-xs truncate">{isCreating ? t('customers.fill_details') : formData.email}</p>
                    </div>
                  </div>
              </header>

              {errorMsg && (
                <div className="mx-4 md:mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-500 text-[10px] font-bold uppercase tracking-tight animate-shake">
                  <span className="material-icons-outlined text-sm">error_outline</span>
                  {errorMsg}
                </div>
              )}

              <div className="flex px-4 md:px-6 mt-4 gap-4 md:gap-6 border-b border-[var(--border-main)] overflow-x-auto scrollbar-hide">
                 <TabBtn label={t('customers.tab_general')} active={activeTab === 'general'} onClick={() => setActiveTab('general')} />
                 <TabBtn label={t('customers.tab_billing')} active={activeTab === 'billing'} onClick={() => setActiveTab('billing')} />
                 <TabBtn label={t('customers.tab_shipping')} active={activeTab === 'shipping'} onClick={() => setActiveTab('shipping')} />
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-hide">
                {activeTab === 'general' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CField label={t('customers.first_name')} value={formData.first_name} onChange={v => handleInputChange('first_name', v)} />
                    <CField label={t('customers.last_name')} value={formData.last_name} onChange={v => handleInputChange('last_name', v)} />
                    <CField label={t('customers.email')} value={formData.email} onChange={v => handleInputChange('email', v)} />
                    <CField label={t('customers.phone')} value={formData.billing.phone} onChange={v => handleInputChange('billing.phone', v)} />
                  </div>
                )}
                {activeTab === 'billing' && (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <CField label={t('customers.company')} value={formData.billing.company} onChange={v => handleInputChange('billing.company', v)} />
                      <CField label={t('customers.address_1')} value={formData.billing.address_1} onChange={v => handleInputChange('billing.address_1', v)} />
                      <CField label={t('customers.city')} value={formData.billing.city} onChange={v => handleInputChange('billing.city', v)} />
                      <CField label={t('customers.postcode')} value={formData.billing.postcode} onChange={v => handleInputChange('billing.postcode', v)} />
                      <SelectField label={t('customers.country')} value={formData.billing.country} options={countries} onChange={v => handleInputChange('billing.country', v)} />
                      <SelectField label={t('customers.state_county')} value={formData.billing.state} options={getStates(formData.billing.country)} onChange={v => handleInputChange('billing.state', v)} />
                   </div>
                )}
                {activeTab === 'shipping' && (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <CField label={t('customers.first_name')} value={formData.shipping.first_name} onChange={v => handleInputChange('shipping.first_name', v)} />
                      <CField label={t('customers.last_name')} value={formData.shipping.last_name} onChange={v => handleInputChange('shipping.last_name', v)} />
                      <CField label={t('customers.address_1')} value={formData.shipping.address_1} onChange={v => handleInputChange('shipping.address_1', v)} />
                      <CField label={t('customers.city')} value={formData.shipping.city} onChange={v => handleInputChange('shipping.city', v)} />
                      <CField label={t('customers.postcode')} value={formData.shipping.postcode} onChange={v => handleInputChange('shipping.postcode', v)} />
                      <SelectField label={t('customers.country')} value={formData.shipping.country} options={countries} onChange={v => handleInputChange('shipping.country', v)} />
                      <SelectField label={t('customers.state_county')} value={formData.shipping.state} options={getStates(formData.shipping.country)} onChange={v => handleInputChange('shipping.state', v)} />
                   </div>
                )}
              </div>
           </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full opacity-10 filter grayscale">
            <span className="material-icons-outlined mb-4 text-[var(--text-main)] text-5xl">person_search</span>
            <h2 className="text-xl font-bold text-[var(--text-muted)] uppercase tracking-widest">{t('customers.no_customer_selected')}</h2>
          </div>
        )}
      </div>
    </div>
  );
}
