/**
 * Custom hook for managing processing statistics
 * Provides centralized state management for stats operations
 */

import { useState, useEffect, useCallback } from 'react';
import { ProcessingStats, AppError } from '@/types';
import { TweetService } from '@/lib/services';
import { logger } from '@/lib/logger';
import { errorHandler } from '@/lib/error-handler';

export interface UseStatsReturn {
  stats: ProcessingStats | null;
  loading: boolean;
  error: AppError | null;
  refresh: () => Promise<void>;
}

export function useStats(): UseStatsReturn {
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      logger.info('Refreshing processing stats', 'useStats');
      const newStats = await TweetService.getProcessingStats();
      setStats(newStats);
      logger.info('Stats refreshed successfully', 'useStats', newStats);
    } catch (err) {
      const appError = errorHandler.handleError(err, 'useStats.refresh');
      setError(appError);
      logger.error('Failed to refresh stats', 'useStats', appError);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load stats on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    stats,
    loading,
    error,
    refresh,
  };
}
