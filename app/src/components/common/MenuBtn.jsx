import React from 'react';

export function MenuBtn({ icon, label, active, onClick, badge, alertBadge, collapsed }) {
  return (
    <button 
      onClick={onClick} 
      className={`w-full py-4 flex flex-col items-center justify-center gap-1 transition-all border-b border-[var(--border-main)] relative group
        ${active ? 'bg-[var(--bg-page)] text-[var(--brand-primary)] border-l-2 border-l-[var(--brand-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-page)]/50'} 
      `}
      title={collapsed ? label : ''}
    >
      <div className="flex items-center justify-center shrink-0 mb-0.5">
        {icon}
      </div>
      
      {!collapsed && (
        <span className="text-[10px] font-bold tracking-tight uppercase px-1 text-center leading-tight">
          {label}
        </span>
      )}

      {badge !== undefined && (
        <span className={`absolute top-2 right-2 min-w-[17px] h-[17px] flex items-center justify-center px-1 rounded-full text-[9px] font-black 
          ${badge > 0 ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--border-main)] text-[var(--text-muted)]'}
        `}>
          {badge}
        </span>
      )}
      
      {alertBadge > 0 && (
        <span className="absolute top-1.5 right-1.5 min-w-[19px] h-[19px] flex items-center justify-center px-1 rounded-full text-[9px] font-black bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30 border-2 border-[var(--bg-sidebar)]">
          {alertBadge}
        </span>
      )}
    </button>
  );
}
