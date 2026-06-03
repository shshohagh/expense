import React, { useState } from 'react';
import { Upload, X, Check, AlertCircle } from 'lucide-react';
import { read, utils } from 'xlsx';

export default function BankStatementImporter({ onClose, onImport }: { onClose: () => void, onImport: (data: any[]) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFile(file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = read(data, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = utils.sheet_to_json(worksheet);
      setPreview(json);
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="text-xl font-bold">Import Bank Statement</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"><X size={20} /></button>
        </div>
        <div className="p-6">
          <input type="file" accept=".csv, .xlsx" onChange={handleFileChange} className="hidden" id="file-upload" />
          <label htmlFor="file-upload" className="flex items-center gap-2 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
            <Upload size={20} /> {file ? file.name : 'Select CSV or Excel file'}
          </label>
          {preview.length > 0 && (
            <div className="mt-4 max-h-60 overflow-y-auto border rounded-lg p-2 dark:border-zinc-800">
               <pre className="text-xs">{JSON.stringify(preview[0], null, 2)}</pre>
               <p className="text-xs text-muted-foreground mt-2">Preview of first row detected.</p>
            </div>
          )}
        </div>
        <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800">Cancel</button>
          <button onClick={() => onImport(preview)} className="px-4 py-2 text-sm font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl hover:opacity-90">Import</button>
        </div>
      </div>
    </div>
  );
}
