import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../utils/i18n';

export function ClosingReportModal({ data, onConfirm, onCancel, formatPrice, showNotes }) {
  const { t } = useTranslation();
  const [note, setNote] = useState('');

  if (!data) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-300">
      <div className="bg-[#141419] w-full max-w-lg rounded-[32px] border border-[#2C2C35] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <header className="px-8 py-6 border-b border-[#2C2C35] flex justify-between items-center bg-[#141419] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--brand-primary)]/10 flex items-center justify-center">
              <span className="material-icons-outlined text-[var(--brand-primary)]">assignment</span>
            </div>
            <div>
              <h2 className="text-white font-black text-sm uppercase tracking-[0.1em]">{t('reports.closing_report')}</h2>
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">{t('reports.session_summary')}</p>
            </div>
          </div>
          <button onClick={onCancel} className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:bg-white/5 hover:text-white transition-all">
            <span className="material-icons-outlined">close</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {/* Main Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-[#1A1A20] p-5 rounded-2xl border border-[#2C2C35] col-span-2">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-1">{t('reports.total_sales')}</p>
                <p className="text-3xl font-black text-white">{formatPrice(data.total_sales)}</p>
             </div>
             <div className="bg-[#1A1A20] p-5 rounded-2xl border border-[#2C2C35]">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-1">{t('reports.order_count')}</p>
                <p className="text-xl font-black text-white">{data.order_count}</p>
             </div>
             <div className="bg-[#1A1A20] p-5 rounded-2xl border border-[#2C2C35]">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-1">{t('reports.tax_total')}</p>
                <p className="text-xl font-black text-white">{formatPrice(data.tax_total)}</p>
             </div>
             <div className="bg-[#1A1A20] p-5 rounded-2xl border border-[#2C2C35]">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-1">{t('reports.discount_total')}</p>
                <p className="text-xl font-black text-white">{formatPrice(data.discount_total)}</p>
             </div>
          </div>

          {/* Payment Breakdown */}
          <div className="space-y-4">
             <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">{t('reports.payment_breakdown')}</h3>
             <div className="bg-[#1A1A20] rounded-2xl border border-[#2C2C35] divide-y divide-[#2C2C35]">
                {Object.entries(data.payment_methods).map(([method, amount]) => (
                  <div key={method} className="p-4 flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-300">{method}</span>
                    <span className="text-sm font-bold text-white">{formatPrice(amount)}</span>
                  </div>
                ))}
                {Object.keys(data.payment_methods).length === 0 && (
                  <div className="p-8 text-center text-gray-500 italic text-xs">
                    {t('reports.no_payments')}
                  </div>
                )}
             </div>
          </div>

          {/* Final Notes Field */}
          {showNotes && (
            <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-500">
               <div className="flex items-center gap-2">
                 <span className="material-icons-outlined text-sm text-gray-500">notes</span>
                 <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">{t('reports.closing_note', 'Final Notes')}</h3>
               </div>
               <textarea 
                 value={note}
                 onChange={(e) => setNote(e.target.value)}
                 placeholder={t('reports.closing_note_placeholder', 'Enter any observations or notes for this shift...')}
                 rows="3"
                 className="w-full bg-[#1A1A20] border border-[#2C2C35] rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-[var(--brand-primary)] transition-all resize-none custom-scrollbar"
               />
            </div>
          )}

          {/* Meta Info */}
          <div className="bg-blue-500/5 p-4 rounded-2xl border border-blue-500/20 flex gap-4">
             <span className="material-icons-outlined text-blue-500 text-sm">schedule</span>
             <div className="space-y-1">
                <p className="text-blue-500/80 text-[10px] font-black uppercase tracking-wider">Session Interval</p>
                <p className="text-xs text-gray-400 font-medium">
                  {new Date(data.login_time * 1000).toLocaleString()} — {new Date(data.logout_time * 1000).toLocaleString()}
                </p>
             </div>
          </div>
        </div>

        <footer className="p-8 bg-[#1A1A20] shrink-0 border-t border-[#2C2C35] flex gap-4">
           <button 
             onClick={onCancel}
             className="flex-1 h-14 rounded-2xl bg-[#2C2C35] text-white text-sm font-black uppercase tracking-widest hover:bg-[#363640] transition-colors"
           >
             {t('common.cancel')}
           </button>
           <button 
             onClick={() => onConfirm(note)}
             className="flex-1 h-14 rounded-2xl bg-[var(--brand-primary)] text-white text-sm font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-[0_8px_30px_rgb(var(--brand-primary-rgb),0.3)]"
           >
             {t('reports.confirm_close')}
           </button>
        </footer>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
