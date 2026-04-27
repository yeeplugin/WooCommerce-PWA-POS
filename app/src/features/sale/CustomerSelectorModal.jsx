import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from '../../utils/i18n';
import { searchCustomersOnline } from '../../api/woocommerce';
import { db } from '../../db/indexedDB';

export function CustomerSelectorModal({ customers, onClose, onSelect, onNavigate }) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  
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

        if (newItems.length > 0) {
          await db.customers.bulkPut(newItems);
        }
      } catch (err) {
        console.error('[YeePOS] Online customer search failed in Modal:', err);
      } finally {
        setIsSearchingOnline(false);
      }
    }, 300);

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



  return (
    <div className="absolute inset-0 bg-[#0E0E12] z-[70] flex flex-col animate-in slide-in-from-bottom duration-300">
      <header className="h-16 px-6 border-b border-[#2C2C35] flex items-center justify-between bg-[#141419] shrink-0">
        <h2 className="text-white font-black text-sm uppercase tracking-widest">{t('customers.select_title')}</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
          <span className="material-icons-outlined">close</span>
        </button>
      </header>

      <div className="p-4 border-b border-[#2C2C35] bg-[#0A0A0E]">
        <div className="relative">
          <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">search</span>
          <input 
            type="text" 
            placeholder={t('customers.search_placeholder')} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1A1A20] border border-[#2C2C35] rounded-lg pl-10 pr-10 py-2 text-sm text-white focus:ring-1 focus:ring-[var(--brand-primary)] outline-none"
            autoFocus
          />
          {isSearchingOnline && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 material-icons-outlined animate-spin text-[var(--brand-primary)] text-[16px]">sync</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto w-full p-2 space-y-1">
        {/* Default Guest Option */}
        <div 
          onClick={() => onSelect(null)}
          className="flex items-center gap-4 p-4 rounded-xl hover:bg-[#1A1A20] cursor-pointer transition-all border border-transparent hover:border-[#2C2C35] group"
        >
          <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-500 group-hover:bg-[var(--brand-primary)] group-hover:text-white transition-all">
            <span className="material-icons-outlined">person_outline</span>
          </div>
          <div>
            <h4 className="text-white font-bold text-sm">{t('customers.guest')}</h4>
            <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold">{t('customers.standard_account')}</p>
          </div>
        </div>

        {/* Dynamic Customers List */}
        {filteredCustomers.map(customer => (
          <div 
            key={customer.id} 
            onClick={() => onSelect(customer)}
            className="flex items-center gap-4 p-4 rounded-xl hover:bg-[#1A1A20] cursor-pointer transition-all border border-transparent hover:border-[#2C2C35] group"
          >
            <div className="w-10 h-10 rounded-full bg-[var(--brand-primary)]/10 flex items-center justify-center text-[var(--brand-primary)] group-hover:bg-[var(--brand-primary)] group-hover:text-white transition-all font-black text-xs uppercase">
              {customer.first_name?.[0] || customer.username?.[0] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-white font-bold text-sm truncate">
                {customer.first_name} {customer.last_name}
              </h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-gray-500 text-[10px] items-center flex gap-1">
                   <span className="material-icons-outlined">email</span> {customer.email}
                </span>
                {customer.billing?.phone && (
                   <span className="text-gray-500 text-[10px] items-center flex gap-1 ml-2">
                     <span className="material-icons-outlined">phone</span> {customer.billing.phone}
                   </span>
                )}
              </div>
            </div>
            <div className="text-gray-800 group-hover:text-[var(--brand-primary)] transition-colors">
              <span className="material-icons-outlined">check_circle_outline</span>
            </div>
          </div>
        ))}

        {filteredCustomers.length === 0 && (
          <div className="py-20 text-center">
            <span className="material-icons-outlined text-gray-800 text-5xl mb-4">person_off</span>
            <p className="text-gray-600 text-sm italic pr-4">{t('customers.no_results')}</p>
          </div>
        )}
      </div>

      <footer className="h-16 px-4 border-t border-[#2C2C35] flex items-center shrink-0">
         <button 
           onClick={() => {
             if (onNavigate) onNavigate('customers');
           }}
           className="w-full bg-[var(--brand-primary)]/10 hover:bg-[var(--brand-primary)] text-[var(--brand-primary)] hover:text-white border border-[var(--brand-primary)]/20 py-2.5 rounded-lg flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest transition-all"
         >
            <span className="material-icons-outlined">person_add</span> {t('customers.add_new')}
         </button>
      </footer>
    </div>
  );
}
