/**
 * Application constants
 * Centralizes magic numbers, strings, and configuration values
 */

// API Configuration
export const API_CONFIG = {
  TIMEOUT: 30000, // 30 seconds
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
  BATCH_SIZE: 10,
  CONCURRENCY: 3,
} as const;

// Sentiment Analysis Configuration
export const SENTIMENT_CONFIG = {
  LEVELS: {
    VERY_NEGATIVE: -2,
    NEGATIVE: -1,
    NEUTRAL: 0,
    POSITIVE: 1,
    VERY_POSITIVE: 2,
  },
  CONFIDENCE_THRESHOLD: 0.7,
  NEUTRAL_TO_POSITIVE_THRESHOLD: 0.72,
} as const;

// Database Configuration
export const DATABASE_CONFIG = {
  DEFAULT_LIMIT: 1000,
  MAX_LIMIT: 5000,
  POLLING_INTERVAL: 10000, // 10 seconds
  POLLING_TIMEOUT: 180000, // 3 minutes
} as const;

// UI Configuration
export const UI_CONFIG = {
  ANIMATION_DURATION: 300,
  TOAST_DURATION: 4000,
  DEBOUNCE_DELAY: 500,
  GRAPH_HEIGHT: 600,
  MAX_CONTENT_LENGTH: 500,
} as const;

// Date Configuration
export const DATE_CONFIG = {
  RECENT_YEARS: [2024, 2025],
  DEFAULT_YEAR: 2025,
  DATE_FORMATS: {
    ISO: 'YYYY-MM-DDTHH:mm:ss.sssZ',
    DISPLAY: 'MMM DD, YYYY',
    TIME: 'HH:mm',
  },
} as const;

// Engagement Calculation Weights
export const ENGAGEMENT_WEIGHTS = {
  LIKES: 1,
  RETWEETS: 2,
  REPLIES: 3,
  VIEWS: 0.1,
} as const;

// File Configuration
export const FILE_CONFIG = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['application/pdf', 'text/csv', 'application/json'],
  EXPORT_FORMATS: ['pdf', 'csv', 'json'] as const,
} as const;

// Environment Configuration
export const ENV_CONFIG = {
  DEVELOPMENT: import.meta.env.DEV,
  PRODUCTION: import.meta.env.PROD,
  MODE: import.meta.env.MODE,
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK: 'Network connection error. Please check your internet connection.',
  API: 'Service temporarily unavailable. Please try again later.',
  DATABASE: 'Database error occurred. Please try again.',
  VALIDATION: 'Invalid input provided. Please check your data.',
  PROCESSING: 'Processing error occurred. Please try again.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
  MISSING_API_KEY: 'API key not configured',
  MISSING_ENV_VARS: 'Missing required environment variables',
  INVALID_DATE: 'Invalid date format',
  EMPTY_CONTENT: 'Content cannot be empty',
  RATE_LIMIT: 'Rate limit exceeded. Please try again later.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  PROCESSING_COMPLETE: 'Processing completed successfully',
  DATA_LOADED: 'Data loaded successfully',
  EXPORT_COMPLETE: 'Export completed successfully',
  KEYWORD_ADDED: 'Keyword added successfully',
  KEYWORD_DELETED: 'Keyword deleted successfully',
  TWEETS_CLEARED: 'Tweets cleared successfully',
  REPORT_GENERATED: 'Report generated successfully',
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  CLAUDE: {
    PRODUCTION: '/api/claude',
    DEVELOPMENT: 'http://localhost:3001/api/claude',
  },
  HEALTH: '/health',
  N8N_WEBHOOK: import.meta.env.VITE_N8N_WEBHOOK_URL || '',
} as const;

// Regex Patterns
export const REGEX_PATTERNS = {
  TWITTER_URL: /(?:twitter\.com|x\.com)\/([^\/]+)/,
  DATE_WITH_TIME: /(\w+)\s+(\d+),\s+(\d+)\s+at\s+(\d+):(\d+)\s+(AM|PM)/i,
  NUMBERS_ONLY: /[^\d]/g,
  EMOJI: /[\u{1F600}-\u{1F64F}]/gu,
  URL: /https?:\/\/[^\s]+/g,
  MENTION: /@\w+/g,
  HASHTAG: /#/g,
  EXCESSIVE_PUNCTUATION: /[.!?]{2,}/g,
  WHITESPACE: /\s+/g,
} as const;

// Month Names
export const MONTH_NAMES = {
  JANUARY: 'january',
  FEBRUARY: 'february',
  MARCH: 'march',
  APRIL: 'april',
  MAY: 'may',
  JUNE: 'june',
  JULY: 'july',
  AUGUST: 'august',
  SEPTEMBER: 'september',
  OCTOBER: 'october',
  NOVEMBER: 'november',
  DECEMBER: 'december',
} as const;

export const MONTH_NUMBERS: Record<string, string> = {
  [MONTH_NAMES.JANUARY]: '01',
  [MONTH_NAMES.FEBRUARY]: '02',
  [MONTH_NAMES.MARCH]: '03',
  [MONTH_NAMES.APRIL]: '04',
  [MONTH_NAMES.MAY]: '05',
  [MONTH_NAMES.JUNE]: '06',
  [MONTH_NAMES.JULY]: '07',
  [MONTH_NAMES.AUGUST]: '08',
  [MONTH_NAMES.SEPTEMBER]: '09',
  [MONTH_NAMES.OCTOBER]: '10',
  [MONTH_NAMES.NOVEMBER]: '11',
  [MONTH_NAMES.DECEMBER]: '12',
} as const;

// Sentiment Labels
export const SENTIMENT_LABELS = {
  VERY_NEGATIVE: 'very_negative',
  NEGATIVE: 'negative',
  NEUTRAL: 'neutral',
  POSITIVE: 'positive',
  VERY_POSITIVE: 'very_positive',
} as const;

// Processing Stages
export const PROCESSING_STAGES = {
  IDLE: 'idle',
  FETCHING: 'fetching',
  FILTERING: 'filtering',
  ANALYZING: 'analyzing',
  STORING: 'storing',
  COMPLETED: 'completed',
  ERROR: 'error',
} as const;

// Report Configuration
export const REPORT_CONFIG = {
  TOP_ACCOUNTS_LIMIT: 3,
  FIRST_TWEETS_LIMIT: 3,
  EXTREME_TWEETS_LIMIT: 3,
  PDF_MARGIN: 20,
  PDF_FONT_SIZE: {
    TITLE: 18,
    HEADING: 14,
    BODY: 12,
    SMALL: 10,
    FOOTER: 8,
  },
} as const;
