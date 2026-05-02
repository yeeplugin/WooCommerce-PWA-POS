import React from 'react';
import { useTranslation } from '../utils/i18n';

export function StoreSelector({ stores, onSelect }) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050505] overflow-y-auto px-4 py-12">
      {/* Animated background subtle gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative w-full max-w-4xl animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-6">
            <span className="material-icons-outlined text-3xl text-indigo-400">storefront</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
            {t('stores.select_title', 'Chọn chi nhánh làm việc')}
          </h1>
          <p className="text-gray-400 text-lg max-w-md mx-auto">
            {t('stores.select_subtitle', 'Vui lòng chọn cửa hàng bạn sẽ thực hiện giao dịch hôm nay.')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {stores.map((store, index) => (
            <button
              key={store.id}
              onClick={() => onSelect(store)}
              style={{ animationDelay: `${index * 100}ms` }}
              className="group relative flex flex-col items-start p-6 bg-white/5 border border-white/10 rounded-3xl text-left transition-all duration-300 hover:bg-white/10 hover:border-indigo-500/50 hover:shadow-[0_0_40px_rgba(79,70,229,0.15)] animate-in slide-in-from-bottom-4 fill-mode-both"
            >
              <div className="flex w-full justify-between items-start mb-4">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 group-hover:bg-indigo-500/20 group-hover:border-indigo-500/30 transition-colors">
                  <span className="material-icons-outlined text-gray-400 group-hover:text-indigo-400 transition-colors">place</span>
                </div>
                {store.is_main && (
                  <span className="px-3 py-1 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1.5">
                    <span className="material-icons-outlined text-[14px]">verified</span>
                    {t('stores.main_store', 'Trụ sở chính')}
                  </span>
                )}
              </div>

              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-300 transition-colors">
                {store.name}
              </h3>
              
              {store.address && (
                <p className="text-gray-400 text-sm mb-6 line-clamp-2 min-h-[40px]">
                  {store.address}
                </p>
              )}
              
              <div className="mt-auto w-full flex items-center justify-between text-indigo-400 font-medium">
                <span className="text-sm opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0 transition-transform">
                  {t('stores.access_now', 'Truy cập ngay')}
                </span>
                <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all">
                  <span className="material-icons-outlined">arrow_forward</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-500 text-sm">
            {t('stores.logged_in_as', 'Đăng nhập với tư cách:')} <span className="text-gray-300 font-medium">{window.yeePOSData?.currentUser?.display_name}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
