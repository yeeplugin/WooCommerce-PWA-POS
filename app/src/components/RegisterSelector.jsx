import React from 'react';
import { useTranslation } from '../utils/i18n';

export function RegisterSelector({ store, onSelect, onBack }) {
  const { t } = useTranslation();
  const registers = store.registers || [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050505] overflow-y-auto px-4 py-12">
      {/* Animated background subtle gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative w-full max-w-4xl animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-6">
            <span className="material-icons-outlined text-3xl text-indigo-400">desktop_windows</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
            {t('registers.select_title', 'Chọn máy thu ngân')}
          </h1>
          <p className="text-gray-400 text-lg max-w-md mx-auto">
            {t('registers.select_subtitle', 'Bạn đang đăng nhập vào {{store_name}}. Vui lòng chọn máy làm việc.', { store_name: store.name })}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {registers.map((register, index) => {
            const isBusy = !!register.active_user;
            
            return (
              <button
                key={index}
                onClick={() => !isBusy && onSelect(register)}
                style={{ animationDelay: `${index * 100}ms` }}
                disabled={isBusy}
                className={`group relative flex flex-col items-start p-6 border rounded-3xl text-left transition-all duration-300 animate-in slide-in-from-bottom-4 fill-mode-both ${
                  isBusy 
                    ? 'bg-red-500/5 border-red-500/20 cursor-not-allowed' 
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-indigo-500/50 hover:shadow-[0_0_40px_rgba(79,70,229,0.15)]'
                }`}
              >
                <div className="flex w-full justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl border transition-colors ${
                    isBusy 
                      ? 'bg-red-500/10 border-red-500/20' 
                      : 'bg-white/5 border-white/10 group-hover:bg-indigo-500/20 group-hover:border-indigo-500/30'
                  }`}>
                    <span className={`material-icons-outlined transition-colors ${
                      isBusy ? 'text-red-400' : 'text-gray-400 group-hover:text-indigo-400'
                    }`}>
                      {isBusy ? 'lock' : 'point_of_sale'}
                    </span>
                  </div>
                  {isBusy && (
                    <span className="px-3 py-1 text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 rounded-full flex items-center gap-1">
                      <span className="material-icons-outlined text-[12px]">person</span>
                      {register.active_user.name}
                    </span>
                  )}
                </div>

                <h3 className={`text-xl font-bold mb-2 transition-colors ${
                  isBusy ? 'text-gray-500' : 'text-white group-hover:text-indigo-300'
                }`}>
                  {register.name}
                </h3>
                
                <p className={`text-sm mb-6 ${isBusy ? 'text-red-400/60' : 'text-gray-500'}`}>
                  {isBusy 
                    ? t('registers.busy', 'Đang được sử dụng')
                    : t('registers.ready', 'Máy đã sẵn sàng phục vụ')}
                </p>
                
                {!isBusy && (
                  <div className="mt-auto w-full flex items-center justify-between text-indigo-400 font-medium">
                    <span className="text-sm opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0 transition-transform">
                      {t('registers.start_working', 'Bắt đầu làm việc')}
                    </span>
                    <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all">
                      <span className="material-icons-outlined">play_arrow</span>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <button 
            onClick={onBack}
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <span className="material-icons-outlined text-sm">arrow_back</span>
            {t('common.back_to_stores', 'Quay lại chọn chi nhánh')}
          </button>
        </div>
      </div>
    </div>
  );
}
