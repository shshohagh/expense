import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Check, Plus, Loader2, ArrowRight } from 'lucide-react';
import { suggestCategoryForDescription, CategorySuggestionResult } from '../services/aiCategoryService';
import { addCategory } from '../services/firestoreService';
import { Category } from '../types';

interface AiCategorySuggestionBadgeProps {
  description: string;
  type?: 'INCOME' | 'EXPENSE';
  categories: Category[];
  currentCategoryId: string;
  onSelectCategory: (categoryId: string, categoryName: string) => void;
  userId?: string;
  className?: string;
}

export default function AiCategorySuggestionBadge({
  description,
  type = 'EXPENSE',
  categories,
  currentCategoryId,
  onSelectCategory,
  userId,
  className = ''
}: AiCategorySuggestionBadgeProps) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<CategorySuggestionResult | null>(null);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [hasManuallyDismissed, setHasManuallyDismissed] = useState(false);
  const prevDescriptionRef = useRef('');

  // Debounced AI suggestion on description change
  useEffect(() => {
    const trimmed = description.trim();
    if (trimmed.length < 3) {
      setSuggestion(null);
      setLoading(false);
      return;
    }

    if (trimmed === prevDescriptionRef.current) return;
    prevDescriptionRef.current = trimmed;
    setHasManuallyDismissed(false);

    const timer = setTimeout(async () => {
      setLoading(true);
      const res = await suggestCategoryForDescription(trimmed, type, categories);
      setSuggestion(res);
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [description, type, categories]);

  const handleManualSuggest = async () => {
    const trimmed = description.trim();
    if (!trimmed) return;

    setLoading(true);
    setHasManuallyDismissed(false);
    const res = await suggestCategoryForDescription(trimmed, type, categories);
    setSuggestion(res);
    setLoading(false);
  };

  const handleApply = async () => {
    if (!suggestion) return;

    // Case 1: Existing matched category
    if (suggestion.suggestedCategoryId) {
      onSelectCategory(suggestion.suggestedCategoryId, suggestion.suggestedCategoryName);
      return;
    }

    // Case 2: Suggested new category
    if (userId && suggestion.suggestedCategoryName) {
      setIsCreatingCategory(true);
      try {
        const newCatId = await addCategory({
          name: suggestion.suggestedCategoryName,
          type: type,
          userId: userId
        });
        if (newCatId) {
          onSelectCategory(newCatId, suggestion.suggestedCategoryName);
        }
      } catch (err) {
        console.error('Failed to auto-create category:', err);
      } finally {
        setIsCreatingCategory(false);
      }
    }
  };

  const isApplied = suggestion && (
    (suggestion.suggestedCategoryId && String(currentCategoryId) === String(suggestion.suggestedCategoryId)) ||
    (categories.some(c => String(c.id) === String(currentCategoryId) && c.name.toLowerCase() === suggestion.suggestedCategoryName.toLowerCase()))
  );

  if (!description || description.trim().length < 2) {
    return null;
  }

  if (hasManuallyDismissed) {
    return null;
  }

  return (
    <div className={`mt-2 ${className}`}>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 px-3 py-2 rounded-xl animate-pulse">
          <Loader2 size={14} className="animate-spin text-indigo-500" />
          <span>AI analyzing description for smart category suggestion...</span>
        </div>
      ) : suggestion ? (
        <div className="bg-gradient-to-r from-indigo-50/90 via-purple-50/70 to-blue-50/90 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-blue-950/40 border border-indigo-200/80 dark:border-indigo-800/80 rounded-xl p-3 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              <Sparkles size={14} className="text-indigo-600 dark:text-indigo-400 fill-indigo-100 dark:fill-indigo-900" />
              <span>AI Category Match</span>
              <span className={`px-1.5 py-0.5 text-[10px] uppercase font-bold rounded-md ${
                suggestion.confidence === 'HIGH' 
                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
              }`}>
                {suggestion.confidence} CONFIDENCE
              </span>
            </div>
            
            <button
              type="button"
              onClick={() => setHasManuallyDismissed(true)}
              className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 px-1"
            >
              ×
            </button>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                "{suggestion.suggestedCategoryName}"
              </span>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-1 mt-0.5">
                {suggestion.reasoning}
              </p>
            </div>

            {isApplied ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 px-2.5 py-1 rounded-lg">
                <Check size={12} /> Applied
              </span>
            ) : (
              <button
                type="button"
                onClick={handleApply}
                disabled={isCreatingCategory}
                className="inline-flex items-center gap-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {isCreatingCategory ? (
                  <>
                    <Loader2 size={12} className="animate-spin" /> Adding...
                  </>
                ) : suggestion.suggestedCategoryId ? (
                  <>
                    Apply <ArrowRight size={12} />
                  </>
                ) : (
                  <>
                    <Plus size={12} /> Create & Apply
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleManualSuggest}
          className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium py-1 px-1 transition-colors"
        >
          <Sparkles size={13} />
          Auto-Suggest Category with AI
        </button>
      )}
    </div>
  );
}
