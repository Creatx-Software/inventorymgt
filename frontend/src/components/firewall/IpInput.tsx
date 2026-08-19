import { useRef, useState } from 'react';
import { X } from 'lucide-react';

export function TagInput({
  label, value, onChange, placeholder = '', hint, suggestions = [],
}: {
  label?: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  hint?: string;
  suggestions?: string[];
}) {
  const [text, setText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filteredSuggestions = suggestions.filter(
    (s) => !value.includes(s) && s.toLowerCase().includes(text.toLowerCase()),
  );

  const addEntry = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
  };

  const commit = (override?: string) => {
    addEntry(override ?? text);
    setText('');
    setShowSuggestions(false);
    setActiveIdx(-1);
    inputRef.current?.focus();
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, filteredSuggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, -1));
        return;
      }
      if (e.key === 'Enter' && activeIdx >= 0) {
        e.preventDefault();
        commit(filteredSuggestions[activeIdx]);
        return;
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        setActiveIdx(-1);
        return;
      }
    }

    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && text === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    const parts = pasted.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      e.preventDefault();
      const next = [...value];
      for (const p of parts) if (p && !next.includes(p)) next.push(p);
      onChange(next);
      setText('');
      setShowSuggestions(false);
    }
  };

  const remove = (entry: string) => onChange(value.filter((x) => x !== entry));

  return (
    <div className="space-y-1.5">
      {label !== undefined && <label className="label mb-0">{label}</label>}

      <div className="relative" ref={wrapperRef}>
        {/* Tag input box */}
        <div
          className="flex flex-wrap gap-1.5 min-h-[38px] px-2.5 py-1.5 input cursor-text"
          onClick={() => { inputRef.current?.focus(); setShowSuggestions(true); }}
        >
          {value.map((entry) => (
            <span
              key={entry}
              className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-xs font-mono bg-brand-50 text-brand-700 border border-brand-200 shrink-0"
            >
              {entry}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => { e.stopPropagation(); remove(entry); }}
                className="text-brand-400 hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setShowSuggestions(true);
              setActiveIdx(-1);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => { setTimeout(() => setShowSuggestions(false), 150); }}
            onKeyDown={handleKey}
            onPaste={handlePaste}
            placeholder={value.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[80px] bg-transparent outline-none text-xs font-mono text-slate-700 placeholder:text-slate-400 placeholder:font-sans"
          />
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
            {filteredSuggestions.map((s, idx) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(s)}
                className={`w-full text-left px-3 py-2 text-xs font-mono transition-colors ${
                  idx === activeIdx
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

export const IP_SUGGESTIONS = ['UK LAN', 'UK COP', 'UK PABX', 'Germany LAN'];

export function IpInput({
  label, value, onChange,
}: {
  label?: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <TagInput
      label={label}
      value={value}
      onChange={onChange}
      placeholder="e.g. 192.168.1.0/24, Any, LAN_Net"
      hint="Type then press Enter or , to add. Accepts IPs, subnets (CIDR), hostnames, or named objects."
      suggestions={IP_SUGGESTIONS}
    />
  );
}

export function IpPills({ ips, max = 6 }: { ips: string[]; max?: number }) {
  if (!ips || ips.length === 0) return <span className="text-slate-300">—</span>;
  const shown = ips.slice(0, max);
  const more = ips.length - max;
  return (
    <div className="flex flex-wrap gap-1 max-w-[220px]">
      {shown.map((ip) => (
        <span key={ip} className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
          {ip}
        </span>
      ))}
      {more > 0 && (
        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-50 text-slate-500 border border-slate-200" title={ips.slice(max).join(', ')}>
          +{more} more
        </span>
      )}
    </div>
  );
}
