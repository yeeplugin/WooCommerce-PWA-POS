import React, { useState, useEffect, useRef, useMemo } from 'react';
import { updateProduct, fetchProductVariations, updateProductVariation, searchProductsOnline } from '../../api/woocommerce';
import { db } from '../../db/indexedDB';
import { useTranslation } from '../../utils/i18n';

// Move Sub-components OUTSIDE to prevent re-mounting on every keystroke
const MobileHeader = ({ t, refreshProducts, searchQuery, setSearchQuery, isSearchingOnline, categories, selectedCategoryId, setSelectedCategoryId }) => (
  <header className="md:hidden h-auto py-4 border-b border-[var(--border-main)] flex flex-col px-4 bg-[var(--bg-header)] gap-4 shrink-0 transition-all duration-300">
    <div className="flex justify-between items-center">
      <h1 className="text-xl font-black text-[var(--text-main)] uppercase tracking-wider">{t('nav.products')}</h1>
      <div className="flex items-center gap-2">
        <button 
          onClick={refreshProducts} 
          className="w-10 h-10 flex items-center justify-center bg-[var(--bg-tag)] hover:bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] rounded-xl transition-all active:scale-95 shadow-sm border border-[var(--border-main)]"
        >
          <span className="material-icons-outlined">refresh</span>
        </button>
        <button 
          onClick={() => {
            const siteUrl = window.yeePOSData?.siteUrl || window.location.origin;
            window.open(`${siteUrl}/wp-admin/post-new.php?post_type=product`, '_blank');
          }}
          className="w-10 h-10 flex items-center justify-center bg-[var(--brand-primary)] text-white rounded-xl transition-all active:scale-95 shadow-lg shadow-[var(--brand-primary)]/20"
        >
          <span className="material-icons-outlined">add</span>
        </button>
      </div>
    </div>
    
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">search</span>
        <input 
          type="text" 
          placeholder={t('products.search_placeholder')} 
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full bg-[var(--bg-input)] text-xs text-[var(--text-main)] rounded-xl px-10 py-3 outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/50 border border-[var(--border-main)] placeholder-[var(--text-muted)] transition-all font-medium"
        />
        {isSearchingOnline && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 material-icons-outlined animate-spin text-[var(--brand-primary)] text-[14px]">sync</span>
        )}
      </div>
      <div className="relative w-28">
         <select 
           value={selectedCategoryId}
           onChange={(e) => setSelectedCategoryId(e.target.value)}
           className="w-full h-full bg-[var(--bg-input)] text-[10px] text-[var(--text-main)] rounded-xl px-3 py-3 outline-none border border-[var(--border-main)] appearance-none cursor-pointer font-bold uppercase tracking-widest text-center"
         >
            <option value="">{t('products.category_placeholder').toUpperCase()}</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>)}
         </select>
         <span className="material-icons-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[14px] pointer-events-none">expand_more</span>
      </div>
    </div>
  </header>
);

const EditForm = ({ isMobile = false, t, selectedProduct, setSelectedProduct, editStatus, handleSave, formData, handleInputChange }) => (
  <div className={`flex flex-col min-w-0 flex-1 ${isMobile ? 'h-full bg-[var(--bg-card)]' : 'overflow-hidden'}`}>
    <header className={`px-4 md:px-8 flex justify-between items-center shrink-0 border-b border-[var(--border-main)] bg-[var(--bg-header)] ${isMobile ? 'h-16 sticky top-0 z-50' : 'h-14'}`}>
       {isMobile && (
         <button onClick={() => setSelectedProduct(null)} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all">
           <span className="material-icons-outlined">arrow_back</span>
         </button>
       )}
       <h2 className="text-sm md:text-lg font-black text-[var(--text-main)] tracking-widest uppercase">{t('products.details_title')}</h2>
       <div className="flex items-center gap-2 md:gap-4">
          {editStatus === 'success' && <span className="hidden md:flex text-green-500 text-sm font-medium items-center gap-1 animate-fade-in"><span className="material-icons-outlined">check_circle</span> {t('products.save_success')}</span>}
          {!isMobile && (
            <button 
              onClick={() => {
                 const siteUrl = window.yeePOSData?.siteUrl || window.location.origin;
                 const productId = selectedProduct.isVariation ? selectedProduct.parent_id : selectedProduct.id;
                 window.open(`${siteUrl}/wp-admin/post.php?post=${productId}&action=edit`, '_blank');
              }}
              className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors p-1.5 rounded-lg hover:bg-[var(--border-main)] cursor-pointer flex items-center justify-center"
              title={t('products.view_woo_admin')}
            >
               <span className="material-icons-outlined">open_in_new</span>
            </button>
          )}
          <button 
            onClick={handleSave}
            disabled={editStatus === 'saving'}
            className={`px-4 md:px-6 py-2 rounded-xl text-white font-black text-[10px] md:text-xs uppercase tracking-widest transition-all cursor-pointer ${editStatus === 'saving' ? 'bg-[var(--bg-input)] text-[var(--text-muted)] cursor-not-allowed' : 'bg-[var(--brand-primary)] hover:bg-[color-mix(in srgb, var(--brand-primary), black 15%)] shadow-lg shadow-[var(--brand-primary)]/20 active:scale-95'}`}
          >
             {editStatus === 'saving' ? '...' : t('products.save_btn')}
          </button>
       </div>
    </header>

    <div className={`overflow-y-auto ${isMobile ? 'p-6 pb-20' : 'p-12'} custom-scrollbar scroll-smooth`}>
       <div className="max-w-3xl mx-auto space-y-10">
          {isMobile && (
            <div className="aspect-square w-full max-w-[200px] mx-auto bg-white rounded-3xl overflow-hidden shadow-xl border border-[var(--border-main)]/50 mb-10 p-2">
              {selectedProduct.image ? (
                <img 
                  src={typeof selectedProduct.image === 'object' ? selectedProduct.image.src : selectedProduct.image} 
                  className="w-full h-full object-contain" 
                  alt={selectedProduct.name}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[var(--bg-input)]">
                   <span className="material-icons-outlined text-[var(--text-muted)] opacity-20 text-[48px]">image</span>
                </div>
              )}
            </div>
          )}

          <section className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <div className="flex flex-col gap-2">
                 <label className="text-[var(--text-muted)] font-black text-[9px] md:text-[11px] uppercase tracking-[0.2em]">{t('nav.products')}</label>
                 <input 
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    readOnly={selectedProduct.isVariation}
                    className={`w-full bg-[var(--bg-input)] border border-[var(--border-main)] rounded-xl px-4 py-3.5 text-[var(--text-main)] text-sm outline-none focus:border-[var(--brand-primary)] transition-all font-bold ${selectedProduct.isVariation ? 'opacity-40 cursor-not-allowed' : ''}`}
                 />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                   <label className="text-[var(--text-muted)] font-black text-[9px] md:text-[11px] uppercase tracking-[0.2em]">{t('products.regular_price')}</label>
                   <input 
                      type="number"
                      value={formData.regular_price}
                      onChange={(e) => handleInputChange('regular_price', e.target.value)}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-main)] rounded-xl px-4 py-3.5 text-[var(--text-main)] text-sm outline-none focus:border-[var(--brand-primary)] transition-all font-bold"
                   />
                </div>
                <div className="flex flex-col gap-2">
                   <label className="text-[#e11d48] font-black text-[9px] md:text-[11px] uppercase tracking-[0.2em]">{t('products.sale_price')}</label>
                   <input 
                      type="number"
                      value={formData.sale_price}
                      onChange={(e) => handleInputChange('sale_price', e.target.value)}
                      className="w-full bg-[var(--bg-input)] border border-[#e11d48]/20 rounded-xl px-4 py-3.5 text-[#e11d48] outline-none focus:border-[#e11d48] transition-all font-bold"
                   />
                </div>
              </div>
            </div>
          </section>

          <div className="h-px bg-[var(--border-main)] opacity-50"></div>

          <section className="space-y-8">
             <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em]">{t('products.inventory_section')}</h3>
             <div className="grid grid-cols-1 gap-8">
                <div className="flex flex-col gap-2 text-sm">
                   <label className="text-gray-500 font-black text-[9px] md:text-[11px] uppercase tracking-[0.2em]">SKU</label>
                   <input 
                      value={formData.sku}
                      onChange={(e) => handleInputChange('sku', e.target.value)}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-main)] rounded-xl px-4 py-3.5 text-[var(--text-main)] outline-none focus:border-[var(--brand-primary)] transition-all font-bold"
                   />
                </div>

                <div className="flex flex-col gap-2">
                   <label className="text-[var(--text-muted)] font-black text-[9px] md:text-[11px] uppercase tracking-[0.2em]">{t('products.gtin_label')}</label>
                   <input 
                      value={formData.gtin}
                      onChange={(e) => handleInputChange('gtin', e.target.value)}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-main)] rounded-xl px-4 py-3.5 text-[var(--text-main)] text-sm outline-none focus:border-[var(--brand-primary)] transition-all font-bold"
                   />
                </div>

                <div className="flex items-center p-4 bg-[var(--bg-input)] rounded-2xl border border-[var(--border-main)] gap-4">
                   <input 
                      type="checkbox"
                      id={`${isMobile ? 'm_' : ''}manage_stock`}
                      checked={formData.manage_stock}
                      onChange={(e) => handleInputChange('manage_stock', e.target.checked)}
                      className="w-5 h-5 rounded-lg border-[var(--border-main)] bg-[var(--bg-page)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                   />
                   <label htmlFor={`${isMobile ? 'm_' : ''}manage_stock`} className="text-[var(--text-main)] font-black uppercase text-[10px] tracking-widest">{t('products.manage_stock')}</label>
                </div>

                <div className="flex flex-col gap-2">
                   <label className="text-gray-500 font-black text-[9px] md:text-[11px] uppercase tracking-[0.2em]">{t('products.stock_quantity')}</label>
                   <input 
                      type="number"
                      value={formData.stock_quantity}
                      onChange={(e) => handleInputChange('stock_quantity', e.target.value)}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-main)] rounded-xl px-4 py-3.5 text-[var(--text-main)] text-sm outline-none focus:border-[var(--brand-primary)] transition-all font-bold"
                   />
                </div>
             </div>
          </section>
       </div>
    </div>
  </div>
);

export function ProductsView({ products, categories, loading, selectedProduct, setSelectedProduct, refreshProducts, formatPrice, onCacheProduct }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('general');
  const [editStatus, setEditStatus] = useState('idle'); // 'idle', 'saving', 'success', 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [formData, setFormData] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [productVariations, setProductVariations] = useState({}); // { productId: [variations] }
  const [variations, setVariations] = useState([]);
  const [loadingVariations, setLoadingVariations] = useState(false);

  // Resize State
  const [sidebarWidth, setSidebarWidth] = useState(() => parseInt(localStorage.getItem('productsSidebarWidth')) || 400);
  const [isResizing, setIsResizing] = useState(false);

  // Cache-on-Demand: Hybrid Search State
  const [onlineSearchResults, setOnlineSearchResults] = useState([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Debounced online search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    if (!searchQuery || searchQuery.length < 2 || !navigator.onLine) {
      setOnlineSearchResults([]);
      setIsSearchingOnline(false);
      return;
    }

    setIsSearchingOnline(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchProductsOnline(searchQuery);
        const localIds = new Set(products.map(p => p.id));
        const newProducts = results.filter(p => !localIds.has(p.id));
        setOnlineSearchResults(newProducts);
      } catch (err) {
        console.error('[YeePOS] Online search failed in ProductsView:', err);
      } finally {
        setIsSearchingOnline(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const isMatching = (p) => (
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.id?.toString().includes(q)
    );

    if (searchQuery && onlineSearchResults.length > 0) {
      const onlineIds = new Set(onlineSearchResults.map(p => p.id));
      const localMatches = products.filter(p => !onlineIds.has(p.id) && isMatching(p));
      let combined = [...onlineSearchResults, ...localMatches];
      if (selectedCategoryId !== '') {
        combined = combined.filter(p => p.categories?.some(c => c.id.toString() === selectedCategoryId.toString()));
      }
      return combined;
    }

    return products.filter(p => {
      const matchesSearch = !searchQuery || isMatching(p);
      const matchesCategory = selectedCategoryId === '' || 
                              p.categories?.some(c => c.id.toString() === selectedCategoryId.toString());
      return matchesSearch && matchesCategory;
    });
  }, [products, onlineSearchResults, searchQuery, selectedCategoryId]);

  useEffect(() => {
    const fetchVisibleVariations = async () => {
      const variableProducts = filteredProducts.filter(p => p.type === 'variable' && !productVariations[p.id]);
      for (const p of variableProducts) {
        try {
          const v = await fetchProductVariations(p.id);
          setProductVariations(prev => ({ ...prev, [p.id]: v }));
        } catch (err) {
          console.error(`Error fetching variations for ${p.id}:`, err);
        }
      }
    };
    
    if (filteredProducts.length > 0) {
      fetchVisibleVariations();
    }
  }, [filteredProducts, productVariations]);

  useEffect(() => {
    if (selectedProduct) {
      const gtinMeta = selectedProduct.meta_data?.find(m => m.key === '_gtin')?.value || '';
      setFormData({
        name: selectedProduct.name || '',
        sku: selectedProduct.sku || '',
        gtin: gtinMeta,
        price: selectedProduct.price || 0,
        regular_price: selectedProduct.regular_price || selectedProduct.price || 0,
        sale_price: selectedProduct.sale_price || '',
        stock: selectedProduct.stock || 0,
        manage_stock: !!selectedProduct.manage_stock,
        stock_quantity: selectedProduct.stock_quantity || selectedProduct.stock || 0,
        sold_individually: selectedProduct.sold_individually || false,
        description: selectedProduct.description || '',
      });
      loadVariations(selectedProduct.id);
    } else {
      setFormData(null);
      setVariations([]);
    }
  }, [selectedProduct]);

  const loadVariations = async (productId) => {
    setLoadingVariations(true);
    try {
      const v = await fetchProductVariations(productId);
      setVariations(v);
    } catch (err) {
      console.error('Error loading variations:', err);
    } finally {
      setLoadingVariations(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errorMsg) setErrorMsg('');
  };

  const handleSave = async () => {
    setEditStatus('saving');
    setErrorMsg('');
    try {
      const commonData = {
        regular_price: formData.regular_price.toString(),
        sale_price: formData.sale_price.toString(),
        manage_stock: formData.manage_stock,
        stock_quantity: parseInt(formData.stock_quantity),
        meta_data: [{ key: '_gtin', value: formData.gtin }]
      };

      if (selectedProduct.isVariation) {
        await updateProductVariation(selectedProduct.parent_id, selectedProduct.id, commonData);
      } else {
        await updateProduct(selectedProduct.id, {
          ...commonData,
          name: formData.name,
          sku: formData.sku,
          sold_individually: formData.sold_individually
        });
      }

      setEditStatus('success');
      await refreshProducts();
      setTimeout(() => setEditStatus('idle'), 3000);
    } catch (err) {
      console.error('Error saving product:', err);
      setEditStatus('error');
      setErrorMsg(err.message || t('products.save_error'));
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[var(--bg-page)] relative">
      <MobileHeader 
        t={t}
        refreshProducts={refreshProducts}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isSearchingOnline={isSearchingOnline}
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        setSelectedCategoryId={setSelectedCategoryId}
      />

      {isResizing && (
        <div 
          className="hidden md:block fixed inset-0 z-[200] cursor-col-resize select-none"
          onMouseMove={(e) => {
            const newWidth = e.clientX;
            if (newWidth > 200 && newWidth < Math.min(800, window.innerWidth - 300)) {
              setSidebarWidth(newWidth);
            }
          }}
          onMouseUp={() => setIsResizing(false)}
        />
      )}

      <div className="flex-1 flex overflow-hidden">
        <div 
          style={{ width: window.innerWidth < 768 ? '100%' : `${sidebarWidth}px` }} 
          className={`flex flex-col bg-[var(--bg-sidebar)] shrink-0 transition-transform duration-300 ${window.innerWidth < 768 && selectedProduct ? 'hidden' : 'flex'}`}
        >
          <header className="hidden md:flex h-14 border-b border-[var(--border-main)] items-center px-2 bg-[var(--bg-header)] gap-1 shrink-0">
            <div className="relative flex-1">
              <input 
                type="text" 
                placeholder={t('products.search_placeholder')} 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--bg-input)] text-[13px] text-[var(--text-main)] rounded px-3 py-1.5 outline-none focus:ring-1 focus:ring-[var(--brand-primary)] border border-[var(--border-main)] placeholder-[var(--text-muted)]"
              />
              {isSearchingOnline && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 material-icons-outlined animate-spin text-[var(--brand-primary)] text-[16px]">sync</span>
              )}
            </div>
            <div className="relative w-28">
               <select 
                 value={selectedCategoryId}
                 onChange={(e) => setSelectedCategoryId(e.target.value)}
                 className="w-full bg-[var(--bg-input)] text-[12px] text-[var(--text-muted)] rounded px-2 py-1.5 outline-none border border-[var(--border-main)] appearance-none cursor-pointer"
               >
                  <option value="">{t('products.category_placeholder')}</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>
               <span className="material-icons-outlined absolute right-1 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[16px] pointer-events-none">expand_more</span>
            </div>
            <button onClick={refreshProducts} className="p-1.5 hover:bg-[var(--border-main)] rounded text-[var(--text-muted)] transition-colors" title={t('sale.refresh')}>
               <span className="material-icons-outlined">refresh</span>
            </button>
            <button 
              onClick={() => {
                const siteUrl = window.yeePOSData?.siteUrl || window.location.origin;
                window.open(`${siteUrl}/wp-admin/post-new.php?post_type=product`, '_blank');
              }}
              className="p-1.5 hover:bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] rounded transition-colors"
              title={t('products.add_product')}
            >
               <span className="material-icons-outlined">add</span>
            </button>
          </header>

          <div className="flex-1 overflow-y-auto custom-scrollbar bg-[var(--bg-page)] md:bg-transparent">
            {loading ? (
               <div className="flex justify-center items-center h-full">
                 <span className="material-icons-outlined animate-spin text-[var(--brand-primary)] text-[32px]">sync</span>
               </div>
            ) : (
               <div className="flex flex-col">
                  {filteredProducts.map(product => {
                    const hasSale = product.sale_price && product.sale_price !== product.regular_price;
                    return (
                      <React.Fragment key={product.id}>
                        {/* List Item - 100% Synced with SaleView */}
                        <div 
                          onClick={() => {
                            setSelectedProduct(product);
                            if (onCacheProduct) onCacheProduct(product);
                          }}
                          className={`flex items-center p-3 border-b border-[var(--border-main)]/50 hover:bg-[var(--bg-hover)] md:hover:bg-[var(--bg-card)] cursor-pointer transition-colors group relative ${selectedProduct?.id === product.id ? 'bg-[var(--border-main)]/10 md:bg-[var(--bg-card)]' : ''}`}
                        >
                          <div className="w-16 h-16 bg-white rounded relative flex-shrink-0 flex items-center justify-center overflow-hidden p-1 mr-4 border border-[var(--border-main)]/30 shadow-sm">
                            {product.type === 'variable' && (
                              <div className="absolute top-0 left-0 bg-[var(--brand-primary)] w-4 h-4 flex items-center justify-center z-10 rounded-br shadow-sm">
                                 <span className="material-icons-outlined text-white text-[8px] font-bold leading-none">grid_view</span>
                              </div>
                            )}
                            {product.image ? (
                              <img src={product.image} className="w-full h-full object-contain" alt={product.name} />
                            ) : (
                              <span className="material-icons-outlined text-gray-400 text-[24px]">image</span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0 pr-4">
                            <h3 className="font-bold text-[var(--text-main)] text-[15px] truncate mb-0.5 group-hover:text-[var(--brand-primary)] transition-colors">{product.name}</h3>
                            <div className="flex items-center text-sm gap-2 mb-0.5">
                               {hasSale 
                                 ? <><span className="text-gray-500 line-through text-xs">{formatPrice(product.regular_price)}</span><span className="text-[var(--brand-primary)] font-bold">{formatPrice(product.sale_price)}</span></>
                                 : <span className="text-[var(--brand-primary)] font-bold">{product.type === 'variable' ? t('products.variable_type') : formatPrice(product.price)}</span>
                               }
                            </div>
                            
                            <div className="text-xs text-[var(--text-muted)] flex items-center gap-3">
                               {product.manage_stock ? (
                                 <span className={product.stock <= 0 ? 'text-red-500 font-bold' : ''}>{t('sale.stock')}: {product.stock}</span>
                               ) : (
                                 <span className="text-emerald-500 font-bold">{t('sale.in_stock')}</span>
                               )}
                               <span className="text-[var(--border-main)]">|</span>
                               <span>ID: {product.id} | SKU: {product.sku}</span>
                            </div>
                          </div>

                          <button className="p-2 text-gray-400 opacity-30 md:opacity-10 group-hover:opacity-100 group-hover:text-[var(--brand-primary)] transition-all">
                             <span className="material-icons-outlined">chevron_right</span>
                          </button>
                        </div>
                        
                        {product.type === 'variable' && productVariations[product.id] && window.innerWidth >= 768 && (
                          <div className="relative bg-[var(--bg-card)]/20">
                            {productVariations[product.id].map((variation) => {
                               const vHasSale = variation.sale_price && variation.sale_price !== variation.regular_price;
                               return (
                                 <div 
                                  key={variation.id}
                                   onClick={() => {
                                    const fullVariation = { ...product, ...variation, id: variation.id, parent_id: product.id, isVariation: true };
                                    setSelectedProduct(fullVariation);
                                    if (onCacheProduct) onCacheProduct(fullVariation);
                                  }}
                                  className={`flex items-center py-2.5 px-4 pl-12 hover:bg-[var(--bg-hover)] cursor-pointer transition-colors group relative border-b border-[var(--border-main)]/30 ${selectedProduct?.id === variation.id ? 'bg-[var(--border-main)]/10' : ''}`}
                                 >
                                   <div className="absolute left-[38px] top-0 bottom-0 w-px bg-[var(--border-main)] opacity-50"></div>
                                   <div className="absolute left-[38px] top-1/2 w-4 h-px bg-[var(--border-main)] opacity-50"></div>
                                   
                                   <div className="w-10 h-10 bg-white rounded relative flex-shrink-0 flex items-center justify-center overflow-hidden p-1 mr-3 border border-[var(--border-main)]/30">
                                     {variation.image?.src ? <img src={variation.image.src} className="w-full h-full object-contain" alt={variation.attributes.map(a => a.option).join(', ')} /> : <span className="material-icons-outlined text-gray-400 text-[18px]">image</span>}
                                   </div>
                                   <div className="flex-1 min-w-0 pr-4">
                                     <h4 className="font-bold text-[var(--text-main)] text-[12px] truncate mb-0.5 group-hover:text-[var(--brand-primary)] transition-colors leading-tight">
                                       {variation.attributes.map(a => a.option).join(', ')}
                                     </h4>
                                     <div className="flex items-center text-[11px] gap-2 mb-0.5">
                                        {vHasSale 
                                          ? <><span className="text-gray-500 line-through text-[10px]">{formatPrice(variation.regular_price)}</span><span className="text-[var(--brand-primary)] font-bold">{formatPrice(variation.sale_price)}</span></>
                                          : <span className="text-[var(--brand-primary)] font-bold">{formatPrice(variation.price)}</span>
                                        }
                                     </div>
                                     <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-2">
                                        {variation.manage_stock ? (
                                          <span className={variation.stock_quantity <= 0 ? 'text-red-500 font-bold' : ''}>{t('sale.stock')}: {variation.stock_quantity || 0}</span>
                                        ) : (
                                          <span className="text-emerald-500 font-bold">{t('sale.in_stock')}</span>
                                        )}
                                     </div>
                                   </div>
                                   <button className="p-1.5 text-gray-400 opacity-20 group-hover:opacity-100 group-hover:text-[var(--brand-primary)] transition-all">
                                      <span className="material-icons-outlined text-sm">chevron_right</span>
                                   </button>
                                 </div>
                               );
                            })}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
               </div>
            )}
          </div>
        </div>

        <div className="hidden md:flex w-4 cursor-col-resize shrink-0 z-10 items-center justify-center group bg-transparent hover:bg-[var(--brand-primary)]/5 transition-colors"
          onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
        >
          <div className="h-8 w-0.5 rounded-full bg-[var(--border-main)] group-hover:bg-[var(--brand-primary)] flex flex-col items-center justify-center gap-0.5 transition-colors">
            <div className="w-[1.5px] h-[1.5px] rounded-full bg-current opacity-40" />
            <div className="w-[1.5px] h-[1.5px] rounded-full bg-current opacity-40" />
            <div className="w-[1.5px] h-[1.5px] rounded-full bg-current opacity-40" />
          </div>
        </div>

        <div className="hidden md:flex flex-1 min-w-0 bg-[var(--bg-card)]">
          {selectedProduct && formData ? (
            <EditForm 
              t={t}
              selectedProduct={selectedProduct}
              setSelectedProduct={setSelectedProduct}
              editStatus={editStatus}
              handleSave={handleSave}
              formData={formData}
              handleInputChange={handleInputChange}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-[var(--bg-page)] text-center px-10">
              <div className="w-24 h-24 mb-6 opacity-10 filter grayscale">
                 <span className="material-icons-outlined text-[var(--text-main)] text-[64px]">toc</span>
              </div>
              <h2 className="text-[22px] font-bold text-[var(--text-muted)] tracking-[.2em] mb-3 uppercase">{t('products.no_product_selected')}</h2>
              <p className="text-[var(--text-muted)] text-sm max-w-xs leading-relaxed">{t('products.no_product_selected_desc')}</p>
            </div>
          )}
        </div>

        {selectedProduct && formData && (
          <div className="md:hidden fixed inset-0 z-[200] bg-[var(--bg-page)] flex flex-col animate-in slide-in-from-right duration-300 h-[100dvh]">
            <EditForm 
              isMobile={true} 
              t={t}
              selectedProduct={selectedProduct}
              setSelectedProduct={setSelectedProduct}
              editStatus={editStatus}
              handleSave={handleSave}
              formData={formData}
              handleInputChange={handleInputChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
