import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../db/indexedDB';
import { useTranslation } from '../../utils/i18n';

export function ReportsView({ formatPrice }) {
  const { t } = useTranslation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('today'); // 'today', 'week', 'month'

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const allOrders = await db.orders.toArray();
      setOrders(allOrders);
    } catch (err) {
      console.error('Failed to load orders for reports', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return orders.filter(order => {
      const orderDate = new Date(order.date);
      if (dateRange === 'today') return orderDate >= startOfToday;
      if (dateRange === 'week') return orderDate >= startOfWeek;
      if (dateRange === 'month') return orderDate >= startOfMonth;
      return true;
    }).filter(o => o.status === 'completed');
  }, [orders, dateRange]);

  const stats = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
    const orderCount = filteredOrders.length;
    const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    // Payment Method Breakdown
    const paymentMethods = {};
    filteredOrders.forEach(o => {
      const method = o.paymentMethod || 'Unknown';
      paymentMethods[method] = (paymentMethods[method] || 0) + (parseFloat(o.total) || 0);
    });

    // Top Products
    const productCounts = {};
    filteredOrders.forEach(o => {
      o.items.forEach(item => {
        const name = item.name;
        productCounts[name] = (productCounts[name] || 0) + item.quantity;
      });
    });

    const topProducts = Object.entries(productCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return { totalRevenue, orderCount, avgOrderValue, paymentMethods, topProducts };
  }, [filteredOrders]);

  const getPaymentLabel = (method) => {
    const m = method.toLowerCase();
    if (m.includes('cash') || m === 'cod') return { label: t('reports.payment_cash'), icon: 'payments', color: 'text-green-500' };
    if (m.includes('bank') || m === 'bacs') return { label: t('reports.payment_transfer'), icon: 'account_balance', color: 'text-[var(--brand-primary)]' };
    if (m.includes('stripe') || m.includes('card')) return { label: t('reports.payment_card'), icon: 'credit_card', color: 'text-purple-500' };
    return { label: method, icon: 'account_balance_wallet', color: 'text-gray-400' };
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--bg-page)]">
        <span className="material-icons-outlined animate-spin text-[var(--brand-primary)] text-4xl">sync</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-page)] overflow-hidden">
      <header className="h-16 border-b border-[var(--border-main)] flex items-center justify-between px-8 bg-[var(--bg-header)] shrink-0">
        <div className="flex items-center gap-3">
          <span className="material-icons-outlined text-[var(--brand-primary)]">analytics</span>
          <h2 className="text-[var(--text-main)] font-black text-sm uppercase tracking-[0.2em]">{t('reports.title')}</h2>
        </div>
        
        <div className="flex bg-[var(--bg-input)] p-1 rounded-xl border border-[var(--border-main)]">
           {[
             { id: 'today', label: t('reports.today') },
             { id: 'week', label: t('reports.last_7_days') },
             { id: 'month', label: t('reports.this_month') }
           ].map(range => (
             <button 
               key={range.id}
               onClick={() => setDateRange(range.id)}
               className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${dateRange === range.id ? 'bg-[var(--brand-primary)] text-white shadow-lg' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
             >
               {range.label}
             </button>
           ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl p-6 relative overflow-hidden group hover:border-[var(--brand-primary)]/50 transition-all shadow-xl">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <span className="material-icons-outlined text-8xl text-[var(--text-main)]">payments</span>
            </div>
            <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] mb-2">{t('reports.revenue')}</p>
            <h3 className="text-[var(--text-main)] font-black text-3xl tracking-tighter">{formatPrice(stats.totalRevenue)}</h3>
            <div className="mt-4 flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-green-500"></span>
               <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest">{t('reports.realtime')}</span>
            </div>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl p-6 relative overflow-hidden group hover:border-[var(--brand-primary)]/50 transition-all shadow-xl">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <span className="material-icons-outlined text-8xl text-[var(--text-main)]">receipt_long</span>
            </div>
            <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] mb-2">{t('reports.orders')}</p>
            <h3 className="text-[var(--text-main)] font-black text-3xl tracking-tighter">{stats.orderCount}</h3>
            <div className="mt-4 text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest">{t('reports.completed_sales')}</div>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl p-6 relative overflow-hidden group hover:border-[var(--brand-primary)]/50 transition-all shadow-xl">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <span className="material-icons-outlined text-8xl text-[var(--text-main)]">shopping_bag</span>
            </div>
            <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] mb-2">{t('reports.avg_order')}</p>
            <h3 className="text-[var(--text-main)] font-black text-3xl tracking-tighter">{formatPrice(stats.avgOrderValue)}</h3>
            <div className="mt-4 text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest">{t('reports.customer_value')}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Revenue by Payment Method */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-[32px] overflow-hidden shadow-2xl flex flex-col">
            <header className="px-8 py-6 border-b border-[var(--border-main)] flex items-center justify-between">
               <h3 className="text-[var(--text-main)] font-black text-xs uppercase tracking-[0.2em]">{t('reports.payment_revenue')}</h3>
               <span className="material-icons-outlined text-[var(--text-muted)] opacity-30">pie_chart</span>
            </header>
            <div className="p-8 space-y-6">
              {Object.entries(stats.paymentMethods).length > 0 ? (
                Object.entries(stats.paymentMethods).map(([method, amount]) => {
                  const meta = getPaymentLabel(method);
                  const percentage = (amount / stats.totalRevenue) * 100;
                  return (
                    <div key={method} className="space-y-2">
                       <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                             <span className={`material-icons-outlined text-sm ${meta.color}`}>{meta.icon}</span>
                             <span className="text-[var(--text-main)] font-bold text-sm tracking-tight">{meta.label}</span>
                          </div>
                          <span className="text-[var(--brand-primary)] font-black text-sm">{formatPrice(amount)}</span>
                       </div>
                       <div className="h-2 bg-[var(--bg-input)] rounded-full overflow-hidden border border-[var(--border-main)]">
                          <div 
                            className={`h-full bg-[var(--brand-primary)] shadow-[0_0_10px_var(--brand-primary)/30] transition-all duration-1000`} 
                            style={{ width: `${percentage}%` }}
                          />
                       </div>
                       <div className="flex justify-end">
                          <span className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest">{percentage.toFixed(1)}%</span>
                       </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-[var(--text-muted)] italic text-sm">{t('reports.no_payment_data')}</div>
              )}
            </div>
          </div>

          {/* Top Selling Products */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-[32px] overflow-hidden shadow-2xl flex flex-col">
            <header className="px-8 py-6 border-b border-[var(--border-main)] flex items-center justify-between">
               <h3 className="text-[var(--text-main)] font-black text-xs uppercase tracking-[0.2em]">{t('reports.top_products')}</h3>
               <span className="material-icons-outlined text-[var(--text-muted)] opacity-30">stars</span>
            </header>
            <div className="p-8">
               <div className="space-y-4">
                   {stats.topProducts.length > 0 ? (
                    stats.topProducts.map((product, idx) => (
                      <div key={idx} className="flex items-center gap-4 bg-[var(--bg-input)] p-4 rounded-2xl border border-[var(--border-main)] group hover:border-[var(--brand-primary)]/30 transition-all border-l-4" style={{ borderLeftColor: idx === 0 ? 'var(--brand-primary)' : 'var(--border-main)' }}>
                         <div className="w-8 h-8 rounded-full bg-[var(--bg-card)] border border-[var(--border-main)] flex items-center justify-center shrink-0">
                            <span className="text-[var(--brand-primary)] font-black text-xs">#{idx + 1}</span>
                         </div>
                         <div className="flex-1 min-w-0">
                            <p className="text-[var(--text-main)] font-bold text-sm truncate">{product.name}</p>
                            <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest">{product.count} {t('reports.units_sold')}</p>
                         </div>
                         <div className="text-right">
                            <span className="material-icons-outlined text-[var(--text-muted)] opacity-30 group-hover:text-green-500 group-hover:opacity-100 transition-all">trending_up</span>
                         </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-[var(--text-muted)] italic text-sm">{t('reports.no_product_data')}</div>
                  )}
               </div>
            </div>
          </div>
        </div>

        {/* Sales Summary Table */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-[32px] overflow-hidden shadow-2xl">
           <header className="px-8 py-6 border-b border-[var(--border-main)] flex justify-between items-center bg-[var(--bg-header)]">
              <h3 className="text-[var(--text-main)] font-black text-xs uppercase tracking-[0.2em]">{t('reports.recent_transactions')}</h3>
              <button onClick={loadOrders} className="p-2 text-[var(--text-muted)] hover:text-[var(--brand-primary)] transition-colors"><span className="material-icons-outlined">refresh</span></button>
           </header>
           <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                 <thead>
                    <tr className="bg-[var(--bg-header)]">
                       <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] border-b border-[var(--border-main)]">{t('reports.col_order_id')}</th>
                       <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] border-b border-[var(--border-main)]">{t('reports.col_date')}</th>
                       <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] border-b border-[var(--border-main)]">{t('reports.col_customer')}</th>
                       <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] border-b border-[var(--border-main)]">{t('reports.col_payment')}</th>
                       <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] border-b border-[var(--border-main)] text-right">{t('reports.col_total')}</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-[var(--border-main)]">
                    {filteredOrders.length > 0 ? (
                      filteredOrders.slice(0, 5).map(order => (
                        <tr key={order.id} className="hover:bg-[var(--bg-page)] transition-colors group">
                           <td className="px-8 py-4 text-xs font-black text-[var(--text-main)]">#{order.id}</td>
                           <td className="px-8 py-4 text-xs text-[var(--text-muted)] font-bold">{new Date(order.date).toLocaleDateString()}</td>
                           <td className="px-8 py-4 text-xs text-[var(--text-muted)]">{order.customerName || t('customers.guest')}</td>
                           <td className="px-8 py-4">
                              <span className="text-[10px] font-black uppercase tracking-widest bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] px-2 py-1 rounded border border-[var(--brand-primary)]/20">{order.paymentMethod}</span>
                           </td>
                           <td className="px-8 py-4 text-right">
                              <span className="text-[var(--text-main)] font-extrabold text-sm">{formatPrice(order.total)}</span>
                           </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="px-8 py-12 text-center text-[var(--text-muted)] italic text-sm">{t('reports.no_transactions')}</td>
                      </tr>
                    )}
                 </tbody>
              </table>
           </div>
        </div>
      </div>
    </div>
  );
}
