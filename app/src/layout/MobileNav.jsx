import React, { useState } from 'react';
import { useTranslation } from '../utils/i18n';

export function MobileNav({ view, setView, onOpenScanner, isBranchActive, onCloseRegister, selectedRegister }) {
  const { t, isRTL } = useTranslation();
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

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
      {(isMoreMenuOpen || showCloseConfirm) && (
        <div 
          className="fixed inset-0 z-[140] bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => {
            setIsMoreMenuOpen(false);
            setShowCloseConfirm(false);
          }}
        />
      )}

      {/* Custom Confirmation Modal for Mobile */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="relative w-full max-w-sm bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center animate-pulse">
                <span className="material-icons-outlined text-amber-500 text-3xl">power_settings_new</span>
              </div>
              <div className="space-y-2">
                <h4 className="text-[var(--text-main)] font-black text-xl tracking-tight">{t('registers.close_register')}</h4>
                <p className="text-[var(--text-muted)] text-sm">{t('registers.close_register_confirm')}</p>
              </div>
              <div className="flex flex-col w-full gap-3 pt-2">
                <button 
                  onClick={() => {
                    setShowCloseConfirm(false);
                    onCloseRegister();
                  }}
                  className="w-full py-4 bg-amber-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20"
                >
                  {t('common.confirm', 'Xác nhận')}
                </button>
                <button 
                  onClick={() => setShowCloseConfirm(false)}
                  className="w-full py-4 bg-[var(--bg-input)] text-[var(--text-muted)] rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] border border-[var(--border-main)] hover:text-[var(--text-main)] transition-all"
                >
                  {t('common.cancel', 'Hủy bỏ')}
                </button>
              </div>
            </div>
          </div>
        </div>
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

            {isBranchActive && onCloseRegister && (
              <>
                <div className="h-px bg-[var(--border-main)] my-2 opacity-50" />
                <button 
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    if (selectedRegister?.enable_closing_report === 'yes') {
                      onCloseRegister();
                    } else {
                      setShowCloseConfirm(true);
                    }
                  }}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all text-amber-500 hover:bg-amber-500/10"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/10">
                    <span className="material-icons-outlined">power_settings_new</span>
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest">{t('registers.close_register')}</span>
                </button>
              </>
            )}
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
