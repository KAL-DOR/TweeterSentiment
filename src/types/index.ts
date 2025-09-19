/**
 * Centralized type definitions for the application
 * Provides consistent typing across all components and services
 */

// Sentiment analysis types - 5-level scale
export type SentimentType = 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive';

// Processing stages
export type ProcessingStage = 'idle' | 'fetching' | 'filtering' | 'analyzing' | 'storing' | 'completed' | 'error';

// Raw tweet data from database
export interface RawTweet {
  tweet_id: number;
  created_at?: string;
  URL?: string;
  Content?: string;
  Likes?: string;
  Retweets?: string;
  Replies?: string;
  Quotes?: string;
  Views?: string;
  Date?: string;
}

// Processed tweet with sentiment analysis
export interface ProcessedTweet {
  id?: number;
  original_tweet_id: number;
  content: string;
  processed_content?: string;
  sentiment: SentimentType;
  confidence: number;
  likes_count?: number;
  retweets_count?: number;
  replies_count?: number;
  views_count?: number;
  tweet_date: string | Date;
  processed_at?: string;
}

// Sentiment analysis result from API
export interface SentimentAnalysisResult {
  sentiment: SentimentType;
  confidence: number;
  sentimentValue: number;
  label: string;
  score: number;
}

// Keyword for tweet search
export interface Keyword {
  id?: number;
  keyword: string;
  created_at?: string;
}

// API response types
export interface ProcessingStats {
  totalTweets: number;
  processedTweets: number;
  remainingTweets: number;
  lastProcessedDate?: string;
}

export interface ProcessingProgress {
  stage: ProcessingStage;
  progress: number;
  message: string;
  error?: string;
}

// Report data interfaces
export interface TopAccount {
  username: string;
  totalEngagement: number;
  tweetCount: number;
  avgEngagement: number;
}

export interface FirstTweetAccount {
  username: string;
  tweetId: number;
  content: string;
  date: string;
  engagement: number;
}

export interface ExtremeTweet {
  tweetId: number;
  content: string;
  username: string;
  sentiment: SentimentType;
  confidence: number;
  engagement: number;
  date: string;
}

export interface KeywordSentiment {
  keyword: string;
  totalTweets: number;
  sentimentBreakdown: {
    very_positive: number;
    positive: number;
    neutral: number;
    negative: number;
    very_negative: number;
  };
  overallSentiment: SentimentType;
  sentimentScore: number;
}

export interface ReportData {
  generatedAt: string;
  totalTweets: number;
  processedTweets: number;
  dateRange: {
    earliest: string;
    latest: string;
  };
  topAccounts: TopAccount[];
  firstTweetAccounts: FirstTweetAccount[];
  mostNegativeTweets: ExtremeTweet[];
  mostPositiveTweets: ExtremeTweet[];
  keywordSentiments: KeywordSentiment[];
}

// Graph data types
export interface GraphDataPoint {
  x: number;
  y: number;
  sentiment: string;
  confidence: number;
  tweetId: number;
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Environment configuration
export interface EnvironmentConfig {
  isDevelopment: boolean;
  isProduction: boolean;
  mode: string;
  supabaseUrl: string;
  supabaseKey: string;
  huggingfaceApiKey: string;
  anthropicApiKey: string;
  n8nWebhookUrl: string;
}

// Component props types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface ChartProps extends BaseComponentProps {
  data: GraphDataPoint[];
  height?: number;
  width?: number;
}

// Form types
export interface KeywordFormData {
  keyword: string;
}

// Error types
export interface AppError {
  type: string;
  message: string;
  originalError?: Error;
  context?: string;
  timestamp: string;
  userMessage: string;
}

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Event types
export interface ProcessingEvent {
  type: 'start' | 'progress' | 'complete' | 'error';
  data?: ProcessingProgress | AppError;
  timestamp: string;
}

// Configuration types
export interface AppConfig {
  api: {
    timeout: number;
    maxRetries: number;
    retryDelay: number;
    batchSize: number;
    concurrency: number;
  };
  sentiment: {
    levels: Record<SentimentType, number>;
    confidenceThreshold: number;
    neutralToPositiveThreshold: number;
  };
  database: {
    defaultLimit: number;
    maxLimit: number;
    pollingInterval: number;
    pollingTimeout: number;
  };
  ui: {
    animationDuration: number;
    toastDuration: number;
    debounceDelay: number;
    graphHeight: number;
    maxContentLength: number;
  };
}

// Hook return types
export interface UseProcessingReturn {
  isProcessing: boolean;
  progress: ProcessingProgress | null;
  error: AppError | null;
  startProcessing: () => Promise<void>;
  stopProcessing: () => void;
  clearError: () => void;
}

export interface UseStatsReturn {
  stats: ProcessingStats | null;
  loading: boolean;
  error: AppError | null;
  refresh: () => Promise<void>;
}

export interface UseKeywordsReturn {
  keywords: Keyword[];
  loading: boolean;
  error: AppError | null;
  addKeyword: (keyword: string) => Promise<void>;
  deleteKeyword: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
}
