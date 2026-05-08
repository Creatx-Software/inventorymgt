import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

export function Drawer({
  open, onClose, title, subtitle, children, footer, width = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'sm' | 'md' | 'lg';
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Body scroll lock while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const widthClass = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' }[width];

  return createPortal(
    <div
      className={clsx('fixed z-40', !open && 'pointer-events-none')}
      style={{ top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}
    >
      <div
        className={clsx(
          'absolute bg-slate-900/40 backdrop-blur-sm transition-opacity',
          open ? 'opacity-100' : 'opacity-0',
        )}
        style={{ top: 0, left: 0, right: 0, bottom: 0 }}
        onClick={onClose}
      />
      <div
        className={clsx(
          'absolute right-0 top-0 h-full w-full bg-white shadow-2xl flex flex-col transition-transform duration-200',
          widthClass,
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="px-6 h-16 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <div className="text-base font-semibold text-slate-900">{title}</div>
            {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="btn-ghost p-2"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
