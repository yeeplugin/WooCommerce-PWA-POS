import React from 'react';
import { MenuBtn } from '../components/common/MenuBtn';
import { useTranslation } from '../utils/i18n';

export function Sidebar({ view, setView, freeTablesCount, newOnlineOrdersCount, onViewOrders, isCollapsed, onToggle, selectedStore, selectedRegister }) {
  const { t, isRTL } = useTranslation();
  const isFoodEnabled = window.yeePOSData?.activeModules?.food || false;
  
  return (
    <aside 
      className={`bg-[var(--bg-sidebar)] ${isRTL ? 'border-l' : 'border-r'} border-[var(--border-main)] flex flex-col z-20 shrink-0 transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-14' : 'w-24'}
      `}
    >
      {/* Logo Header */}
      <div 
        className="h-16 bg-[#00a8e8] text-white flex flex-col items-center justify-center cursor-pointer shrink-0" 
        onClick={() => window.location.reload()}
        title={selectedStore?.name || "YeePOS"}
      >
        <div className="flex items-center justify-center font-black tracking-tighter text-2xl">
          <span className={`bg-white text-[#00a8e8] px-1 rounded-sm ${isRTL ? 'ml-[1px]' : 'mr-[1px]'}`}>Y</span>
          {!isCollapsed && "EE"}
        </div>
        {!isCollapsed && selectedStore && (
          <div className="text-[9px] font-bold uppercase tracking-widest opacity-80 mt-[-2px] truncate max-w-[80px]">
            {selectedStore.name}
          </div>
        )}
        {!isCollapsed && selectedRegister && (
          <div className="text-[8px] font-medium uppercase tracking-tight opacity-60 truncate max-w-[80px]">
             {selectedRegister.name}
          </div>
        )}
      </div>
      
      {/* New Order Button */}
      <button 
        onClick={() => setView('sale')} 
        className="w-full h-20 bg-[var(--brand-primary)] hover:bg-[color-mix(in srgb, var(--brand-primary), black 15%)] text-white flex flex-col items-center justify-center gap-1 transition-all shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
      >
        <span className="material-icons-outlined">add</span>
        {!isCollapsed && <span className="text-[10px] font-semibold uppercase tracking-tight">{t('sale.new_order')}</span>}
      </button>

      {/* Main Menu - Scrollable */}
      <div className="flex-1 w-full flex flex-col overflow-y-auto custom-scrollbar">
        <MenuBtn icon={<span className="material-icons-outlined">shopping_cart</span>} label={t('nav.sale')} active={view === 'sale'} onClick={() => setView('sale')} collapsed={isCollapsed} />
        <MenuBtn 
          icon={<span className="material-icons-outlined">receipt_long</span>} 
          label={t('nav.orders')} 
          active={view === 'orders'} 
          onClick={() => { setView('orders'); onViewOrders?.(); }}
          alertBadge={newOnlineOrdersCount}
          collapsed={isCollapsed}
        />
        {isFoodEnabled && (
          <MenuBtn 
            icon={<span className="material-icons-outlined">event_seat</span>} 
            label={t('nav.tables')} 
            active={view === 'tables'} 
            onClick={() => setView('tables')} 
            badge={freeTablesCount}
            collapsed={isCollapsed}
          />
        )}
        <MenuBtn icon={<span className="material-icons-outlined">people_outline</span>} label={t('nav.customers')} active={view === 'customers'} onClick={() => setView('customers')} collapsed={isCollapsed} />
        <MenuBtn icon={<span className="material-icons-outlined">grid_view</span>} label={t('nav.products')} active={view === 'products'} onClick={() => setView('products')} collapsed={isCollapsed} />
        <MenuBtn icon={<span className="material-icons-outlined">analytics</span>} label={t('nav.reports')} active={view === 'reports'} onClick={() => setView('reports')} collapsed={isCollapsed} />
        <MenuBtn icon={<span className="material-icons-outlined">settings</span>} label={t('nav.settings')} active={view === 'settings'} onClick={() => setView('settings')} collapsed={isCollapsed} />
      </div>

      {/* Footer Area */}
      <div className="mt-auto border-t border-[var(--border-main)] bg-[var(--bg-card)] shrink-0">
        <button 
          onClick={() => {
            const url = window.location.origin + window.location.pathname + '?display=customer';
            window.open(url, 'yeepos_customer_display', 'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no');
          }}
          className="w-full py-4 text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 flex flex-col items-center justify-center gap-1 border-b border-[var(--border-main)] transition-colors"
          title={t('nav.terminal')}
        >
          <span className="material-icons-outlined text-[20px]">cast</span>
          {!isCollapsed && <span className="text-[9px] font-bold uppercase tracking-wider">{t('nav.terminal')}</span>}
        </button>

        {/* Toggle Button at the Bottom */}
        <button 
          onClick={onToggle}
          className="w-full py-4 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-page)] flex items-center justify-center transition-colors"
          title={isCollapsed ? t('nav.expand') : t('nav.collapse')}
        >
          <span className="material-icons-outlined text-[20px]">
            {isCollapsed 
              ? (isRTL ? 'arrow_back_ios' : 'arrow_forward_ios') 
              : (isRTL ? 'arrow_forward_ios' : 'arrow_back_ios')}
          </span>
        </button>
      </div>
    </aside>
  );
}
