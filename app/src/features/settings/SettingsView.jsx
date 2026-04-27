import React, { useState, useEffect } from 'react';
import { db } from '../../db/indexedDB';
import { useTranslation } from '../../utils/i18n';

export function SettingsView({ 
  shopSettings, 
  posSettings, 
  setPosSettings, 
  currentUser,
  handleSync, 
  handleClearData,
  handleLogout,
  isSyncing,
  lastSyncTime
}) {
  const { t, language, changeLanguage } = useTranslation();
  const isOnline = navigator.onLine;
  const [failedOrdersCount, setFailedOrdersCount] = useState(0);

  useEffect(() => {
    const checkFailedOrders = async () => {
      const count = await db.orders.where('syncStatus').equals(2).count();
      setFailedOrdersCount(count);
    };
    checkFailedOrders();
    
    // Refresh count when coming back to view
    const timer = setInterval(checkFailedOrders, 30000);
    return () => clearInterval(timer);
  }, []);

  const toggleAutoPrint = () => {
    setPosSettings(prev => ({ ...prev, autoPrint: !prev.autoPrint }));
  };

  const toggleForceOffline = () => {
    setPosSettings(prev => ({ ...prev, forceOffline: !prev.forceOffline }));
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-page)] overflow-hidden">
      <header className="h-16 border-b border-[var(--border-main)] flex items-center justify-between px-4 md:px-8 bg-[var(--bg-header)] shrink-0">
        <div className="flex items-center gap-3">
          <span className="material-icons-outlined text-[var(--brand-primary)]">settings</span>
          <h2 className="text-[var(--text-main)] font-black text-sm uppercase tracking-[0.2em]">{t('settings.title')}</h2>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-hide">
        <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
           {/* User Profile Section */}
           {currentUser && (
             <section className="space-y-4">
               <h3 className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] ml-2">{t('settings.staff_profile')}</h3>
               <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row items-center gap-6 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity hidden md:block">
                     <span className="material-icons-outlined text-8xl text-[var(--text-main)]">badge</span>
                  </div>
                  <div className="relative">
                     <img 
                       src={currentUser.avatar} 
                       alt={currentUser.display_name} 
                       className="w-16 h-16 md:w-20 md:h-20 rounded-full border-2 border-[var(--brand-primary)] shadow-lg shadow-[var(--brand-primary)]/20"
                     />
                     <div className="absolute -bottom-1 -right-1 w-5 h-5 md:w-6 md:h-6 bg-green-500 rounded-full border-4 border-[var(--bg-card)]"></div>
                  </div>
                  <div className="flex-1 space-y-1 text-center md:text-left">
                     <h4 className="text-[var(--text-main)] font-black text-xl md:text-2xl tracking-tight">{currentUser.display_name}</h4>
                     <div className="flex flex-col gap-0.5">
                        <span className="text-[var(--text-muted)] text-xs md:text-sm font-medium">{currentUser.user_email}</span>
                        <div className="flex gap-2 mt-1 justify-center md:justify-start">
                           {currentUser.roles.map(role => (
                             <span key={role} className="bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] text-[8px] md:text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border border-[var(--brand-primary)]/20">
                               {role.replace('_', ' ')}
                             </span>
                           ))}
                        </div>
                     </div>
                  </div>
                  <div className="shrink-0 w-full md:w-auto">
                     <button 
                       onClick={handleLogout}
                       className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl md:rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-lg"
                     >
                        <span className="material-icons-outlined text-sm">logout</span>
                        {t('settings.logout')}
                     </button>
                  </div>
               </div>
             </section>
           )}

           {/* Store Details Section */}
           <section className="space-y-4">
             <h3 className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] ml-2">{t('settings.store_details')}</h3>
             <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl md:rounded-3xl p-6 md:p-8 space-y-6 shadow-xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                   <div className="space-y-1">
                      <label className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest">{t('settings.store_name')}</label>
                      <p className="text-[var(--text-main)] font-bold text-lg">{shopSettings.shopName || 'YEEPOS Store'}</p>
                   </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest">{t('settings.store_status')}</label>
                      <div className="flex items-center gap-2">
                         <span className={`w-2 h-2 rounded-full ${posSettings.forceOffline ? 'bg-amber-500 animate-pulse' : (isOnline ? 'bg-green-500' : 'bg-red-500')}`}></span>
                         <span className={`text-[var(--text-main)] font-black text-xs uppercase tracking-widest`}>
                           {posSettings.forceOffline ? t('settings.status_manual_offline') : (isOnline ? t('settings.status_online') : t('settings.status_offline'))}
                         </span>
                      </div>
                   </div>
                   <div className="space-y-1 col-span-full">
                      <label className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest">{t('settings.store_address')}</label>
                      <p className="text-[var(--text-muted)] text-sm">{shopSettings.shopAddress || 'Not set in WooCommerce'}</p>
                   </div>
                </div>
             </div>
           </section>

           {/* Device & Printing Section */}
           <section className="space-y-4">
             <h3 className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] ml-2">{t('settings.hardware')}</h3>
             <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-xl">
                <div className="flex items-center justify-between">
                   <div className="space-y-1 pr-4">
                      <h4 className="text-[var(--text-main)] font-bold text-sm md:text-base">{t('settings.auto_print')}</h4>
                      <p className="text-[var(--text-muted)] text-[10px] md:text-xs">{t('settings.auto_print_desc')}</p>
                   </div>
                   <button 
                     onClick={toggleAutoPrint}
                     className={`w-12 md:w-14 h-7 md:h-8 shrink-0 rounded-full p-1 transition-all duration-300 ${posSettings.autoPrint ? 'bg-[var(--brand-primary)]' : 'bg-[var(--border-main)]'}`}
                   >
                     <div className={`w-5 h-5 md:w-6 md:h-6 bg-[var(--bg-page)] rounded-full shadow-md transition-all duration-300 transform ${posSettings.autoPrint ? 'translate-x-5 md:translate-x-6' : 'translate-x-0'}`}></div>
                   </button>
                </div>

                <div className="h-px bg-[var(--border-main)] my-4 md:my-6 opacity-30" />

                <div className="flex items-center justify-between">
                   <div className="space-y-1 pr-4">
                      <h4 className="text-[var(--text-main)] font-bold text-sm md:text-base">{t('settings.manual_offline')}</h4>
                      <p className="text-[var(--text-muted)] text-[10px] md:text-xs text-balance">{t('settings.manual_offline_desc')}</p>
                   </div>
                   <button 
                     onClick={toggleForceOffline}
                     className={`w-12 md:w-14 h-7 md:h-8 shrink-0 rounded-full p-1 transition-all duration-300 ${posSettings.forceOffline ? 'bg-amber-500' : 'bg-[var(--border-main)]'}`}
                   >
                      <div className={`w-5 h-5 md:w-6 md:h-6 bg-[var(--bg-page)] rounded-full shadow-md transition-all duration-300 transform ${posSettings.forceOffline ? 'translate-x-5 md:translate-x-6' : 'translate-x-0'}`}></div>
                   </button>
                </div>

                <div className="h-px bg-[var(--border-main)] my-4 md:my-6 opacity-30" />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                   <div className="space-y-1">
                      <h4 className="text-[var(--text-main)] font-bold text-sm md:text-base">{t('settings.theme')}</h4>
                      <p className="text-[var(--text-muted)] text-[10px] md:text-xs">{t('settings.theme_desc')}</p>
                   </div>
                   <div className="flex bg-[var(--bg-input)] p-1 rounded-xl border border-[var(--border-main)]">
                      <button 
                        onClick={() => setPosSettings(prev => ({ ...prev, theme: 'light' }))}
                        className={`flex-1 md:flex-none px-3 md:px-4 py-1.5 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${posSettings.theme === 'light' ? 'bg-[var(--brand-primary)] text-white shadow-lg' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                      >
                        {t('settings.theme_light')}
                      </button>
                      <button 
                        onClick={() => setPosSettings(prev => ({ ...prev, theme: 'dark' }))}
                        className={`flex-1 md:flex-none px-3 md:px-4 py-1.5 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${posSettings.theme === 'dark' ? 'bg-[var(--brand-primary)] text-white shadow-lg' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                      >
                        {t('settings.theme_dark')}
                      </button>
                      <button 
                        onClick={() => setPosSettings(prev => ({ ...prev, theme: 'auto' }))}
                        className={`flex-1 md:flex-none px-3 md:px-4 py-1.5 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${posSettings.theme === 'auto' || !posSettings.theme ? 'bg-[var(--brand-primary)] text-white shadow-lg' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                      >
                        {t('settings.theme_auto')}
                      </button>
                   </div>
                </div>

                <div className="h-px bg-[var(--border-main)] my-4 md:my-6 opacity-30" />

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                   <div className="space-y-1">
                      <h4 className="text-[var(--text-main)] font-bold text-sm md:text-base">{t('settings.language')}</h4>
                      <p className="text-[var(--text-muted)] text-[10px] md:text-xs">{t('settings.language_desc')}</p>
                   </div>
                   <div className="flex">
                      <select 
                        value={language}
                        onChange={(e) => changeLanguage(e.target.value)}
                        className="w-full md:w-auto bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--text-main)] text-[10px] font-black uppercase tracking-widest rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand-primary)] cursor-pointer min-w-[160px] shadow-sm appearance-none text-center"
                        style={{ backgroundImage: 'none' }}
                      >
                        {useTranslation().languages.map(lang => (
                          <option key={lang} value={lang} className="bg-[var(--bg-card)] text-[var(--text-main)]">
                            {t(`lang.${lang}`)}
                          </option>
                        ))}
                      </select>
                   </div>
                </div>
             </div>
           </section>

           {/* Data Management Section */}
           <section className="space-y-4">
             <h3 className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] ml-2">{t('settings.data_maintenance')}</h3>
             <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl md:rounded-3xl p-6 md:p-8 space-y-6 shadow-xl">
                <div className="flex flex-col gap-6 border-b border-[var(--border-main)] pb-6">
                   <div className="space-y-1">
                      <h4 className="text-[var(--text-main)] font-bold text-sm md:text-base">{t('settings.cloud_sync')}</h4>
                      <p className="text-[var(--text-muted)] text-[10px] md:text-xs">{t('settings.cloud_sync_desc')}</p>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:flex gap-4 items-end">
                      <div className="flex flex-col gap-1.5 flex-1">
                         <label className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest ml-1">{t('settings.sync_auto')}</label>
                         <select 
                           value={posSettings.autoSyncInterval}
                           onChange={(e) => setPosSettings(prev => ({ ...prev, autoSyncInterval: parseInt(e.target.value) }))}
                           className="bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--text-main)] text-[10px] font-bold rounded-xl px-3 py-2.5 outline-none focus:border-[var(--brand-primary)] cursor-pointer"
                         >
                            <option value="0">{t('settings.sync_off')}</option>
                            <option value="1">{t('settings.sync_1m')}</option>
                            <option value="5">{t('settings.sync_5m')}</option>
                            <option value="10">{t('settings.sync_10m')}</option>
                            <option value="30">{t('settings.sync_30m')}</option>
                            <option value="60">{t('settings.sync_1h')}</option>
                         </select>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-1">
                         <label className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest ml-1">{t('settings.initial_sync_count') || 'Initial Sync'}</label>
                         <select 
                           value={posSettings.initialSyncCount || 100}
                           onChange={(e) => setPosSettings(prev => ({ ...prev, initialSyncCount: parseInt(e.target.value) }))}
                           className="bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--text-main)] text-[10px] font-bold rounded-xl px-3 py-2.5 outline-none focus:border-[var(--brand-primary)] cursor-pointer"
                         >
                            <option value="1">1 {t('settings.sync_per_type') || 'items per type'}</option>
                            <option value="50">50 {t('settings.sync_per_type') || 'items per type'}</option>
                            <option value="100">100 {t('settings.sync_per_type') || 'items per type'}</option>
                            <option value="200">200 {t('settings.sync_per_type') || 'items per type'}</option>
                            <option value="500">500 {t('settings.sync_per_type') || 'items per type'}</option>
                         </select>
                      </div>
                       <button 
                         onClick={handleSync}
                         disabled={isSyncing}
                         className={`w-full lg:w-auto px-6 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 h-[42px] ${
                           isSyncing 
                             ? 'bg-[var(--border-main)] text-[var(--text-muted)] cursor-not-allowed border border-[var(--border-main)]' 
                             : 'bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10'
                         }`}
                       >
                          <span className={`material-icons-outlined text-sm ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
                          {isSyncing ? t('settings.syncing') : t('settings.sync_now')}
                       </button>
                   </div>
                </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1 w-full">
                       <p className="text-[var(--brand-primary)]/80 text-[10px] font-bold flex items-center gap-1.5">
                          <span className="material-icons-outlined text-xs">info</span>
                          {t('settings.sync_info')}
                       </p>
                       
                       <div className="flex flex-col md:flex-row gap-6 md:gap-12 mt-4">
                          <div>
                             <p className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest mb-1">{t('settings.last_sync')}</p>
                             <p className="text-[var(--text-main)] text-[11px] md:text-[12px] font-bold">{lastSyncTime ? lastSyncTime.toLocaleString() : t('settings.sync_never')}</p>
                          </div>
                          {posSettings.autoSyncInterval > 0 && lastSyncTime && (
                           <div>
                              <p className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest mb-1">{t('settings.next_sync')}</p>
                              <p className="text-[var(--brand-primary)] text-[11px] md:text-[12px] font-bold">
                                 {new Date(lastSyncTime.getTime() + posSettings.autoSyncInterval * 60 * 1000).toLocaleString()}
                              </p>
                           </div>
                          )}
                       </div>

                       {failedOrdersCount > 0 && (
                        <div className="mt-6 flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl animate-pulse">
                           <span className="material-icons text-red-500">warning</span>
                           <div className="space-y-0.5">
                              <p className="text-red-500 text-[9px] font-black uppercase tracking-widest">{t('settings.sync_error')}</p>
                              <p className="text-red-400/80 text-[9px]">{t('settings.sync_error_desc', { count: failedOrdersCount })}</p>
                           </div>
                        </div>
                       )}
                    </div>
                </div>
                
                <div className="h-px bg-[var(--border-main)] my-2 opacity-30" />

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                   <div className="space-y-1">
                      <h4 className="text-red-500 font-bold text-sm md:text-base">{t('settings.clear_data')}</h4>
                      <p className="text-[var(--text-muted)] text-[10px] md:text-xs text-balance">{t('settings.clear_data_desc')}</p>
                   </div>
                   <button 
                     onClick={handleClearData}
                     className="w-full md:w-auto px-6 py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                   >
                      <span className="material-icons-outlined text-sm">delete_forever</span>
                      {t('settings.clear_data')}
                   </button>
                </div>
             </div>
           </section>

          <footer className="pt-12 pb-8 text-center border-t border-[var(--border-main)]/30">
             <p className="text-[var(--text-muted)] text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em]">{t('settings.version', { version: '1.2.0' })}</p>
             <p className="text-[var(--text-muted)] text-[9px] md:text-[10px] mt-2 italic opacity-60 px-4">{t('settings.motto')}</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
