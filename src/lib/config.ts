/**
 * Application configuration
 * Centralizes all configuration values and settings
 */

import { AppConfig } from '@/types';
import { API_CONFIG, SENTIMENT_CONFIG, DATABASE_CONFIG, UI_CONFIG } from './constants';

// Main application configuration
export const config: AppConfig = {
  api: {
    timeout: API_CONFIG.TIMEOUT,
    maxRetries: API_CONFIG.MAX_RETRIES,
    retryDelay: API_CONFIG.RETRY_DELAY,
    batchSize: API_CONFIG.BATCH_SIZE,
    concurrency: API_CONFIG.CONCURRENCY,
  },
  sentiment: {
    levels: SENTIMENT_CONFIG.LEVELS,
    confidenceThreshold: SENTIMENT_CONFIG.CONFIDENCE_THRESHOLD,
    neutralToPositiveThreshold: SENTIMENT_CONFIG.NEUTRAL_TO_POSITIVE_THRESHOLD,
  },
  database: {
    defaultLimit: DATABASE_CONFIG.DEFAULT_LIMIT,
    maxLimit: DATABASE_CONFIG.MAX_LIMIT,
    pollingInterval: DATABASE_CONFIG.POLLING_INTERVAL,
    pollingTimeout: DATABASE_CONFIG.POLLING_TIMEOUT,
  },
  ui: {
    animationDuration: UI_CONFIG.ANIMATION_DURATION,
    toastDuration: UI_CONFIG.TOAST_DURATION,
    debounceDelay: UI_CONFIG.DEBOUNCE_DELAY,
    graphHeight: UI_CONFIG.GRAPH_HEIGHT,
    maxContentLength: UI_CONFIG.MAX_CONTENT_LENGTH,
  },
};

// Feature flags
export const featureFlags = {
  enableAdvancedCharts: true,
  enableRealTimeUpdates: true,
  enableExportFeatures: true,
  enableKeywordManagement: true,
  enableReportGeneration: true,
  enableBatchProcessing: true,
  enableErrorRecovery: true,
  enablePerformanceOptimization: true,
} as const;

// Theme configuration
export const themeConfig = {
  colors: {
    primary: '#3b82f6',
    secondary: '#64748b',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#06b6d4',
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  },
} as const;

// Chart configuration
export const chartConfig = {
  colors: {
    veryPositive: '#10b981',
    positive: '#34d399',
    neutral: '#f59e0b',
    negative: '#f87171',
    veryNegative: '#ef4444',
  },
  animations: {
    duration: 300,
    easing: 'ease-in-out',
  },
  responsive: {
    breakpoints: {
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
    },
  },
} as const;

// Performance configuration
export const performanceConfig = {
  debounceDelay: 300,
  throttleDelay: 100,
  maxConcurrentRequests: 5,
  requestTimeout: 30000,
  retryAttempts: 3,
  cacheTimeout: 300000, // 5 minutes
} as const;

// Security configuration
export const securityConfig = {
  maxContentLength: 10000,
  allowedFileTypes: ['text/plain', 'application/json'],
  maxFileSize: 10 * 1024 * 1024, // 10MB
  sanitizeInput: true,
  validateUrls: true,
} as const;

// Export all configurations
export default {
  config,
  featureFlags,
  themeConfig,
  chartConfig,
  performanceConfig,
  securityConfig,
};
