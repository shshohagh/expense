import { auth } from '../firebase';

export interface CategorySuggestionResult {
  suggestedCategoryId: string | null;
  suggestedCategoryName: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;
  isNewCategory: boolean;
  aiPowered?: boolean;
}

export async function suggestCategoryForDescription(
  description: string,
  type: 'INCOME' | 'EXPENSE' = 'EXPENSE',
  categories?: any[]
): Promise<CategorySuggestionResult | null> {
  if (!description || !description.trim()) return null;

  try {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : '';

    const res = await fetch('/api/ai/suggest-category', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        description,
        type,
        categories
      })
    });

    if (!res.ok) {
      console.warn('Category suggestion API responded with non-200 status');
      return null;
    }

    const data: CategorySuggestionResult = await res.json();
    return data;
  } catch (error) {
    console.error('Error suggesting category with AI:', error);
    return null;
  }
}

export async function batchSuggestCategoriesForItems(
  items: Array<{ id?: string; description: string; type?: 'INCOME' | 'EXPENSE' }>,
  categories?: any[]
): Promise<Array<{ itemKey: string } & CategorySuggestionResult>> {
  if (!items || items.length === 0) return [];

  try {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : '';

    const res = await fetch('/api/ai/batch-suggest-categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        items,
        categories
      })
    });

    if (!res.ok) {
      console.warn('Batch category suggestion API responded with non-200 status');
      return [];
    }

    const data = await res.json();
    return data.suggestions || [];
  } catch (error) {
    console.error('Error in batch category suggestion with AI:', error);
    return [];
  }
}
