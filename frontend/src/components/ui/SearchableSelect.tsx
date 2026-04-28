import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';
import clsx from 'clsx';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  emptyOption?: string | null;        // text for the "clear" item; null = no clear option
  disabled?: boolean;
  required?: boolean;
  className?: string;
  noResultsText?: string;
  /** Render the option row (defaults to label + optional sublabel) */
  renderOption?: (opt: SelectOption) => React.ReactNode;
  /** Render the trigger label (defaults to selected option's label) */
  renderValue?: (opt: SelectOption | undefined) => React.ReactNode;
}

export function SearchableSelect({
  value, onChange, options, placeholder = 'Select...',
  emptyOption = '— None —', disabled, required, className,
  noResultsText = 'No matches', renderOption, renderValue,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      o.label.toLowerCase().includes(q) ||
      (o.sublabel || '').toLowerCase().includes(q)
    );
  }, [query, options]);

  // Close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      setHighlight(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    setHighlight(0);
    listRef.current?.scrollTo({ top: 0 });
  }, [query]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) choose(opt.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div ref={wrapRef} className={clsx('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={clsx(
          'input flex items-center justify-between text-left',
          disabled && 'opacity-60 cursor-not-allowed',
          required && !value && 'border-slate-200',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={clsx('flex-1 truncate', !selected && 'text-slate-400')}>
          {renderValue
            ? renderValue(selected)
            : selected
              ? selected.label
              : placeholder}
        </span>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {selected && !disabled && emptyOption !== null && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); onChange(''); }}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              title="Clear"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={clsx('w-4 h-4 text-slate-400 transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full card p-0 max-h-80 flex flex-col shadow-lg">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search..."
                className="input pl-8 py-1 text-sm"
              />
            </div>
          </div>
          <ul ref={listRef} className="overflow-y-auto py-1" role="listbox">
            {emptyOption !== null && !query && (
              <li
                onClick={() => choose('')}
                className={clsx(
                  'px-3 py-1.5 text-sm cursor-pointer flex items-center gap-2',
                  !value
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-500 hover:bg-slate-50',
                )}
              >
                <span className="w-3.5 h-3.5 shrink-0">{!value && <Check className="w-3.5 h-3.5" />}</span>
                <span className="italic">{emptyOption}</span>
              </li>
            )}
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-sm text-slate-400 text-center">{noResultsText}</li>
            )}
            {filtered.map((opt, i) => {
              const isSelected = opt.value === value;
              const isHighlighted = i === highlight;
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => choose(opt.value)}
                  className={clsx(
                    'px-3 py-1.5 text-sm cursor-pointer flex items-center gap-2',
                    isHighlighted && !isSelected && 'bg-slate-50',
                    isSelected && 'bg-brand-50 text-brand-700',
                  )}
                >
                  <span className="w-3.5 h-3.5 shrink-0">{isSelected && <Check className="w-3.5 h-3.5" />}</span>
                  <div className="flex-1 min-w-0">
                    {renderOption ? renderOption(opt) : (
                      <>
                        <div className={clsx('truncate', isSelected && 'font-medium')}>{opt.label}</div>
                        {opt.sublabel && <div className="text-xs text-slate-500 truncate">{opt.sublabel}</div>}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
