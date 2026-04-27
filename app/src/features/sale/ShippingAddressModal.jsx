import React, { useState } from 'react';
import { useTranslation } from '../../utils/i18n';
import { toast } from '../../utils/toast';

export function ShippingAddressModal({ onClose, onSave, initialData }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(initialData || {
    first_name: '',
    last_name: '',
    phone: '',
    address_1: '',
    address_2: '',
    city: '',
    state: '',
    postcode: '',
    country: 'VN'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    if (!formData.first_name || !formData.address_1) {
      toast.error(t('shipping.validation'));
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#141419] border border-[#2C2C35] rounded-2xl w-full max-w-xl flex flex-col max-h-[90vh] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <header className="px-6 py-5 border-b border-[#2C2C35] flex justify-between items-center bg-[#18181C]">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-[var(--brand-primary)]/10 flex items-center justify-center">
                <span className="material-icons-outlined text-[var(--brand-primary)]">local_shipping</span>
             </div>
             <div>
                <h2 className="text-white font-bold text-lg">{t('shipping.title')}</h2>
                <p className="text-gray-500 text-[11px] uppercase tracking-widest font-medium">{t('shipping.subtitle')}</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-full transition-all">
            <span className="material-icons-outlined font-bold">close</span>
          </button>
        </header>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide bg-[#0A0A0E]">
           
           {/* Recipient Group */}
           <div className="space-y-4">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                 <span className="w-1 h-3 bg-[var(--brand-primary)] rounded-full"></span>
                 {t('shipping.recipient_info')}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                    <label className="text-gray-500 text-[10px] font-bold uppercase ml-1">{t('shipping.first_name')}</label>
                    <input 
                      type="text" 
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleChange}
                      placeholder={t('shipping.placeholder_first_name')}
                      className="w-full bg-[#1A1A20] border border-[#2C2C35] rounded-xl px-4 py-3 text-sm text-white focus:border-[var(--brand-primary)] outline-none transition-all"
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-gray-500 text-[10px] font-bold uppercase ml-1">{t('shipping.last_name')}</label>
                    <input 
                      type="text" 
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleChange}
                      placeholder={t('shipping.placeholder_last_name')}
                      className="w-full bg-[#1A1A20] border border-[#2C2C35] rounded-xl px-4 py-3 text-sm text-white focus:border-[var(--brand-primary)] outline-none transition-all"
                    />
                 </div>
              </div>
              <div className="space-y-1.5">
                 <label className="text-gray-500 text-[10px] font-bold uppercase ml-1">{t('shipping.phone')}</label>
                 <input 
                   type="text" 
                   name="phone"
                   value={formData.phone}
                   onChange={handleChange}
                   placeholder={t('shipping.placeholder_phone')}
                   className="w-full bg-[#1A1A20] border border-[#2C2C35] rounded-xl px-4 py-3 text-sm text-white focus:border-[var(--brand-primary)] outline-none transition-all"
                 />
              </div>
           </div>

           {/* Address Group */}
           <div className="space-y-4">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                 <span className="w-1 h-3 bg-[var(--brand-primary)] rounded-full"></span>
                 {t('shipping.delivery_address')}
              </h3>
              <div className="space-y-3">
                 <div className="space-y-1.5">
                    <label className="text-gray-500 text-[10px] font-bold uppercase ml-1">{t('shipping.address_1')}</label>
                    <input 
                      type="text" 
                      name="address_1"
                      value={formData.address_1}
                      onChange={handleChange}
                      placeholder={t('shipping.placeholder_address_1')}
                      className="w-full bg-[#1A1A20] border border-[#2C2C35] rounded-xl px-4 py-3 text-sm text-white focus:border-[var(--brand-primary)] outline-none transition-all"
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-gray-500 text-[10px] font-bold uppercase ml-1">{t('shipping.address_2')}</label>
                    <input 
                      type="text" 
                      name="address_2"
                      value={formData.address_2}
                      onChange={handleChange}
                      placeholder={t('shipping.placeholder_address_2')}
                      className="w-full bg-[#1A1A20] border border-[#2C2C35] rounded-xl px-4 py-3 text-sm text-white focus:border-[var(--brand-primary)] outline-none transition-all"
                    />
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                    <label className="text-gray-500 text-[10px] font-bold uppercase ml-1">{t('shipping.city')}</label>
                    <input 
                      type="text" 
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder={t('shipping.placeholder_city')}
                      className="w-full bg-[#1A1A20] border border-[#2C2C35] rounded-xl px-4 py-3 text-sm text-white focus:border-[var(--brand-primary)] outline-none transition-all"
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-gray-500 text-[10px] font-bold uppercase ml-1">{t('shipping.state')}</label>
                    <input 
                      type="text" 
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      placeholder={t('shipping.placeholder_state')}
                      className="w-full bg-[#1A1A20] border border-[#2C2C35] rounded-xl px-4 py-3 text-sm text-white focus:border-[var(--brand-primary)] outline-none transition-all"
                    />
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                    <label className="text-gray-500 text-[10px] font-bold uppercase ml-1">{t('shipping.postcode')}</label>
                    <input 
                      type="text" 
                      name="postcode"
                      value={formData.postcode}
                      onChange={handleChange}
                      placeholder={t('shipping.placeholder_postcode')}
                      className="w-full bg-[#1A1A20] border border-[#2C2C35] rounded-xl px-4 py-3 text-sm text-white focus:border-[var(--brand-primary)] outline-none transition-all"
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-gray-500 text-[10px] font-bold uppercase ml-1">{t('shipping.country')}</label>
                    <select 
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                      className="w-full bg-[#1A1A20] border border-[#2C2C35] rounded-xl px-4 py-3 text-sm text-white focus:border-[var(--brand-primary)] outline-none appearance-none"
                    >
                      <option value="VN">{t('shipping.vietnam')}</option>
                      <option value="US">{t('shipping.us')}</option>
                    </select>
                 </div>
              </div>
           </div>
        </div>

        {/* Footer */}
        <footer className="px-6 py-5 bg-[#18181C] border-t border-[#2C2C35] flex justify-end gap-3">
           <button 
             onClick={onClose}
             className="px-6 py-3 text-gray-400 font-bold hover:text-white transition-colors uppercase tracking-widest text-[11px]"
           >
             {t('sale.cancel')}
           </button>
           <button 
             onClick={handleSave}
             className="bg-[var(--brand-primary)] hover:bg-[color-mix(in srgb, var(--brand-primary), black 15%)] text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[11px] shadow-lg shadow-[var(--brand-primary)]/20 transition-all active:scale-95"
           >
             {t('shipping.save')}
           </button>
        </footer>
      </div>
    </div>
  );
}
