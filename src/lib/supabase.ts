import { createClient } from '@supabase/supabase-js'

// Environment variables with fallbacks
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.warn('Missing Supabase environment variables. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Database table names
export const TABLES = {
  RAW_TWEETS: 'Extracted Uncleaned',
  PROCESSED_TWEETS: 'processed_tweets',
  KEYWORDS: 'keywords'
} as const

// Sentiment analysis types - 5-level scale
export type SentimentType = 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive'

// Raw tweet data from your existing table
export interface RawTweet {
  tweet_id: number
  created_at?: string
  URL?: string
  Content?: string
  Likes?: string
  Retweets?: string
  Replies?: string
  Quotes?: string
  Views?: string
  Date?: string
}

// Processed tweet with sentiment analysis
export interface ProcessedTweet {
  id?: number
  original_tweet_id: number
  content: string
  processed_content?: string
  sentiment: SentimentType
  confidence: number
  likes_count?: number
  retweets_count?: number
  replies_count?: number
  views_count?: number
  tweet_date: string | Date
  processed_at?: string
}

// Sentiment analysis result from HuggingFace or Claude
export interface SentimentAnalysisResult {
  sentiment: SentimentType
  confidence: number
  sentimentValue: number
  label: string
  score: number
}

// Keyword for tweet search
export interface Keyword {
  id?: number
  keyword: string
  created_at?: string
}

// API response types
export interface ProcessingStats {
  totalTweets: number
  processedTweets: number
  remainingTweets: number
  lastProcessedDate?: string
}

export interface ProcessingProgress {
  stage: 'idle' | 'fetching' | 'filtering' | 'analyzing' | 'storing' | 'completed' | 'error'
  progress: number
  message: string
  error?: string
}
