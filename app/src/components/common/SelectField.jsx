import React from 'react';

export function SelectField({ label, value, onChange, options = [], placeholder = 'Select...' }) {
  return (
    <div className="flex flex-col gap-1">
       <label className="text-[10px] font-bold uppercase text-[var(--text-muted)] ml-1">{label}</label>
       <select 
        value={value || ''} 
        onChange={e => onChange(e.target.value)}
        className="bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] outline-none focus:border-[var(--brand-primary)] transition-colors appearance-none cursor-pointer"
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((opt, idx) => (
          <option key={opt.code || idx} value={opt.code} className="bg-[var(--bg-input)] text-[var(--text-main)]">
            {opt.name}
          </option>
        ))}
      </select>
    </div>
  );
}
