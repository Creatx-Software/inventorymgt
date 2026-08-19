import { useRef, useState } from 'react';
import { X } from 'lucide-react';

export function IpInput({
  label, value, onChange, placeholder = 'e.g. 192.168.1.0/24, Any, LAN_Net',
}: {
  label?: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addEntry = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
  };

  const commit = () => {
    addEntry(text);
    setText('');
    inputRef.current?.focus();
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && text === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  // Support pasting multiple entries split by comma, newline, or semicolon
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    const parts = pasted.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      e.preventDefault();
      const next = [...value];
      for (const p of parts) if (p && !next.includes(p)) next.push(p);
      onChange(next);
      setText('');
    }
  };

  const remove = (entry: string) => onChange(value.filter((x) => x !== entry));

  return (
    <div className="space-y-1.5">
      {label !== undefined && <label className="label mb-0">{label}</label>}

      {/* Tag input box */}
      <div
        className="flex flex-wrap gap-1.5 min-h-[38px] px-2.5 py-1.5 input cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((entry) => (
          <span
            key={entry}
            className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-xs font-mono bg-brand-50 text-brand-700 border border-brand-200 shrink-0"
          >
            {entry}
            <button
              type="button"
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
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          onPaste={handlePaste}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-xs font-mono text-slate-700 placeholder:text-slate-400 placeholder:font-sans"
        />
      </div>
      <p className="text-[11px] text-slate-400">Type then press Enter or , to add. Accepts IPs, subnets (CIDR), hostnames, or named objects.</p>
    </div>
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
