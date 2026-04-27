import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../utils/i18n';

export function CartItemDetail({ item, onClose, onUpdate, formatPrice, inline = false }) {
  const { t } = useTranslation();
  // Base price starts as the item's base price in store or its current price
  const basePrice = item.basePrice || item.price || 0;
  
  // Local state for quantity and choices
  const [quantity, setQuantity] = useState(item.quantity || 1);
  const [selectedAddons, setSelectedAddons] = useState(item.selectedAddons || []);
  const [fixedDiscount, setFixedDiscount] = useState('0'); 
  const [percentDiscount, setPercentDiscount] = useState('0');
  
  // Calculate price whenever addons change
  const currentPrice = useMemo(() => {
    const addonsTotal = selectedAddons.reduce((sum, addon) => {
      const optionPrice = parseFloat(addon.price) || 0;
      const sizePrice = addon.selectedSize ? (parseFloat(addon.selectedSize.price) || 0) : 0;
      return sum + optionPrice + sizePrice;
    }, 0);
    return basePrice + addonsTotal;
  }, [basePrice, selectedAddons]);

  const fDiscountNum = parseFloat(fixedDiscount) || 0;
  const pDiscountNum = parseFloat(percentDiscount) || 0;

  // Validation: Check if all required groups are satisfied
  const isRequiredSatisfied = useMemo(() => {
    if (!item._yeepos_addons) return true;
    return item._yeepos_addons.every(group => {
      if (Number(group.required) !== 1) return true;
      return selectedAddons.some(a => a.groupName === group.name);
    });
  }, [item._yeepos_addons, selectedAddons]);

  // Group that are required but not yet satisfied
  const unsatisfiedRequiredGroups = useMemo(() => {
    if (!item._yeepos_addons) return [];
    return item._yeepos_addons
      .filter(group => Number(group.required) === 1 && !selectedAddons.some(a => a.groupName === group.name))
      .map(g => g.name);
  }, [item._yeepos_addons, selectedAddons]);

  // Discount states

  const toggleAddon = (group, option) => {
    setSelectedAddons(prev => {
      // Prepare the new addon object, defaulting to the first size if available
      const newAddon = { ...option, groupName: group.name };
      if (option.sizes && option.sizes.length > 0) {
        newAddon.selectedSize = option.sizes[0];
      }

      // If radio type, remove existing choices from same group
      if (group.type === 'radio') {
        const otherGroups = prev.filter(a => a.groupName !== group.name);
        return [...otherGroups, newAddon];
      }
      
      // If checkbox type, toggle
      const exists = prev.find(a => a.name === option.name && a.groupName === group.name);
      if (exists) {
        return prev.filter(a => !(a.name === option.name && a.groupName === group.name));
      } else {
        return [...prev, newAddon];
      }
    });
  };

  const selectSize = (groupName, optionName, size) => {
    setSelectedAddons(prev => prev.map(a => {
      if (a.groupName === groupName && a.name === optionName) {
        return { ...a, selectedSize: size };
      }
      return a;
    }));
  };

  const isAddonSelected = (groupName, optionName) => {
    return selectedAddons.some(a => a.groupName === groupName && a.name === optionName);
  };

  const getSelectedSize = (groupName, optionName) => {
    const addon = selectedAddons.find(a => a.groupName === groupName && a.name === optionName);
    return addon ? addon.selectedSize : null;
  };

  const handleSave = () => {
    if (!isRequiredSatisfied) return;

    const finalPrice = Math.max(0, currentPrice - fDiscountNum);
    
    onUpdate(item.id, {
      quantity: quantity,
      price: finalPrice,
      selectedAddons: selectedAddons
    });
    onClose();
  };

  return (
    <div className={inline 
      ? 'relative flex flex-col bg-[#0E0E12] h-full w-full animate-in fade-in duration-300'
      : 'fixed inset-0 z-[99999] flex flex-col bg-[#0E0E12] animate-in slide-in-from-right duration-300 shadow-2xl'
    }>
        {/* Header Section */}
        <header className="px-6 py-5 border-b border-[#2C2C35] flex items-start gap-4 shrink-0 bg-[#141419]">
           <div className="w-24 h-24 bg-white rounded-[20px] p-1 shrink-0 overflow-hidden border border-[#2C2C35] shadow-inner">
              {item.image ? (
                <img src={typeof item.image === 'object' ? item.image.src : item.image} alt="" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-900">
                   <span className="material-icons-outlined text-gray-700 text-3xl">image</span>
                </div>
              )}
           </div>
           <div className="flex-1 pt-0">
              <h2 className="text-white font-black text-lg leading-tight mb-1 uppercase tracking-tight">{item.name}</h2>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">{t('item.sku')}: {item.sku || 'N/A'}</p>
              <div className="flex items-center gap-2 mt-2">
                {fDiscountNum > 0 && <span className="text-gray-500 line-through text-xs">{formatPrice(currentPrice)}</span>}
                <p className="text-[var(--brand-primary)] font-black text-2xl tracking-tighter">{formatPrice(currentPrice - fDiscountNum)}</p>
              </div>
           </div>
           <button onClick={onClose} className="bg-[#1A1A20] p-2 rounded-full text-gray-500 hover:text-white transition-all hover:scale-110 active:scale-90">
              <span className="material-icons-outlined">close</span>
           </button>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-10 scrollbar-hide pb-32">
           
           {/* Validation Alert */}
           {unsatisfiedRequiredGroups.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3">
                <span className="material-icons-outlined text-red-500">warning</span>
                <p className="text-red-500 text-[11px] font-black uppercase tracking-wider">{t('item.required_options')}: {unsatisfiedRequiredGroups.join(', ')}</p>
              </div>
           )}

           {/* Quantity Section */}
           <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 font-black text-[10px] uppercase tracking-[0.2em]">{t('item.quantity')}</h3>
                <span className="text-[10px] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] px-2 py-0.5 rounded font-black">{t('item.stock')}: {item.stock || 0}</span>
              </div>
              <div className="flex items-center justify-between bg-[#1A1A20] p-5 rounded-[24px] border border-[#2C2C35] shadow-sm">
                 <span className="text-white font-bold text-sm">{t('item.num_items')}</span>
                 <div className="flex items-center bg-[#25252D] rounded-xl p-1.5 border border-[#2C2C35]">
                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-white transition-all hover:bg-white/5 rounded-lg">
                       <span className="material-icons-outlined text-lg">remove</span>
                    </button>
                    <div className="w-14 text-center text-white font-black text-lg tabular-nums">{quantity}</div>
                    <button onClick={() => setQuantity(quantity + 1)} className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-white transition-all hover:bg-white/5 rounded-lg">
                       <span className="material-icons-outlined text-lg">add</span>
                    </button>
                 </div>
              </div>
           </section>

           {/* Dynamic Product Add-ons Selection */}
           {item._yeepos_addons && item._yeepos_addons.length > 0 && (
              <div className="space-y-10">
                {item._yeepos_addons.map((group, gIdx) => (
                  <section key={gIdx} className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className={`font-black text-[10px] uppercase tracking-[0.2em] ${unsatisfiedRequiredGroups.includes(group.name) ? 'text-red-500' : 'text-gray-500'}`}>
                        {group.name} {Number(group.required) === 1 && '*'}
                      </h3>
                      {Number(group.required) === 1 && (
                        <span className="text-red-500 text-[8px] font-black uppercase tracking-widest bg-red-500/10 px-1.5 py-0.5 rounded">{t('item.required')}</span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3">
                      {group.options && group.options.map((option, oIdx) => {
                        const selected = isAddonSelected(group.name, option.name);
                        const currentSize = getSelectedSize(group.name, option.name);
                        
                        return (
                          <div key={oIdx} className="space-y-3">
                            <div 
                              onClick={() => toggleAddon(group, option)} 
                              className={`flex items-center justify-between p-5 rounded-[22px] border transition-all cursor-pointer group hover:scale-[1.01] active:scale-[0.99] ${
                                selected ? 'bg-[var(--brand-primary)]/5 border-[var(--brand-primary)] shadow-[0_0_15px_rgba(14,165,233,0.1)]' : 'bg-[#1A1A20] border-[#2C2C35] hover:border-gray-600'
                              }`}
                            >
                              <div className="flex items-center gap-4">
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                  selected ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] scale-110' : 'border-[#2C2C35] bg-transparent'
                                } Shannon-check-container`}>
                                  {selected && <span className="material-icons-outlined text-white text-[14px]">check</span>}
                                </div>
                                <div className="flex flex-col">
                                  <span className={`text-sm tracking-tight transition-colors ${selected ? 'text-white font-black' : 'text-gray-300 font-bold'}`}>
                                    {option.name}
                                  </span>
                                </div>
                              </div>
                              {option.price && parseFloat(option.price) > 0 && (
                                <span className="text-[var(--brand-primary)] font-black text-xs bg-[var(--brand-primary)]/10 px-2.5 py-1 rounded-lg">
                                  +{formatPrice(parseFloat(option.price))}
                                </span>
                              )}
                            </div>

                            {/* Nested Sizes Selection */}
                            {selected && option.sizes && option.sizes.length > 0 && (
                               <div className="ml-10 p-4 bg-[#0A0A0E] rounded-[18px] border border-[#2C2C35] animate-in fade-in zoom-in-95 duration-200">
                                  <div className="text-gray-500 font-black text-[8px] uppercase tracking-widest mb-3 ml-1">{t('item.select_size')}</div>
                                  <div className="flex flex-wrap gap-2">
                                     {option.sizes.map((size, sIdx) => {
                                        const isSizeSelected = currentSize && currentSize.name === size.name;
                                        return (
                                          <button 
                                            key={sIdx}
                                            onClick={() => selectSize(group.name, option.name, size)}
                                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                                              isSizeSelected 
                                                ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-lg shadow-[var(--brand-primary)]/20' 
                                                : 'bg-[#1A1A20] text-gray-500 border-[#2C2C35] hover:border-gray-500'
                                            }`}
                                          >
                                            {size.name} {parseFloat(size.price) > 0 ? `(+${formatPrice(parseFloat(size.price))})` : ''}
                                          </button>
                                        );
                                     })}
                                  </div>
                               </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
           )}

           {/* Manual Adjustment Section */}
           <section className="bg-[#1A1A20] rounded-[24px] border border-[#2C2C35] p-6 space-y-6">
              <h3 className="text-gray-500 font-black text-[10px] uppercase tracking-[0.2em]">{t('item.price_adjustment')}</h3>
              
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider ml-1">{t('item.fixed_discount')} ($)</label>
                  <input 
                    type="number"
                    value={fixedDiscount}
                    onChange={(e) => setFixedDiscount(e.target.value)}
                    className="w-full bg-[#0A0A0E] border border-[#2C2C35] rounded-xl px-4 py-3.5 text-white font-black text-center focus:border-[var(--brand-primary)] outline-none transition-all"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider ml-1">{t('item.percent_discount')} (%)</label>
                  <input 
                    type="number"
                    value={percentDiscount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPercentDiscount(val);
                      if (val !== '') {
                        const p = parseFloat(val) || 0;
                        setFixedDiscount(((currentPrice * p) / 100).toString());
                      }
                    }}
                    className="w-full bg-[#0A0A0E] border border-[#2C2C35] rounded-xl px-4 py-3.5 text-white font-black text-center focus:border-[var(--brand-primary)] outline-none transition-all"
                    placeholder="0"
                  />
                </div>
              </div>
           </section>
        </div>

        {/* Footer Actions */}
        <footer className={`p-6 border-t border-[#2C2C35] bg-[#141419] flex gap-4 shrink-0 z-20 ${inline ? 'mt-auto' : 'absolute bottom-0 left-0 right-0'}`}>
           <button onClick={onClose} className="flex-1 py-5 rounded-[20px] bg-[#1A1A20] text-gray-400 font-black text-[11px] uppercase tracking-widest hover:bg-[#25252D] hover:text-white transition-all border border-[#2C2C35]">{t('sale.cancel')}</button>
           <button 
             onClick={handleSave} 
             disabled={!isRequiredSatisfied}
             className={`flex-[2] py-5 rounded-[20px] font-black text-[11px] uppercase tracking-widest transition-all shadow-xl ${
               isRequiredSatisfied 
                 ? 'bg-[var(--brand-primary)] text-white hover:bg-[color-mix(in srgb, var(--brand-primary), black 15%)] shadow-[var(--brand-primary)]/20' 
                 : 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'
             }`}
           >
             {isRequiredSatisfied ? t('item.apply_changes') : t('item.check_required')}
           </button>
        </footer>
    </div>
  );
}
