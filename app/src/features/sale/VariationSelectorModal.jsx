import React, { useState, useEffect } from 'react';
import { fetchProductVariations } from '../../api/woocommerce';
import { useTranslation } from '../../utils/i18n';

export function VariationSelectorModal({ product, onClose, onSelect, formatPrice }) {
  const { t } = useTranslation();
  const [variations, setVariations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadVariations();
  }, [product.id]);

  const loadVariations = async () => {
    setLoading(true);
    const data = await fetchProductVariations(product.id);
    setVariations(data);
    setLoading(false);
  };

  const filteredVariations = variations.filter(v => {
    const name = v.attributes.map(a => a.option).join(' ') || v.name || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase()) || 
           v.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           v.id.toString().includes(searchQuery);
  });

  const handleSelect = (variation) => {
    // Normalize variation to match cart item structure
    const variationName = variation.attributes.map(a => a.option).join(' ') || variation.name;
    const selectedItem = {
      ...product,
      id: variation.id, // Use variation ID as key
      parent_id: product.id,
      name: `${product.name} - ${variationName}`,
      price: parseFloat(variation.price || 0),
      regular_price: parseFloat(variation.regular_price || 0),
      sale_price: parseFloat(variation.sale_price || 0),
      sku: variation.sku || product.sku,
      image: variation.image?.src || product.image,
      stock: variation.stock_quantity || 0,
      isVariation: true
    };
    onSelect(selectedItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col bg-[#000000] animate-in slide-in-from-left duration-300">
      {/* Header */}
      <header className="px-6 py-5 border-b border-[#2C2C35] flex justify-between items-start shrink-0">
         <div>
            <h2 className="text-white font-bold text-2xl tracking-tight mb-1">{t('sale.variation_title')}</h2>
            <div className="flex items-center gap-2 text-gray-500 text-sm">
               <span className="font-bold text-gray-300 uppercase tracking-wider">{product.name}</span>
               <span>ID: {product.id}</span>
            </div>
         </div>
         <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <span className="material-icons-outlined text-gray-400">arrow_back</span>
         </button>
      </header>

      {/* Search Bar */}
      <div className="px-6 py-4 bg-[#0A0A0E] shrink-0">
         <div className="relative">
            <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-600">search</span>
            <input 
               type="text"
               placeholder={t('sale.search_attributes')}
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full bg-[#1A1A20] border border-[#2C2C35] rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-600 focus:border-[var(--brand-primary)] outline-none transition-all shadow-inner"
            />
         </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
         {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
               <span className="material-icons-outlined animate-spin text-[var(--brand-primary)] text-4xl">sync</span>
               <p className="text-gray-500 text-sm animate-pulse">{t('sale.loading_variations')}</p>
            </div>
         ) : filteredVariations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-600">
               <span className="material-icons-outlined text-5xl mb-3">grid_off</span>
               <p className="text-sm">{t('sale.no_variations_found', { query: searchQuery })}</p>
            </div>
         ) : (
            <div className="grid grid-cols-1 gap-3">
               {filteredVariations.map(variation => {
                  const variationName = variation.attributes.map(a => a.option).join(' ') || t('sale.standard');
                  return (
                     <div 
                        key={variation.id}
                        onClick={() => handleSelect(variation)}
                        className="flex items-center p-3 border border-[#1E1E24] bg-[#0A0A0E] hover:bg-[#1A1A20] hover:border-[var(--brand-primary)]/50 rounded-lg cursor-pointer transition-all group"
                     >
                        <div className="w-14 h-14 bg-white rounded overflow-hidden p-0.5 mr-4 shrink-0 relative border border-[#1E1E24]">
                           <div className="absolute top-0 left-0 bg-[var(--brand-primary)] w-4 h-4 flex items-center justify-center z-10 rounded-br shadow-sm">
                              <span className="material-icons-outlined text-white text-[10px] font-bold">event</span>
                           </div>
                           <img 
                              src={variation.image?.src || product.image} 
                              className="w-full h-full object-contain" 
                              alt="" 
                           />
                        </div>
                        
                        <div className="flex-1">
                           <h4 className="text-white font-bold text-base group-hover:text-[var(--brand-primary)] transition-colors">{variationName}</h4>
                           <div className="flex items-center gap-4 mt-1">
                              <span className="text-[var(--brand-primary)] font-bold">{formatPrice(variation.price)}</span>
                              <span className="text-gray-600 text-[11px] uppercase font-bold tracking-widest">
                                 {variation.stock_status === 'instock' ? t('sale.in_stock') : t('sale.out_of_stock')}
                              </span>
                              <span className="text-gray-700 text-[11px]">ID: {variation.id}</span>
                           </div>
                        </div>
                        
                        <div className="text-gray-700 group-hover:text-[var(--brand-primary)] transition-colors pr-2">
                           <span className="material-icons-outlined">add_circle_outline</span>
                        </div>
                     </div>
                  );
               })}
            </div>
         )}
      </div>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-[#2C2C35] bg-[#0A0A0E] flex justify-between items-center text-xs text-gray-600 shrink-0">
         <span>{t('sale.found_items', { count: filteredVariations.length })}</span>
         <button onClick={onClose} className="px-8 py-3 bg-[#25252D] text-white rounded-lg font-bold hover:bg-[#32323D] transition-colors uppercase tracking-widest">{t('sale.close')}</button>
      </footer>
    </div>
  );
}
