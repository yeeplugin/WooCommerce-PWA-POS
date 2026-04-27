import React, { useState } from 'react';
import { useTranslation } from '../utils/i18n';

export function MobileNav({ view, setView, onOpenScanner }) {
  const { t, isRTL } = useTranslation();
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const navItems = [
    { id: 'sale', icon: 'shopping_cart', label: t('nav.sale') },
    { id: 'orders', icon: 'receipt_long', label: t('nav.orders') },
    { id: 'scan', icon: 'qr_code_scanner', label: t('nav.scan'), action: onOpenScanner },
    { id: 'customers', icon: 'people_outline', label: t('nav.customers') },
    { id: 'more', icon: 'more_horiz', label: t('nav.more'), action: () => setIsMoreMenuOpen(!isMoreMenuOpen) },
  ];

  const handleNavigate = (id) => {
    setView(id);
    setIsMoreMenuOpen(false);
  };

  return (
    <>
      {/* Backdrop for More Menu */}
      {isMoreMenuOpen && (
        <div 
          className="fixed inset-0 z-[140] bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setIsMoreMenuOpen(false)}
        />
      )}

      {/* More Menu Dropup */}
      {isMoreMenuOpen && (
        <div className="fixed bottom-20 right-4 w-56 bg-[var(--bg-header)] border border-[var(--border-main)] rounded-3xl shadow-2xl z-[150] overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <div className="p-3 space-y-1">
            <button 
              onClick={() => handleNavigate('products')}
              className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${view === 'products' ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--text-main)] hover:bg-[var(--brand-primary)]/10'}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${view === 'products' ? 'bg-white/20' : 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'}`}>
                <span className="material-icons-outlined">inventory_2</span>
              </div>
              <span className="text-xs font-black uppercase tracking-widest">{t('nav.products')}</span>
            </button>

            <button 
              onClick={() => handleNavigate('reports')}
              className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${view === 'reports' ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--text-main)] hover:bg-[var(--brand-primary)]/10'}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${view === 'reports' ? 'bg-white/20' : 'bg-amber-500/10 text-amber-500'}`}>
                <span className="material-icons-outlined">assessment</span>
              </div>
              <span className="text-xs font-black uppercase tracking-widest">{t('nav.reports')}</span>
            </button>

            <div className="h-px bg-[var(--border-main)] my-2 opacity-50" />

            <button 
              onClick={() => handleNavigate('settings')}
              className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${view === 'settings' ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--text-main)] hover:bg-[var(--brand-primary)]/10'}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${view === 'settings' ? 'bg-white/20' : 'bg-gray-500/10 text-gray-500'}`}>
                <span className="material-icons-outlined">settings</span>
              </div>
              <span className="text-xs font-black uppercase tracking-widest">{t('nav.settings')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Bottom Nav Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-[var(--bg-header)] border-t border-[var(--border-main)] flex items-center justify-around z-[100] md:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.1)] safe-area-bottom">
        {navItems.map((item) => {
          const isActive = view === item.id || (item.id === 'more' && ['products', 'reports', 'settings'].includes(view));
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.action) {
                  item.action();
                } else {
                  setView(item.id);
                  setIsMoreMenuOpen(false);
                }
              }}
              className={`flex flex-col items-center justify-center flex-1 gap-1 h-full transition-all relative ${
                isActive 
                  ? 'text-[var(--brand-primary)]' 
                  : 'text-[var(--text-muted)] active:text-[var(--text-main)]'
              }`}
            >
              <span className={`material-icons-outlined text-[24px] transition-transform ${isActive ? 'scale-110' : 'scale-100'}`}>
                {item.id === 'more' && isMoreMenuOpen ? 'close' : item.icon}
              </span>
              <span className="text-[9px] font-black uppercase tracking-tighter">{item.label}</span>
              {isActive && (
                <div className="absolute top-0 w-8 h-1 bg-[var(--brand-primary)] rounded-b-full animate-in fade-in zoom-in duration-300"></div>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
