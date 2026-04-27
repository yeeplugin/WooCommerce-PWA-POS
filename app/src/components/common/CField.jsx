import React from 'react';

export function CField({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
       <label className="text-[10px] font-bold uppercase text-[var(--text-muted)] ml-1">{label}</label>
       <input 
        type="text" 
        value={value || ''} 
        onChange={e => onChange(e.target.value)}
        className="bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] outline-none focus:border-[var(--brand-primary)] transition-colors"
      />
    </div>
  );
}
