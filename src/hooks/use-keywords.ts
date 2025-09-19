/**
 * Custom hook for managing keywords
 * Provides centralized state management for keyword operations
 */

import { useState, useEffect, useCallback } from 'react';
import { Keyword, AppError } from '@/types';
import { KeywordService } from '@/lib/services';
import { logger } from '@/lib/logger';
import { errorHandler } from '@/lib/error-handler';

export interface UseKeywordsReturn {
  keywords: Keyword[];
  loading: boolean;
  error: AppError | null;
  addKeyword: (keyword: string) => Promise<void>;
  deleteKeyword: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useKeywords(): UseKeywordsReturn {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      logger.info('Refreshing keywords', 'useKeywords');
      const newKeywords = await KeywordService.getKeywords();
      setKeywords(newKeywords);
      logger.info(`Loaded ${newKeywords.length} keywords`, 'useKeywords');
    } catch (err) {
      const appError = errorHandler.handleError(err, 'useKeywords.refresh');
      setError(appError);
      logger.error('Failed to refresh keywords', 'useKeywords', appError);
    } finally {
      setLoading(false);
    }
  }, []);

  const addKeyword = useCallback(async (keyword: string) => {
    if (!keyword.trim()) {
      const appError = errorHandler.handleValidationError('Keyword cannot be empty', 'useKeywords.addKeyword');
      setError(appError);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      logger.info(`Adding keyword: ${keyword}`, 'useKeywords');
      const newKeyword = await KeywordService.addKeyword(keyword.trim());
      setKeywords(prev => [newKeyword, ...prev]);
      logger.info('Keyword added successfully', 'useKeywords', newKeyword);
    } catch (err) {
      const appError = errorHandler.handleError(err, 'useKeywords.addKeyword');
      setError(appError);
      logger.error('Failed to add keyword', 'useKeywords', appError);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteKeyword = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    
    try {
      logger.info(`Deleting keyword with id: ${id}`, 'useKeywords');
      await KeywordService.deleteKeyword(id);
      setKeywords(prev => prev.filter(k => k.id !== id));
      logger.info('Keyword deleted successfully', 'useKeywords');
    } catch (err) {
      const appError = errorHandler.handleError(err, 'useKeywords.deleteKeyword');
      setError(appError);
      logger.error('Failed to delete keyword', 'useKeywords', appError);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load keywords on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    keywords,
    loading,
    error,
    addKeyword,
    deleteKeyword,
    refresh,
  };
}
