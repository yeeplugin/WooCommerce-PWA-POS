import React, { useState, useEffect } from 'react';
import { db } from '../../db/indexedDB';
import { TableSelectorModal } from './TableSelectorModal';
import toast from '../../utils/toast';
import { buildOccupiedTableMap, normalizeTableKey } from '../../utils/tableStatus';
import { useTranslation } from '../../utils/i18n';

export function TableDashboard({ onResumeOrder, onCheckoutOrder, onTransferTable, onClearTable, formatPrice, tables = [] }) {
  const { t } = useTranslation();
  const [occupiedTables, setOccupiedTables] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isMoveTableModalOpen, setIsMoveTableModalOpen] = useState(false);

  useEffect(() => {
    loadOccupiedTables();
    
    // Refresh every 30 seconds to catch sync updates
    const interval = setInterval(loadOccupiedTables, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadOccupiedTables();
  }, [tables]);

  const loadOccupiedTables = async () => {
    try {
      const allOrders = await db.orders.toArray();
      setOccupiedTables(buildOccupiedTableMap(allOrders, tables));
    } catch (err) {
      console.error('Failed to load occupied tables', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-page)] overflow-hidden">
      {/* Header */}
      <header className="px-8 py-6 border-b border-[var(--border-main)] flex justify-between items-center bg-[var(--bg-header)] backdrop-blur-md shrink-0">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--brand-primary)]/10 flex items-center justify-center">
               <span className="material-icons-outlined text-[var(--brand-primary)] text-2xl">event_seat</span>
            </div>
            <div>
               <h1 className="text-[var(--text-main)] text-xl font-black uppercase tracking-tight">{t('tables.title')}</h1>
               <div className="flex items-center gap-4 mt-1">
                  <div className="flex items-center gap-1.5">
                     <div className="w-2 h-2 rounded-full bg-green-500"></div>
                     <span className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest">{t('tables.available')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                     <div className="w-2 h-2 rounded-full bg-red-500"></div>
                     <span className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest">{t('tables.occupied')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                     <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                     <span className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest">{t('tables.on_hold')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                     <div className="w-2 h-2 rounded-full bg-green-500"></div>
                     <span className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest">{t('tables.paid')}</span>
                  </div>
               </div>
            </div>
         </div>
          <button 
            onClick={loadOccupiedTables}
            className="p-3 bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-xl transition-all active:scale-95"
          >
            <span className="material-icons-outlined text-xl">refresh</span>
          </button>
      </header>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
         {loading ? (
            <div className="h-full flex items-center justify-center">
               <span className="material-icons-outlined animate-spin text-[var(--brand-primary)] text-4xl">sync</span>
            </div>
         ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
               {tables.map(table => {
                  const order = occupiedTables[normalizeTableKey(table.name)];
                  const isOccupied = !!order;
                  const isOnHold = order?.status === 'on-hold';
                  
                  return (
                    <button
                      key={table.id}
                      onClick={() => isOccupied && setSelectedOrder(order)}
                       className={`relative aspect-square p-6 rounded-[2.5rem] border-2 transition-all flex flex-col items-center justify-center gap-3 overflow-hidden group ${
                        isOccupied 
                          ? (isOnHold ? 'border-amber-500/50 bg-amber-500/5 hover:border-amber-500 shadow-lg shadow-amber-500/5' : 
                             'border-red-500/50 bg-red-500/5 hover:border-red-500 shadow-lg shadow-red-500/5')
                          : 'border-[var(--border-main)] bg-[var(--bg-card)] hover:border-[var(--brand-primary)]/50'
                      }`}
                    >
                        <span className={`material-icons-outlined text-3xl transition-transform group-hover:scale-110 ${
                          isOccupied ? (isOnHold ? 'text-amber-500' : 'text-red-500') : 'text-[var(--text-muted)] opacity-30'
                        }`}>
                          {isOccupied ? 'restaurant' : 'table_restaurant'}
                        </span>
                                              <div className="text-center">
                           <p className={`font-black uppercase tracking-tighter text-lg ${isOccupied ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}>
                             {table.name}
                           </p>
                           <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] opacity-60">
                             {table.capacity} {t('tables.seats')}
                           </p>
                        </div>

                       {isOccupied && (
                         <div className="absolute bottom-6 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/5 animate-in slide-in-from-bottom-2">
                           <p className="text-[10px] font-black tabular-nums text-white">
                             {formatPrice(order.total)}
                           </p>
                         </div>
                       )}

                       {isOccupied && (
                         <div className={`absolute top-6 right-6 w-3 h-3 rounded-full ${isOnHold ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-red-500 shadow-[0_0_10_px_rgba(239,68,68,0.5)]'} animate-pulse`}></div>
                       )}
                    </button>
                  );
               })}
            </div>
         )}
      </div>

       {/* Table Action Modal */}
       {selectedOrder && !isMoveTableModalOpen && (
         <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
               <header className="px-6 py-6 border-b border-[var(--border-main)] flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-[var(--brand-primary)]/10 flex items-center justify-center">
                    <span className="material-icons-outlined text-[var(--brand-primary)]">event_seat</span>
                 </div>
                  <div>
                     <h3 className="text-[var(--text-main)] font-black uppercase tracking-tight text-lg">{selectedOrder.table || selectedOrder._yeepos_table_number}</h3>
                     <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest mt-1">{t('tables.select_action')}</p>
                  </div>
              </header>

              <div className="p-4 flex flex-col gap-3">
                  <button 
                    onClick={() => onCheckoutOrder(selectedOrder)}
                    className="flex items-center gap-4 p-4 bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/20 rounded-2xl text-[var(--text-main)] hover:bg-[var(--brand-primary)] hover:text-white transition-all group"
                  >
                     <span className="material-icons-outlined text-[var(--brand-primary)] group-hover:text-white">payments</span>
                     <div className="text-left">
                        <p className="font-bold text-sm">{t('tables.checkout')}</p>
                        <p className="text-[10px] text-[var(--text-muted)] group-hover:text-white/70">{t('tables.checkout_desc')}</p>
                     </div>
                  </button>

                  <button 
                    onClick={() => onResumeOrder(selectedOrder)}
                    className="flex items-center gap-4 p-4 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-2xl text-[var(--text-main)] hover:border-[var(--brand-primary)]/50 transition-all group"
                  >
                     <span className="material-icons-outlined text-[var(--text-muted)] group-hover:text-[var(--brand-primary)]">add_shopping_cart</span>
                     <div className="text-left">
                        <p className="font-bold text-sm">{t('tables.add_items')}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">{t('tables.add_items_desc')}</p>
                     </div>
                  </button>

                  <button 
                    onClick={() => setIsMoveTableModalOpen(true)}
                    className="flex items-center gap-4 p-4 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-2xl text-[var(--text-main)] hover:border-[var(--brand-primary)]/50 transition-all group"
                  >
                     <span className="material-icons-outlined text-[var(--text-muted)] group-hover:text-[var(--brand-primary)]">sync_alt</span>
                     <div className="text-left">
                        <p className="font-bold text-sm">{t('tables.transfer')}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">{t('tables.transfer_desc')}</p>
                     </div>
                  </button>

                  <button 
                    onClick={async () => {
                      await onClearTable(selectedOrder.id);
                      toast.success(t('tables.order_cleared'));
                      setSelectedOrder(null);
                      loadOccupiedTables();
                    }}
                    className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-[var(--text-main)] hover:bg-red-500 hover:text-white transition-all group"
                  >
                     <span className="material-icons-outlined text-red-500 group-hover:text-white">delete</span>
                     <div className="text-left">
                        <p className="font-bold text-sm">{t('tables.clear')}</p>
                        <p className="text-[10px] text-[var(--text-muted)] group-hover:text-white/70">{t('tables.clear_desc')}</p>
                     </div>
                  </button>
              </div>

               <footer className="px-4 pb-4">
                  <button 
                    onClick={() => setSelectedOrder(null)}
                    className="w-full py-3.5 text-[var(--text-muted)] font-bold uppercase tracking-widest text-[10px] hover:text-[var(--text-main)] transition-colors"
                  >
                    {t('sale.cancel')}
                  </button>
               </footer>
           </div>
        </div>
      )}

      {/* Move Table Modal */}
      {isMoveTableModalOpen && (
        <TableSelectorModal 
          onClose={() => setIsMoveTableModalOpen(false)}
          tables={tables}
          selectedTable={selectedOrder.table || selectedOrder._yeepos_table_number}
          occupiedTables={occupiedTables}
          onSelect={async (newTable) => {
            const success = await onTransferTable(selectedOrder.id, newTable);
            if (success) {
              toast.success(t('tables.transferred_to', { table: newTable }));
              setIsMoveTableModalOpen(false);
              setSelectedOrder(null);
              loadOccupiedTables();
            } else {
              toast.error(t('tables.transfer_failed'));
            }
          }}
        />
      )}
    </div>
  );
}
