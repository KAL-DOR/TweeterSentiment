/**
 * Centralized logging utility for the application
 * Provides consistent logging with different levels and optional formatting
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: unknown;
}

class Logger {
  private currentLevel: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = import.meta.env.DEV;
    this.currentLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO;
  }

  private formatMessage(level: LogLevel, message: string, context?: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const contextStr = context ? `[${context}]` : '';
    
    return `${timestamp} ${levelName}${contextStr}: ${message}`;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.currentLevel;
  }

  private log(level: LogLevel, message: string, context?: string, data?: unknown): void {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, context, data);
    
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, data || '');
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, data || '');
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, data || '');
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, data || '');
        break;
    }
  }

  debug(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, context, data);
  }

  info(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, context, data);
  }

  warn(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, context, data);
  }

  error(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, context, data);
  }

  // Convenience methods for common patterns
  apiCall(endpoint: string, method: string, data?: unknown): void {
    this.debug(`API ${method} ${endpoint}`, 'API', data);
  }

  apiResponse(endpoint: string, status: number, data?: unknown): void {
    const level = status >= 400 ? LogLevel.ERROR : LogLevel.INFO;
    this.log(level, `API Response ${status} ${endpoint}`, 'API', data);
  }

  processingStep(step: string, progress?: number, data?: unknown): void {
    const message = progress !== undefined ? `${step} (${progress}%)` : step;
    this.info(message, 'PROCESSING', data);
  }

  databaseOperation(operation: string, table: string, data?: unknown): void {
    this.debug(`${operation} on ${table}`, 'DATABASE', data);
  }

  sentimentAnalysis(text: string, result?: unknown): void {
    this.debug(`Analyzing: "${text.substring(0, 50)}..."`, 'SENTIMENT', result);
  }

  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions for common use cases
export const logApiCall = (endpoint: string, method: string, data?: unknown) => 
  logger.apiCall(endpoint, method, data);

export const logApiResponse = (endpoint: string, status: number, data?: unknown) => 
  logger.apiResponse(endpoint, status, data);

export const logProcessingStep = (step: string, progress?: number, data?: unknown) => 
  logger.processingStep(step, progress, data);

export const logDatabaseOperation = (operation: string, table: string, data?: unknown) => 
  logger.databaseOperation(operation, table, data);

export const logSentimentAnalysis = (text: string, result?: unknown) => 
  logger.sentimentAnalysis(text, result);
