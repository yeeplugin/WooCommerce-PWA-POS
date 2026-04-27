import React, { useState } from 'react';
import { useTranslation } from '../../utils/i18n';

export function DiscountSelectorModal({ onClose, onSelect, currentDiscount, totalBeforeDiscount, formatPrice }) {
  const { t } = useTranslation();
  const [type, setType] = useState('fixed'); // 'fixed' or 'percent'
  const [value, setValue] = useState('');

  const quickOptions = [
    { label: '5%', value: 5, type: 'percent' },
    { label: '10%', value: 10, type: 'percent' },
    { label: '15%', value: 15, type: 'percent' },
    { label: '20%', value: 20, type: 'percent' },
    { label: '50%', value: 50, type: 'percent' },
  ];

  const handleApply = () => {
    const numValue = parseFloat(value) || 0;
    let discountAmount = 0;
    
    if (type === 'percent') {
      discountAmount = (totalBeforeDiscount * numValue) / 100;
    } else {
      discountAmount = numValue;
    }

    // Cap at total amount
    discountAmount = Math.min(discountAmount, totalBeforeDiscount);

    onSelect(discountAmount);
  };

  return (
    <div className="absolute inset-0 bg-[#0E0E12] z-[70] flex flex-col animate-in slide-in-from-bottom duration-300">
      <header className="h-16 px-6 border-b border-[#2C2C35] flex items-center justify-between bg-[#141419] shrink-0">
        <h2 className="text-white font-black text-sm uppercase tracking-widest">{t('discount.select_title')}</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
          <span className="material-icons-outlined">close</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto w-full p-6 space-y-8">
        {/* Type Toggle */}
        <div className="flex bg-[#1A1A20] p-1 rounded-xl border border-[#2C2C35]">
          <button 
            onClick={() => setType('fixed')}
            className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${type === 'fixed' ? 'bg-[var(--brand-primary)] text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {t('discount.amount')}
          </button>
          <button 
            onClick={() => setType('percent')}
            className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${type === 'percent' ? 'bg-[var(--brand-primary)] text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {t('discount.percentage')}
          </button>
        </div>

        {/* Input Area */}
        <div className="bg-[#000000] rounded-2xl p-6 border border-[#2C2C35]/50 shadow-inner group transition-all hover:border-[var(--brand-primary)]/50">
          <div className="flex justify-between items-center mb-2">
             <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--brand-primary)]">{t('discount.enter_value')}</label>
             <div className="text-[var(--brand-primary)] opacity-30"><span className="material-icons-outlined">{type === 'percent' ? 'percent' : 'payments'}</span></div>
          </div>
          <div className="relative flex items-center justify-end">
            <div className="text-[var(--brand-primary)] text-2xl font-black mr-2">
              {type === 'percent' ? '%' : (formatPrice(0).replace(/[0-9.,\s]/g, '') || '$')}
            </div>
            <input 
              type="number" 
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0"
              className="w-full bg-transparent border-none p-0 text-4xl font-black text-white text-right outline-none placeholder-[#1A1A20] tabular-nums"
              autoFocus
            />
          </div>
        </div>

        {/* Quick Options */}
        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">{t('discount.quick_options')}</label>
          <div className="grid grid-cols-5 gap-2">
            {quickOptions.map((opt) => (
              <button 
                key={opt.label}
                onClick={() => {
                  setType(opt.type);
                  setValue(opt.value.toString());
                }}
                className="py-3 rounded-xl bg-[#1A1A20] border border-[#2C2C35] text-white text-xs font-bold hover:bg-[var(--brand-primary)] hover:border-[var(--brand-primary)] transition-all active:scale-95"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        {value && (
          <div className="p-4 rounded-xl bg-[var(--brand-primary)]/5 border border-[var(--brand-primary)]/20 flex justify-between items-center animate-in fade-in zoom-in-95 duration-200">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-primary)]">{t('discount.summary_label')}</span>
            <span className="text-xl font-black text-white tabular-nums">
              {formatPrice(type === 'percent' ? (totalBeforeDiscount * parseFloat(value) / 100) || 0 : parseFloat(value) || 0)}
            </span>
          </div>
        )}
      </div>

      <footer className="h-20 px-6 border-t border-[#2C2C35] flex items-center gap-4 shrink-0 bg-[#0E0E12]">
         <button 
          onClick={() => onSelect(0)}
          className="flex-1 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all"
         >
            {t('discount.none')}
         </button>
         <button 
          onClick={handleApply}
          className="flex-[2] bg-[var(--brand-primary)] hover:bg-[color-mix(in srgb, var(--brand-primary), black 15%)] text-white py-4 rounded-xl flex items-center justify-center gap-2 font-black uppercase text-xs tracking-widest transition-all shadow-[0_10px_20px_rgba(14,165,233,0.2)]"
         >
            {t('discount.apply')}
         </button>
      </footer>
    </div>
  );
}
