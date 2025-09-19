/**
 * Custom hook for managing tweet processing state
 * Provides centralized state management for processing operations
 */

import { useState, useCallback } from 'react';
import { ProcessingProgress, AppError } from '@/types';
import { logger } from '@/lib/logger';
import { errorHandler } from '@/lib/error-handler';

export interface UseProcessingReturn {
  isProcessing: boolean;
  progress: ProcessingProgress | null;
  error: AppError | null;
  startProcessing: () => Promise<void>;
  stopProcessing: () => void;
  clearError: () => void;
  updateProgress: (progress: ProcessingProgress) => void;
  setError: (error: unknown, context?: string) => void;
}

export function useProcessing(): UseProcessingReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [error, setErrorState] = useState<AppError | null>(null);

  const startProcessing = useCallback(async () => {
    setIsProcessing(true);
    setProgress(null);
    setErrorState(null);
    logger.info('Processing started', 'useProcessing');
  }, []);

  const stopProcessing = useCallback(() => {
    setIsProcessing(false);
    setProgress(null);
    logger.info('Processing stopped', 'useProcessing');
  }, []);

  const clearError = useCallback(() => {
    setErrorState(null);
    logger.debug('Error cleared', 'useProcessing');
  }, []);

  const updateProgress = useCallback((newProgress: ProcessingProgress) => {
    setProgress(newProgress);
    logger.debug(`Progress updated: ${newProgress.stage} ${newProgress.progress}%`, 'useProcessing');
  }, []);

  const setError = useCallback((error: unknown, context?: string) => {
    const appError = errorHandler.handleError(error, context);
    setErrorState(appError);
    setIsProcessing(false);
    setProgress(null);
    logger.error('Processing error occurred', 'useProcessing', appError);
  }, []);

  return {
    isProcessing,
    progress,
    error,
    startProcessing,
    stopProcessing,
    clearError,
    updateProgress,
    setError,
  };
}
