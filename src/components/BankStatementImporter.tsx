import React, { useState } from 'react';
import { Upload, X, Check, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import { read, utils } from 'xlsx';
import { batchSuggestCategoriesForItems } from '../services/aiCategoryService';

export default function BankStatementImporter({ onClose, onImport }: { onClose: () => void, onImport: (data: any[]) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [categorizedStatus, setCategorizedStatus] = useState<string | null>(null);

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
      const json: any[] = utils.sheet_to_json(worksheet);
      setPreview(json);
      setCategorizedStatus(null);
    };
    reader.readAsBinaryString(file);
  };

  const handleAiAutoCategorize = async () => {
    if (!preview || preview.length === 0) return;

    setIsCategorizing(true);
    try {
      // Find key for description in rows
      const items = preview.map((row, idx) => {
        const desc = row.Description || row.description || row.Details || row.memo || row.Narration || Object.values(row)[0] || '';
        const amt = parseFloat(row.Amount || row.amount || 0);
        return {
          id: String(idx),
          description: String(desc),
          type: (amt < 0 ? 'EXPENSE' : 'INCOME') as 'INCOME' | 'EXPENSE'
        };
      });

      const suggestions = await batchSuggestCategoriesForItems(items);

      const updatedPreview = preview.map((row, idx) => {
        const match = suggestions.find(s => s.itemKey === String(idx));
        if (match) {
          return {
            ...row,
            categoryName: match.suggestedCategoryName,
            categoryId: match.suggestedCategoryId || '',
            aiReasoning: match.reasoning,
            aiConfidence: match.confidence
          };
        }
        return row;
      });

      setPreview(updatedPreview);
      setCategorizedStatus(`Successfully auto-categorized ${preview.length} transactions using AI.`);
    } catch (err) {
      console.error('Batch categorization error:', err);
    } finally {
      setIsCategorizing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            Import Bank Statement
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          <input type="file" accept=".csv, .xlsx" onChange={handleFileChange} className="hidden" id="file-upload" />
          <label htmlFor="file-upload" className="flex items-center justify-center gap-2 px-4 py-4 bg-zinc-50 dark:bg-zinc-800/80 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <Upload size={20} className="text-indigo-600 dark:text-indigo-400" />
            <span className="font-medium text-sm">{file ? file.name : 'Click to upload CSV or Excel bank statement'}</span>
          </label>

          {preview.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  {preview.length} Transactions Detected
                </span>

                <button
                  type="button"
                  onClick={handleAiAutoCategorize}
                  disabled={isCategorizing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isCategorizing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Auto-Categorizing...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} /> Auto-Categorize with AI
                    </>
                  )}
                </button>
              </div>

              {categorizedStatus && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <Check size={14} /> {categorizedStatus}
                </div>
              )}

              <div className="max-h-60 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-500 font-medium sticky top-0">
                    <tr>
                      <th className="p-2.5">Row #</th>
                      <th className="p-2.5">Description</th>
                      <th className="p-2.5">Amount</th>
                      <th className="p-2.5">Category (AI)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {preview.slice(0, 15).map((row, idx) => {
                      const desc = row.Description || row.description || row.Details || row.memo || row.Narration || Object.values(row)[0] || '';
                      const amt = row.Amount || row.amount || row.Value || '';
                      return (
                        <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50">
                          <td className="p-2.5 font-mono text-zinc-400">{idx + 1}</td>
                          <td className="p-2.5 font-medium max-w-[200px] truncate">{String(desc)}</td>
                          <td className="p-2.5 font-mono">{String(amt)}</td>
                          <td className="p-2.5">
                            {row.categoryName ? (
                              <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                                <Sparkles size={10} /> {row.categoryName}
                              </span>
                            ) : (
                              <span className="text-zinc-400 italic">Uncategorized</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {preview.length > 15 && (
                <p className="text-xs text-zinc-400 text-center">Showing first 15 of {preview.length} rows</p>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Cancel
          </button>
          <button 
            onClick={() => onImport(preview)} 
            disabled={preview.length === 0}
            className="px-4 py-2 text-sm font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl hover:opacity-90 disabled:opacity-40"
          >
            Import {preview.length > 0 ? `(${preview.length} items)` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
