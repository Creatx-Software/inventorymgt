import { useState } from 'react';
import { X, Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import clsx from 'clsx';
import { previewImport, commitImport, type ImportPreview, type ImportResult } from '../../api/import';
import { SearchableSelect } from '../ui/SearchableSelect';

type Step = 'upload' | 'mapping' | 'dryrun' | 'done';

export function ImportModal({
  open, onClose, assetType, title, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  assetType: string;
  title: string;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dryRunResult, setDryRunResult] = useState<ImportResult | null>(null);
  const [finalResult, setFinalResult] = useState<ImportResult | null>(null);

  const reset = () => {
    setStep('upload'); setFile(null); setPreview(null); setSelectedSheet('');
    setMapping({}); setLoading(false); setError(''); setDryRunResult(null); setFinalResult(null);
  };

  const close = () => { reset(); onClose(); };

  if (!open) return null;

  const handleFile = async (f: File) => {
    setFile(f);
    setLoading(true);
    setError('');
    try {
      const p = await previewImport(assetType, f);
      setPreview(p);
      const first = p.sheets.find((s) => s.totalRows > 0) || p.sheets[0];
      setSelectedSheet(first.sheet);
      setMapping(first.suggestedMapping);
      setStep('mapping');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to preview file');
    } finally { setLoading(false); }
  };

  const onSheetChange = (name: string) => {
    setSelectedSheet(name);
    const s = preview?.sheets.find((x) => x.sheet === name);
    if (s) setMapping(s.suggestedMapping);
  };

  const runDryRun = async () => {
    if (!file) return;
    setLoading(true); setError('');
    try {
      const r = await commitImport({ assetType, file, sheetName: selectedSheet, mapping, dryRun: true });
      setDryRunResult(r);
      setStep('dryrun');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Dry run failed');
    } finally { setLoading(false); }
  };

  const runCommit = async () => {
    if (!file) return;
    setLoading(true); setError('');
    try {
      const r = await commitImport({ assetType, file, sheetName: selectedSheet, mapping, dryRun: false });
      setFinalResult(r);
      setStep('done');
      onSuccess();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Import failed');
    } finally { setLoading(false); }
  };

  const currentSheet = preview?.sheets.find((s) => s.sheet === selectedSheet);
  const mappedCount = Object.values(mapping).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={close} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 h-16 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-semibold text-slate-900">Import {title} from Excel</div>
              <div className="text-xs text-slate-500">
                {step === 'upload' && 'Upload an .xlsx file'}
                {step === 'mapping' && 'Map columns to fields'}
                {step === 'dryrun' && 'Review preview before committing'}
                {step === 'done' && 'Import complete'}
              </div>
            </div>
          </div>
          <button onClick={close} className="btn-ghost p-2"><X className="w-5 h-5" /></button>
        </div>

        {/* Steps indicator */}
        <div className="px-6 py-3 border-b border-slate-200 bg-slate-50/60 flex items-center gap-2 shrink-0">
          {(['upload', 'mapping', 'dryrun', 'done'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={clsx(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold',
                step === s ? 'bg-brand-600 text-white' :
                  ['upload', 'mapping', 'dryrun', 'done'].indexOf(step) > i ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500',
              )}>{i + 1}</div>
              <span className={clsx('text-sm', step === s ? 'font-medium text-slate-900' : 'text-slate-500')}>
                {s === 'upload' ? 'Upload' : s === 'mapping' ? 'Map columns' : s === 'dryrun' ? 'Preview' : 'Done'}
              </span>
              {i < 3 && <div className="w-8 h-px bg-slate-300 mx-1" />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}

          {step === 'upload' && (
            <label className="block cursor-pointer">
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-brand-400 hover:bg-brand-50/30 transition">
                <Upload className="w-10 h-10 mx-auto text-slate-400 mb-3" />
                <div className="text-base font-medium text-slate-900">Click to upload an Excel file</div>
                <div className="text-xs text-slate-500 mt-1">.xlsx, .xls — up to 50 MB</div>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>
            </label>
          )}

          {step === 'mapping' && preview && currentSheet && (
            <div className="space-y-4">
              {/* Sheet selector */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-slate-700">Sheet:</label>
                <div className="w-72">
                  <SearchableSelect
                    value={selectedSheet}
                    onChange={onSheetChange}
                    options={preview.sheets.map((s) => ({ value: s.sheet, label: s.sheet, sublabel: `${s.totalRows} rows` }))}
                    emptyOption={null}
                  />
                </div>
                <span className="text-xs text-slate-500 ml-auto">
                  Mapped: <strong className="text-slate-900">{mappedCount}</strong> / {currentSheet.headers.length}
                </span>
              </div>

              {/* Mapping table */}
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">Excel Column</th>
                      <th className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">Sample</th>
                      <th className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">→ Target Field</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentSheet.headers.map((h) => (
                      <tr key={h} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-900">{h}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs max-w-xs truncate">
                          {currentSheet.sampleRows[0]?.[h] != null ? String(currentSheet.sampleRows[0][h]) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          <SearchableSelect
                            value={mapping[h] || ''}
                            onChange={(v) => setMapping({ ...mapping, [h]: v || null })}
                            options={preview.fields.map((f) => ({ value: f.key, label: f.label }))}
                            emptyOption="— Skip —"
                            placeholder="— Skip —"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'dryrun' && dryRunResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="card p-4">
                  <div className="text-xs font-medium text-slate-500 uppercase">Will insert</div>
                  <div className="text-3xl font-bold text-emerald-600 mt-1">{dryRunResult.inserted}</div>
                </div>
                <div className="card p-4">
                  <div className="text-xs font-medium text-slate-500 uppercase">Duplicates</div>
                  <div className="text-3xl font-bold text-amber-600 mt-1">{dryRunResult.duplicates}</div>
                  <div className="text-[10px] text-slate-400 mt-1">Same serial skipped</div>
                </div>
                <div className="card p-4">
                  <div className="text-xs font-medium text-slate-500 uppercase">Empty rows</div>
                  <div className="text-3xl font-bold text-slate-600 mt-1">{dryRunResult.skipped}</div>
                </div>
                <div className="card p-4">
                  <div className="text-xs font-medium text-slate-500 uppercase">Errors</div>
                  <div className="text-3xl font-bold text-red-600 mt-1">{dryRunResult.errors.length}</div>
                </div>
              </div>

              {dryRunResult.errors.length > 0 && (
                <div className="card p-4">
                  <div className="text-sm font-semibold text-slate-900 mb-2">Errors:</div>
                  <div className="max-h-64 overflow-y-auto space-y-1 text-xs font-mono">
                    {dryRunResult.errors.slice(0, 100).map((e, i) => (
                      <div key={i} className="text-red-600">Row {e.row}: {e.error}</div>
                    ))}
                    {dryRunResult.errors.length > 100 && (
                      <div className="text-slate-500">... and {dryRunResult.errors.length - 100} more</div>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                <strong>This is a dry run.</strong> Nothing has been saved yet. Click "Run import" to commit.
              </div>
            </div>
          )}

          {step === 'done' && finalResult && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-9 h-9 text-emerald-600" />
              </div>
              <div className="text-xl font-semibold text-slate-900">Import complete</div>
              <div className="text-sm text-slate-500 mt-2">
                <strong className="text-emerald-600">{finalResult.inserted}</strong> inserted ·{' '}
                <strong className="text-amber-600">{finalResult.duplicates}</strong> duplicates ·{' '}
                <strong className="text-slate-600">{finalResult.skipped}</strong> empty ·{' '}
                <strong className="text-red-600">{finalResult.errors.length}</strong> errors
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between shrink-0">
          <div>
            {(step === 'mapping' || step === 'dryrun') && (
              <button
                onClick={() => setStep(step === 'dryrun' ? 'mapping' : 'upload')}
                className="btn-secondary"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={close} className="btn-secondary">{step === 'done' ? 'Close' : 'Cancel'}</button>
            {step === 'mapping' && (
              <button onClick={runDryRun} disabled={loading || mappedCount === 0} className="btn-primary">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Preview import
              </button>
            )}
            {step === 'dryrun' && (
              <button onClick={runCommit} disabled={loading} className="btn-primary">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Run import
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
