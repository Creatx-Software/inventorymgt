import { api } from './client';

export interface ImportField {
  key: string;
  label: string;
  kind: string;
  aliases?: string[];
}

export interface ImportSheet {
  sheet: string;
  headers: string[];
  sampleRows: any[];
  totalRows: number;
  suggestedMapping: Record<string, string | null>;
}

export interface ImportPreview {
  sheets: ImportSheet[];
  fields: ImportField[];
}

export interface ImportResult {
  inserted: number;
  skipped: number;
  duplicates: number;
  errors: { row: number; error: string }[];
}

export async function previewImport(assetType: string, file: File): Promise<ImportPreview> {
  const fd = new FormData();
  fd.append('file', file);
  const r = await api.post(`/import/preview/${assetType}`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return r.data;
}

export async function commitImport(args: {
  assetType: string;
  file: File;
  sheetName: string;
  mapping: Record<string, string | null>;
  dryRun: boolean;
}): Promise<ImportResult> {
  const fd = new FormData();
  fd.append('file', args.file);
  fd.append('sheetName', args.sheetName);
  fd.append('mapping', JSON.stringify(args.mapping));
  fd.append('dryRun', String(args.dryRun));
  const r = await api.post(`/import/commit/${args.assetType}`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return r.data;
}
