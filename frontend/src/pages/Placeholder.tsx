import { Construction } from 'lucide-react';

export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500 mt-1">This section is under construction</p>
      </div>
      <div className="card p-12 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-brand-500/30 mb-4">
          <Construction className="w-7 h-7 text-white" />
        </div>
        <div className="text-lg font-semibold text-slate-900">Coming soon</div>
        <p className="text-sm text-slate-500 mt-1 max-w-md">
          This page will be built in the next phase. The data tables, filters, and CRUD will arrive shortly.
        </p>
      </div>
    </div>
  );
}
