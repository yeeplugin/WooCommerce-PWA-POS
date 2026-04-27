import React, { useState, useEffect } from 'react';
import { db } from '../../db/indexedDB';
import { useTranslation } from '../../utils/i18n';

export function ParkedOrdersModal({ onClose, onResume, onDelete, formatPrice }) {
  const { t } = useTranslation();
  const [parkedOrders, setParkedOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadParkedOrders();
  }, []);

  const loadParkedOrders = async () => {
    setLoading(true);
    let orders = await db.orders
      .where('status')
      .equals('parked')
      .toArray();
      
    // Sort in descending order by date (newest first)
    orders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    setParkedOrders(orders);
    setLoading(false);
  };

  const handleResume = async (order) => {
    await onResume(order);
    onClose();
  };

  const handleDelete = async (orderId) => {
    await onDelete(orderId);
    loadParkedOrders(); // Refresh list
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#141419] border border-[#2C2C35] rounded-xl w-full max-w-2xl flex flex-col max-h-[80vh] shadow-2xl animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <header className="px-6 py-4 border-b border-[#2C2C35] flex justify-between items-center">
          <div className="flex items-center gap-3">
             <span className="material-icons-outlined text-[var(--brand-primary)]">visibility_off</span>
             <h2 className="text-white font-bold text-lg">{t('orders.parked_orders')}</h2>
             <span className="bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                {parkedOrders.length} {t('orders.active')}
             </span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <span className="material-icons-outlined">close</span>
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-[300px]">
          {loading ? (
             <div className="flex justify-center items-center h-48">
                <span className="material-icons-outlined animate-spin text-[var(--brand-primary)]">sync</span>
             </div>
          ) : parkedOrders.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-64 text-gray-600">
                <span className="material-icons-outlined text-5xl mb-3">inventory_2</span>
                <p className="text-sm">{t('orders.no_parked')}</p>
             </div>
          ) : (
            <div className="divide-y divide-[#2C2C35]">
              {parkedOrders.map((order) => (
                <div key={order.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                       <span className="text-white font-bold text-sm">Order #{order.id}</span>
                       <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                         order.status === 'pending' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' :
                         order.status === 'on-hold' ? 'bg-orange-500/20 text-orange-500 border border-orange-500/30' :
                         'bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] border border-[var(--brand-primary)]/30'
                       }`}>
                         {order.status === 'pending' ? t('sale.pending') || 'PENDING' : order.status}
                       </span>
                       <span className="text-gray-500 text-[11px]">• {new Date(order.date).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                       <span className="flex items-center gap-1">
                          <span className="material-icons-outlined">shopping_bag</span>
                          {order.items.length} {t('sale.items')}
                       </span>
                       <span className="text-[var(--brand-primary)] font-bold uppercase tracking-wider">{t('sale.total_label')} {formatPrice(order.total)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                       onClick={() => handleResume(order)}
                       className="px-4 py-2 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)] hover:text-white rounded-lg text-sm font-bold transition-all flex items-center gap-2"
                    >
                       <span className="material-icons-outlined">play_circle</span>
                       {t('orders.resume')}
                    </button>
                    <button 
                       onClick={() => handleDelete(order.id)}
                       className="p-2 text-gray-600 hover:text-red-500 transition-colors"
                       title={t('sale.delete')}
                    >
                       <span className="material-icons-outlined">delete_outline</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="px-6 py-4 border-t border-[#2C2C35] flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-[#25252D] text-white rounded-lg text-sm font-bold hover:bg-[#32323D] transition-colors"
          >
            {t('sale.close')}
          </button>
        </footer>
      </div>
    </div>
  );
}
