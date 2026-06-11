import { useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';

/**
 * 4-octet IP input with auto-advance on dot/3-digit.
 *
 * The Add control lives in the header next to the label so the input row
 * never overflows horizontally inside a narrow drawer column.
 */
export function IpInput({
  label, value, onChange,
}: {
  label?: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [octets, setOctets] = useState<string[]>(['', '', '', '']);
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const setOctet = (i: number, v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 3);
    const numeric = Math.min(255, Math.max(0, Number(digits || 0)));
    const clean = digits === '' ? '' : String(numeric);
    const next = [...octets];
    next[i] = clean;
    setOctets(next);
    if (digits.length === 3 && i < 3) refs[i + 1].current?.focus();
  };

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '.') {
      e.preventDefault();
      if (i < 3) refs[i + 1].current?.focus();
    } else if (e.key === 'Backspace' && octets[i] === '' && i > 0) {
      refs[i - 1].current?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      addIp();
    }
  };

  const ipString = octets.every((o) => o !== '') ? octets.join('.') : '';
  const canAdd = ipString.length > 0 && !value.includes(ipString);

  const addIp = () => {
    if (!canAdd) return;
    onChange([...value, ipString]);
    setOctets(['', '', '', '']);
    refs[0].current?.focus();
  };

  const removeIp = (ip: string) => onChange(value.filter((x) => x !== ip));

  return (
    <div className="space-y-2">
      {/* Header: label + Add button */}
      {label !== undefined && (
        <div className="flex items-center justify-between">
          <label className="label mb-0">{label}</label>
          <button
            type="button"
            onClick={addIp}
            disabled={!canAdd}
            className="btn-secondary py-1 px-2.5 text-xs"
            title="Add IP"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
      )}

      {/* Octet inputs — even spacing, no overflow */}
      <div className="flex items-center gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-1.5 flex-1 min-w-0">
            <input
              ref={refs[i]}
              className="input w-full text-center font-mono py-1.5 px-1"
              inputMode="numeric"
              maxLength={3}
              value={octets[i]}
              onChange={(e) => setOctet(i, e.target.value)}
              onKeyDown={(e) => handleKey(i, e)}
            />
            {i < 3 && <span className="text-slate-400 font-mono select-none shrink-0">.</span>}
          </div>
        ))}
      </div>

      {/* Existing IPs as pills (below the boxes) */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((ip) => (
            <span
              key={ip}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono bg-slate-100 text-slate-700 border border-slate-200"
            >
              {ip}
              <button
                type="button"
                onClick={() => removeIp(ip)}
                className="text-slate-400 hover:text-red-500"
                title="Remove"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
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
