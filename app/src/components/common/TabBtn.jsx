import React from 'react';

export function TabBtn({ label, active, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`pb-3 text-[11px] font-bold uppercase tracking-wider transition-all relative ${active ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
    >
      {label}
      {active && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[var(--brand-primary)]"></div>}
    </button>
  );
}
