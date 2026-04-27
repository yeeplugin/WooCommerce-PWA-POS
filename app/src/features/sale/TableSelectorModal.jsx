import React, { useState } from 'react';
import { normalizeTableKey } from '../../utils/tableStatus';
import { useTranslation } from '../../utils/i18n';

export function TableSelectorModal({ onClose, onSelect, tables: tablesProp = [], selectedTable, occupiedTables = {} }) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  
  const tables = tablesProp.map(t => ({
    ...t,
    isOccupied: !!occupiedTables[normalizeTableKey(t.name)]
  }));

  const filteredTables = tables.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl w-full max-w-2xl flex flex-col max-h-[85vh] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <header className="px-6 py-5 border-b border-[var(--border-main)] flex justify-between items-center bg-[var(--bg-header)]">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-[var(--brand-primary)]/10 flex items-center justify-center">
                <span className="material-icons-outlined text-[var(--brand-primary)]">restaurant</span>
             </div>
              <div>
                 <h2 className="text-[var(--text-main)] font-bold text-lg">{t('tables.select_title')}</h2>
                 <p className="text-[var(--text-muted)] text-[11px] uppercase tracking-widest font-medium">{t('tables.select_subtitle')}</p>
              </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-full transition-all">
            <span className="material-icons-outlined font-bold">close</span>
          </button>
        </header>

        {/* Search Bar */}
        <div className="px-6 py-4 bg-[var(--bg-header)] border-b border-[var(--border-main)]">
           <div className="relative">
              <span className="material-icons-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">search</span>
              <input 
                type="text"
                placeholder={t('tables.search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-main)] rounded-xl pl-12 pr-4 py-3.5 text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--brand-primary)] outline-none transition-all"
              />
           </div>
        </div>

        {/* Tables Grid */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
           <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
              {filteredTables.map((table) => (
                <button
                  key={table.id}
                  onClick={() => !table.isOccupied && onSelect(table.name)}
                  disabled={table.isOccupied}
                   className={`relative p-4 rounded-2xl border flex flex-col items-center justify-center gap-3 transition-all active:scale-95 ${
                    selectedTable === table.name 
                      ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white shadow-lg shadow-[var(--brand-primary)]/20' 
                      : table.isOccupied
                        ? 'bg-[var(--bg-input)] border-[var(--border-main)] text-[var(--text-muted)] opacity-50 cursor-not-allowed'
                        : 'bg-[var(--bg-card)] border-[var(--border-main)] text-[var(--text-muted)] hover:border-[var(--brand-primary)]/50 hover:bg-[var(--bg-input)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <span className="material-icons-outlined text-2xl">
                    {table.isOccupied ? 'event_busy' : 'table_restaurant'}
                  </span>
                   <div className="text-center">
                    <p className="font-black text-sm uppercase tracking-tight">{table.name}</p>
                    <p className={`text-[9px] font-bold uppercase tracking-widest ${selectedTable === table.name ? 'text-white/70' : 'text-[var(--text-muted)] opacity-60'}`}>
                      {table.capacity} {t('tables.seats')}
                    </p>
                  </div>

                  {table.isOccupied && (
                    <div className="absolute top-2 right-2 flex items-center gap-1">
                       <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                    </div>
                  )}
                </button>
              ))}
           </div>
        </div>

        {/* Legend / Status Info */}
        <footer className="px-6 py-4 bg-[var(--bg-header)] border-t border-[var(--border-main)] flex justify-between items-center text-xs">
            <div className="flex gap-4">
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--text-muted)] opacity-40"></div>
                  <span className="text-[var(--text-muted)]">{t('tables.available')}</span>
               </div>
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <span className="text-[var(--text-muted)]">{t('tables.occupied')}</span>
               </div>
            </div>
            <button 
              onClick={onClose}
              className="px-6 py-2.5 bg-[var(--bg-input)] text-[var(--text-main)] rounded-lg font-bold hover:bg-[var(--bg-card)] border border-[var(--border-main)] transition-colors uppercase tracking-wider text-[11px]"
            >
              {t('sale.cancel')}
            </button>
        </footer>
      </div>
    </div>
  );
}
