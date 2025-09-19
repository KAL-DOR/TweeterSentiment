/**
 * Centralized error handling utility
 * Provides consistent error handling, logging, and user-friendly error messages
 */

import { logger } from './logger';

export enum ErrorType {
  NETWORK = 'NETWORK_ERROR',
  API = 'API_ERROR',
  DATABASE = 'DATABASE_ERROR',
  VALIDATION = 'VALIDATION_ERROR',
  PROCESSING = 'PROCESSING_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR',
}

export interface AppError {
  type: ErrorType;
  message: string;
  originalError?: Error;
  context?: string;
  timestamp: string;
  userMessage: string;
}

export class ErrorHandler {
  private static instance: ErrorHandler;

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  private createAppError(
    type: ErrorType,
    message: string,
    originalError?: Error,
    context?: string,
    userMessage?: string
  ): AppError {
    return {
      type,
      message,
      originalError,
      context,
      timestamp: new Date().toISOString(),
      userMessage: userMessage || this.getDefaultUserMessage(type),
    };
  }

  private getDefaultUserMessage(type: ErrorType): string {
    switch (type) {
      case ErrorType.NETWORK:
        return 'Network connection error. Please check your internet connection and try again.';
      case ErrorType.API:
        return 'Service temporarily unavailable. Please try again later.';
      case ErrorType.DATABASE:
        return 'Database error occurred. Please try again or contact support.';
      case ErrorType.VALIDATION:
        return 'Invalid input provided. Please check your data and try again.';
      case ErrorType.PROCESSING:
        return 'Processing error occurred. Please try again.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  handleError(error: unknown, context?: string): AppError {
    let appError: AppError;

    if (error instanceof Error) {
      // Determine error type based on error message or properties
      const errorType = this.determineErrorType(error);
      appError = this.createAppError(
        errorType,
        error.message,
        error,
        context
      );
    } else if (typeof error === 'string') {
      appError = this.createAppError(
        ErrorType.UNKNOWN,
        error,
        undefined,
        context
      );
    } else {
      appError = this.createAppError(
        ErrorType.UNKNOWN,
        'Unknown error occurred',
        undefined,
        context
      );
    }

    // Log the error
    logger.error(appError.message, appError.context, {
      type: appError.type,
      originalError: appError.originalError,
      timestamp: appError.timestamp,
    });

    return appError;
  }

  private determineErrorType(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    if (name.includes('network') || message.includes('fetch') || message.includes('cors')) {
      return ErrorType.NETWORK;
    }
    if (message.includes('api') || message.includes('http') || message.includes('status')) {
      return ErrorType.API;
    }
    if (message.includes('database') || message.includes('supabase') || message.includes('sql')) {
      return ErrorType.DATABASE;
    }
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return ErrorType.VALIDATION;
    }
    if (message.includes('processing') || message.includes('analysis') || message.includes('sentiment')) {
      return ErrorType.PROCESSING;
    }

    return ErrorType.UNKNOWN;
  }

  // Convenience methods for specific error types
  handleNetworkError(error: Error, context?: string): AppError {
    return this.createAppError(ErrorType.NETWORK, error.message, error, context);
  }

  handleApiError(error: Error, context?: string): AppError {
    return this.createAppError(ErrorType.API, error.message, error, context);
  }

  handleDatabaseError(error: Error, context?: string): AppError {
    return this.createAppError(ErrorType.DATABASE, error.message, error, context);
  }

  handleValidationError(message: string, context?: string): AppError {
    return this.createAppError(ErrorType.VALIDATION, message, undefined, context);
  }

  handleProcessingError(error: Error, context?: string): AppError {
    return this.createAppError(ErrorType.PROCESSING, error.message, error, context);
  }

  // Utility method to check if error is retryable
  isRetryableError(error: AppError): boolean {
    switch (error.type) {
      case ErrorType.NETWORK:
      case ErrorType.API:
        return true;
      case ErrorType.DATABASE:
      case ErrorType.VALIDATION:
      case ErrorType.PROCESSING:
      case ErrorType.UNKNOWN:
      default:
        return false;
    }
  }

  // Utility method to get retry delay based on error type
  getRetryDelay(error: AppError, attempt: number): number {
    if (!this.isRetryableError(error)) {
      return 0;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, etc.
    return Math.min(1000 * Math.pow(2, attempt - 1), 30000);
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Export convenience functions
export const handleError = (error: unknown, context?: string): AppError => 
  errorHandler.handleError(error, context);

export const handleNetworkError = (error: Error, context?: string): AppError => 
  errorHandler.handleNetworkError(error, context);

export const handleApiError = (error: Error, context?: string): AppError => 
  errorHandler.handleApiError(error, context);

export const handleDatabaseError = (error: Error, context?: string): AppError => 
  errorHandler.handleDatabaseError(error, context);

export const handleValidationError = (message: string, context?: string): AppError => 
  errorHandler.handleValidationError(message, context);

export const handleProcessingError = (error: Error, context?: string): AppError => 
  errorHandler.handleProcessingError(error, context);
