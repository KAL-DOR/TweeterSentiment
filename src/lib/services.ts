import { supabase, TABLES, RawTweet, ProcessedTweet, SentimentAnalysisResult, ProcessingStats, ProcessingProgress, Keyword } from './supabase';
import { logger, logDatabaseOperation, logProcessingStep } from './logger';
import { errorHandler, handleDatabaseError, handleProcessingError } from './error-handler';
import { API_CONFIG, DATABASE_CONFIG, ERROR_MESSAGES, SUCCESS_MESSAGES, API_ENDPOINTS } from './constants';
import { parseTweetDate, cleanTweetContent, calculateEngagement, getSentimentValue, retry, sleep } from './utils';

// Re-export types for external use
export type { ProcessingStats, ProcessingProgress };

// Environment variables
const HUGGINGFACE_API_KEY = import.meta.env.VITE_HUGGINGFACE_API_KEY || '';
const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || '';
const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || '';

// HuggingFace API configuration for Spanish sentiment analysis
const HUGGINGFACE_MODEL = 'cardiffnlp/twitter-xlm-roberta-base-sentiment';
const HUGGINGFACE_FALLBACK_MODEL = 'cardiffnlp/twitter-roberta-base-sentiment-latest';

// Multiple API endpoints to try (some may have CORS issues)
const API_ENDPOINTS_LIST = [
  // Try direct API first (may fail with CORS)
  `https://api-inference.huggingface.co/models/${HUGGINGFACE_MODEL}`,
  // Try alternative CORS proxies that work better
  `https://corsproxy.io/?${encodeURIComponent(`https://api-inference.huggingface.co/models/${HUGGINGFACE_MODEL}`)}`,
  `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(`https://api-inference.huggingface.co/models/${HUGGINGFACE_MODEL}`)}`,
  // Try with different proxy
  `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(`https://api-inference.huggingface.co/models/${HUGGINGFACE_MODEL}`)}`,
];

const FALLBACK_ENDPOINTS = [
  `https://api-inference.huggingface.co/models/${HUGGINGFACE_FALLBACK_MODEL}`,
  `https://corsproxy.io/?${encodeURIComponent(`https://api-inference.huggingface.co/models/${HUGGINGFACE_FALLBACK_MODEL}`)}`,
  `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(`https://api-inference.huggingface.co/models/${HUGGINGFACE_FALLBACK_MODEL}`)}`,
  `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(`https://api-inference.huggingface.co/models/${HUGGINGFACE_FALLBACK_MODEL}`)}`,
];

// Primary URLs (will be set dynamically)
let HUGGINGFACE_API_URL = API_ENDPOINTS_LIST[0];
let HUGGINGFACE_FALLBACK_URL = FALLBACK_ENDPOINTS[0];

/**
 * Service for handling raw tweet data operations
 */
export class TweetService {
  /**
   * Fetch raw tweets from the database with pagination
   */
  static async getRawTweets(limit: number = DATABASE_CONFIG.DEFAULT_LIMIT, offset: number = 0): Promise<RawTweet[]> {
    logDatabaseOperation('SELECT', TABLES.RAW_TWEETS, { limit, offset });
    
    try {
      // Strategy 1: Try basic query first
      const { data: basicData, error: basicError } = await supabase
        .from(TABLES.RAW_TWEETS)
        .select('tweet_id, URL, Content, Likes, Retweets, Replies, Quotes, Views, Date')
        .limit(limit);

      if (!basicError && basicData && basicData.length > 0) {
        logger.info(`Fetched ${basicData.length} tweets`, 'TweetService');
        return basicData;
      }

      // Strategy 2: Try with minimal columns
      const { data: minimalData, error: minimalError } = await supabase
        .from(TABLES.RAW_TWEETS)
        .select('tweet_id, Content, Date')
        .limit(limit);

      if (!minimalError && minimalData && minimalData.length > 0) {
        logger.info(`Fetched ${minimalData.length} tweets (minimal)`, 'TweetService');
        return minimalData;
      }

      // Strategy 3: Try with just tweet_id
      const { data: idData, error: idError } = await supabase
        .from(TABLES.RAW_TWEETS)
        .select('tweet_id')
        .limit(limit);

      if (!idError && idData && idData.length > 0) {
        const ids = idData.map(t => t.tweet_id);
        const { data: fullData, error: fullError } = await supabase
          .from(TABLES.RAW_TWEETS)
          .select('*')
          .in('tweet_id', ids);

        if (!fullError && fullData) {
          logger.info(`Fetched ${fullData.length} tweets (by ID)`, 'TweetService');
          return fullData;
        }
      }

      // Strategy 4: Try without any filters or limits
      const { data: noFilterData, error: noFilterError } = await supabase
        .from(TABLES.RAW_TWEETS)
        .select('*');

      if (noFilterError) {
        throw handleDatabaseError(noFilterError, 'getRawTweets');
      }

      if (noFilterData && noFilterData.length > 0) {
        logger.info(`Fetched ${noFilterData.length} tweets (no filter)`, 'TweetService');
        return noFilterData;
      }

      logger.warn('No tweets found in database', 'TweetService');
      return [];
    } catch (error) {
      const appError = handleDatabaseError(error as Error, 'getRawTweets');
      logger.error('Failed to fetch raw tweets', 'TweetService', appError);
      throw appError;
    }
  }

  /**
   * Get processing statistics
   */
  static async getProcessingStats(): Promise<ProcessingStats> {
    logDatabaseOperation('COUNT', TABLES.RAW_TWEETS);
    
    try {
      // Get total raw tweets count
      const { count: totalTweets, error: totalError } = await supabase
        .from(TABLES.RAW_TWEETS)
        .select('*', { count: 'exact', head: true });

      if (totalError) {
        throw handleDatabaseError(totalError, 'getProcessingStats');
      }

      // Get processed tweets count
      const { count: processedTweets, error: processedError } = await supabase
        .from(TABLES.PROCESSED_TWEETS)
        .select('*', { count: 'exact', head: true });

      if (processedError) {
        throw handleDatabaseError(processedError, 'getProcessingStats');
      }

      const stats = {
        totalTweets: totalTweets || 0,
        processedTweets: processedTweets || 0,
        remainingTweets: (totalTweets || 0) - (processedTweets || 0),
      };

      logger.info('Processing stats retrieved', 'TweetService', stats);
      return stats;
    } catch (error) {
      const appError = handleDatabaseError(error as Error, 'getProcessingStats');
      logger.error('Failed to get processing stats', 'TweetService', appError);
      throw appError;
    }
  }

  /**
   * Get the latest processed tweet date
   */
  static async getLastProcessedDate(): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from(TABLES.PROCESSED_TWEETS)
        .select('processed_at')
        .order('processed_at', { ascending: false })
        .limit(1);

      if (error) {
        logger.warn('Error getting last processed date', 'TweetService', error);
        return null;
      }

      return data?.[0]?.processed_at || null;
    } catch (error) {
      logger.warn('Failed to get last processed date', 'TweetService', error);
      return null;
    }
  }
}

/**
 * Service for sentiment analysis operations
 */
export class SentimentAnalysisService {
  /**
   * Test multiple API endpoints to find one that works
   */
  static async findWorkingEndpoint(endpoints: string[]): Promise<string | null> {
    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Testing endpoint: ${endpoint}`)
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            inputs: 'test',
            options: { wait_for_model: false }
          }),
          signal: AbortSignal.timeout(10000) // 10 second timeout for testing
        })
        
        if (response.ok) {
          console.log(`✅ Working endpoint found: ${endpoint}`)
          return endpoint
        }
      } catch (error) {
        console.log(`❌ Endpoint failed: ${endpoint} - ${error}`)
        continue
      }
    }
    return null
  }

  /**
   * Warm up the HuggingFace model to avoid cold start delays
   */
  static async warmUpModel(): Promise<void> {
    try {
      console.log('🔥 Warming up HuggingFace model...')
      console.log('🔑 API Key configured:', HUGGINGFACE_API_KEY ? 'Yes' : 'No')
      
      // Find a working endpoint first
      const workingEndpoint = await this.findWorkingEndpoint(API_ENDPOINTS_LIST)
      if (!workingEndpoint) {
        console.warn('⚠️ No working endpoints found, skipping warm-up')
        return
      }
      
      console.log('🌐 Using endpoint:', workingEndpoint)
      
      const response = await fetch(workingEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: 'test', // Simple test input
          options: {
            wait_for_model: true,
            use_cache: false // Don't cache the warm-up request
          }
        }),
        signal: AbortSignal.timeout(60000) // 1 minute timeout for warm-up
      })
      
      console.log('📡 Warm-up response status:', response.status, response.statusText)
      
      if (response.ok) {
        const result = await response.json()
        console.log('✅ Model warmed up successfully:', result)
        // Update the global URL to use the working endpoint
        HUGGINGFACE_API_URL = workingEndpoint
      } else {
        const errorText = await response.text()
        console.warn('⚠️ Model warm-up failed:', response.status, response.statusText, errorText)
      }
    } catch (error) {
      console.warn('⚠️ Model warm-up failed:', error)
      // Don't throw - warm-up failure shouldn't stop processing
    }
  }

  /**
   * Analyze sentiment of a single text using HuggingFace API
   */
  static async analyzeSentiment(text: string, retryCount: number = 0): Promise<SentimentAnalysisResult> {
    if (!HUGGINGFACE_API_KEY) {
      throw new Error('HuggingFace API key not configured')
    }

    const maxRetries = 2; // Reduced retries for speed
    const retryDelay = Math.pow(2, retryCount) * 500; // Faster exponential backoff: 0.5s, 1s

    try {
      console.log(`🔄 Attempting sentiment analysis (attempt ${retryCount + 1}/${maxRetries + 1}) for: "${text.substring(0, 50)}..."`);
      
      // Try the current working endpoint first, then fallback to testing all endpoints
      let response: Response
      let usedEndpoint = HUGGINGFACE_API_URL
      
      try {
        response = await fetch(HUGGINGFACE_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            inputs: text,
            options: {
              wait_for_model: true,
              use_cache: true
            }
          }),
          // Add timeout to prevent hanging requests
          signal: AbortSignal.timeout(30000) // 30 second timeout for faster processing
        })
      } catch (error) {
        // If the current endpoint fails, just throw the error - don't test all endpoints again
        console.log('🔄 Current endpoint failed, will retry with same endpoint...')
        throw error
      }

      if (!response.ok) {
        throw new Error(`HuggingFace API error: ${response.status} ${response.statusText}`)
      }

      const results = await response.json()

      // Handle different response formats
      let sentimentData
      if (Array.isArray(results) && results.length > 0) {
        sentimentData = results[0]
      } else if (results && typeof results === 'object') {
        sentimentData = results
      } else {
        throw new Error('Unexpected response format from HuggingFace API')
      }

      // Extract sentiment and confidence
      const topResult = Array.isArray(sentimentData)
        ? sentimentData.sort((a: any, b: any) => b.score - a.score)[0]
        : sentimentData

      const label = topResult.label || topResult.intent || ''
      const score = topResult.score || topResult.confidence || 0

      // Map labels to our 5-level sentiment types
      // Cardiff model returns: LABEL_0 (negative), LABEL_1 (neutral), LABEL_2 (positive)
      let sentiment: 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive' = 'neutral'
      let sentimentValue = 0
      const labelLower = label.toLowerCase()
      
      if (labelLower === 'label_2' || labelLower.includes('pos') || labelLower.includes('positive')) {
        // Positive sentiment - use confidence to determine intensity
        if (score >= 0.8) {
          sentiment = 'very_positive'
          sentimentValue = 2
        } else {
          sentiment = 'positive'
          sentimentValue = 1
        }
      } else if (labelLower === 'label_0' || labelLower.includes('neg') || labelLower.includes('negative')) {
        // Negative sentiment - use confidence to determine intensity
        if (score >= 0.8) {
          sentiment = 'very_negative'
          sentimentValue = -2
        } else {
          sentiment = 'negative'
          sentimentValue = -1
        }
      } else if (labelLower === 'label_1' || labelLower.includes('neu') || labelLower.includes('neutral')) {
        // If neutral with high confidence (>0.72), treat as positive
        if (score > 0.72) {
          sentiment = 'positive'
          sentimentValue = 1
        } else {
          sentiment = 'neutral'
          sentimentValue = 0
        }
      }

      return {
        sentiment,
        confidence: Math.round(score * 100) / 100,
        sentimentValue,
        label,
        score
      }

    } catch (error) {
      console.error(`❌ Sentiment analysis error (attempt ${retryCount + 1}):`, error)
      
      // Check if this is a network error or timeout that we should retry
      const isNetworkError = error instanceof TypeError && 
        (error.message.includes('Failed to fetch') || 
         error.message.includes('ERR_NETWORK_CHANGED') ||
         error.message.includes('NetworkError'))
      
      const isTimeoutError = error instanceof Error && 
        (error.name === 'TimeoutError' || 
         error.message.includes('signal timed out') ||
         error.message.includes('timeout'))
      
      if ((isNetworkError || isTimeoutError) && retryCount < maxRetries) {
        const errorType = isTimeoutError ? 'timeout' : 'network'
        console.log(`🔄 Retrying after ${errorType} error in ${retryDelay}ms... (attempt ${retryCount + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.analyzeSentiment(text, retryCount + 1)
      }
      
      // If it's a 404 or model error, try fallback model
      if (error instanceof Error && 
          (error.message.includes('404') || error.message.includes('model'))) {
        console.log(`🔄 Trying fallback model: ${HUGGINGFACE_FALLBACK_MODEL}`)
        return this.analyzeSentimentWithFallback(text)
      }
      
      // If we've exhausted retries or it's not a network error, return neutral sentiment
      console.warn(`⚠️ Returning neutral sentiment after ${retryCount + 1} failed attempts`)
      return {
        sentiment: 'neutral',
        confidence: 0.5,
        sentimentValue: 0,
        label: 'NEU_FALLBACK',
        score: 0.5
      }
    }
  }

  /**
   * Analyze sentiment using fallback model
   */
  static async analyzeSentimentWithFallback(text: string): Promise<SentimentAnalysisResult> {
    try {
      console.log(`🔄 Using fallback model for: "${text.substring(0, 50)}..."`)
      
      // Try fallback endpoints with CORS handling
      let response: Response
      let usedEndpoint = HUGGINGFACE_FALLBACK_URL
      
      try {
        response = await fetch(HUGGINGFACE_FALLBACK_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            inputs: text,
            options: {
              wait_for_model: true,
              use_cache: true
            }
          }),
          signal: AbortSignal.timeout(30000)
        })
      } catch (error) {
        // If fallback endpoint fails, just throw the error - don't test all endpoints again
        console.log('🔄 Fallback endpoint failed, will use neutral sentiment...')
        throw error
      }

      if (!response.ok) {
        throw new Error(`Fallback model error: ${response.status} ${response.statusText}`)
      }

      const results = await response.json()
      let sentimentData
      if (Array.isArray(results) && results.length > 0) {
        sentimentData = results[0]
      } else if (results && typeof results === 'object') {
        sentimentData = results
      } else {
        throw new Error('Unexpected response format from fallback model')
      }

      const topResult = Array.isArray(sentimentData)
        ? sentimentData.sort((a: any, b: any) => b.score - a.score)[0]
        : sentimentData

      const label = topResult.label || topResult.intent || ''
      const score = topResult.score || topResult.confidence || 0

      // Map fallback model labels to our 5-level sentiment types
      let sentiment: 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive' = 'neutral'
      let sentimentValue = 0
      const labelLower = label.toLowerCase()
      
      if (labelLower.includes('pos') || labelLower.includes('positive')) {
        sentiment = score >= 0.8 ? 'very_positive' : 'positive'
        sentimentValue = score >= 0.8 ? 2 : 1
      } else if (labelLower.includes('neg') || labelLower.includes('negative')) {
        sentiment = score >= 0.8 ? 'very_negative' : 'negative'
        sentimentValue = score >= 0.8 ? -2 : -1
      } else if (labelLower.includes('neu') || labelLower.includes('neutral')) {
        // If neutral with high confidence (>0.72), treat as positive
        if (score > 0.72) {
          sentiment = 'positive'
          sentimentValue = 1
        } else {
          sentiment = 'neutral'
          sentimentValue = 0
        }
      }

      return {
        sentiment,
        confidence: Math.round(score * 100) / 100,
        sentimentValue,
        label,
        score
      }

    } catch (error) {
      console.error('Fallback model error:', error)
      // Return neutral sentiment as final fallback
      return {
        sentiment: 'neutral',
        confidence: 0.5,
        sentimentValue: 0,
        label: 'NEU_FALLBACK',
        score: 0.5
      }
    }
  }

  /**
   * Analyze sentiment for multiple texts (batch processing)
   */
  static async analyzeSentimentsBatch(texts: string[]): Promise<SentimentAnalysisResult[]> {
    const results: SentimentAnalysisResult[] = []

    // Warm up the model first to find a working endpoint
    await this.warmUpModel()

    // Process in larger batches with parallel processing for speed
    const batchSize = 10 // Increased batch size for better throughput
    const concurrency = 3 // Process 3 tweets in parallel per batch
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)} (${batch.length} tweets)`)
      
      // Process tweets in parallel chunks for speed
      const batchResults: SentimentAnalysisResult[] = []
      
      for (let j = 0; j < batch.length; j += concurrency) {
        const chunk = batch.slice(j, j + concurrency)
        console.log(`🚀 Processing chunk ${Math.floor(j / concurrency) + 1}/${Math.ceil(batch.length / concurrency)} (${chunk.length} tweets in parallel)`)
        
        // Process chunk in parallel
        const chunkPromises = chunk.map(async (text, chunkIndex) => {
          const tweetIndex = i + j + chunkIndex + 1
          const totalTweets = texts.length
          
          console.log(`📝 Processing tweet ${tweetIndex}/${totalTweets}: "${text.substring(0, 50)}..."`)
          
          try {
            const result = await this.analyzeSentiment(text)
            console.log(`✅ Tweet ${tweetIndex} analyzed: ${result.sentiment} (${result.sentimentValue})`)
            return result
          } catch (error) {
            console.error(`❌ Failed to analyze tweet ${tweetIndex}: "${text.substring(0, 50)}..."`, error)
            // Add neutral sentiment as fallback
            return {
              sentiment: 'neutral' as const,
              confidence: 0.5,
              sentimentValue: 0,
              label: 'NEU_FALLBACK',
              score: 0.5
            }
          }
        })
        
        // Wait for all tweets in this chunk to complete
        const chunkResults = await Promise.all(chunkPromises)
        batchResults.push(...chunkResults)
        
        // Short delay between chunks to avoid overwhelming the API
        if (j + concurrency < batch.length) {
          await new Promise(resolve => setTimeout(resolve, 500)) // Reduced from 1000ms to 500ms
        }
      }
      
      results.push(...batchResults)

      // Reduced delay between batches
      if (i + batchSize < texts.length) {
        console.log(`⏳ Waiting 1 second before next batch...`)
        await new Promise(resolve => setTimeout(resolve, 1000)) // Reduced from 5000ms to 1000ms
      }
    }

    return results
  }
}

/**
 * Service for Claude Sonnet 4 sentiment analysis operations
 */
export class ClaudeSentimentAnalysisService {
  private static readonly MODEL = 'claude-sonnet-4-20250514'
  private static readonly BACKEND_URL = process.env.NODE_ENV === 'production' 
    ? '/api/claude'  // Use relative URL for production (Vercel)
    : 'http://localhost:3001/api/claude'  // Use localhost for development
  private static readonly CONCURRENCY = 3
  private static readonly MAX_RETRIES = 2

  /**
   * Analyze sentiment of a single text using Claude Sonnet 4
   */
  static async analyzeSentiment(text: string, retryCount: number = 0): Promise<SentimentAnalysisResult> {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not configured')
    }

    const maxRetries = this.MAX_RETRIES
    const retryDelay = Math.pow(2, retryCount) * 1000 // 1s, 2s

    try {
      console.log(`🤖 Claude analyzing sentiment (attempt ${retryCount + 1}/${maxRetries + 1}) for: "${text.substring(0, 50)}..."`)
      
      // Try direct API call first, if CORS fails, we'll handle it in the catch block
      const response = await fetch(API_ENDPOINTS.CLAUDE.PRODUCTION, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.MODEL,
          max_tokens: 1000,
          messages: [
            {
              role: 'user',
              content: `Analyze the sentiment of this text and respond with ONLY a JSON object containing "sentiment" and "confidence" fields. The sentiment should be one of: "very_negative", "negative", "neutral", "positive", "very_positive". The confidence should be a number between 0 and 1.

Text: "${text}"

Respond with only the JSON object, no other text.`
            }
          ]
        }),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Claude API error: ${response.status} ${response.statusText}`, errorText)
        throw new Error(`Claude API error: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      const content = result.content?.[0]?.text

      if (!content) {
        throw new Error('No content in Claude response')
      }

      // Parse the JSON response
      let sentimentData
      try {
        // Clean the response to extract JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          sentimentData = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('No JSON found in response')
        }
      } catch (parseError) {
        console.warn('Failed to parse Claude JSON response:', content)
        throw new Error('Invalid JSON response from Claude')
      }

      const sentiment = sentimentData.sentiment
      const confidence = sentimentData.confidence || 0.5

      // Validate sentiment value
      const validSentiments = ['very_negative', 'negative', 'neutral', 'positive', 'very_positive']
      if (!validSentiments.includes(sentiment)) {
        console.warn(`Invalid sentiment from Claude: ${sentiment}, defaulting to neutral`)
        sentimentData.sentiment = 'neutral'
      }

      // Map sentiment to numeric value
      let sentimentValue = 0
      switch (sentiment) {
        case 'very_negative':
          sentimentValue = -2
          break
        case 'negative':
          sentimentValue = -1
          break
        case 'neutral':
          sentimentValue = 0
          break
        case 'positive':
          sentimentValue = 1
          break
        case 'very_positive':
          sentimentValue = 2
          break
        default:
          sentimentValue = 0
      }

      console.log(`✅ Claude analysis: ${sentiment} (${sentimentValue}) confidence: ${confidence}`)

      return {
        sentiment: sentiment as 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive',
        confidence: Math.round(confidence * 100) / 100,
        sentimentValue,
        label: `CLAUDE_${sentiment.toUpperCase()}`,
        score: confidence
      }

    } catch (error) {
      console.error(`❌ Claude sentiment analysis error (attempt ${retryCount + 1}):`, error)
      
      // Check if this is a CORS error
      const isCorsError = error instanceof TypeError && 
        (error.message.includes('Failed to fetch') || 
         error.message.includes('CORS') ||
         error.message.includes('Access-Control-Allow-Origin'))
      
      // Check if this is a network error or timeout that we should retry
      const isNetworkError = error instanceof TypeError && 
        (error.message.includes('Failed to fetch') || 
         error.message.includes('ERR_NETWORK_CHANGED') ||
         error.message.includes('NetworkError'))
      
      const isTimeoutError = error instanceof Error && 
        (error.name === 'TimeoutError' || 
         error.message.includes('signal timed out') ||
         error.message.includes('timeout'))
      
      // If it's a CORS error, try using a CORS proxy
      if (isCorsError && retryCount === 0) {
        console.log('🔄 CORS error detected, trying with CORS proxy...')
        return this.analyzeSentimentWithProxy(text, 1)
      }
      
      if ((isNetworkError || isTimeoutError) && retryCount < maxRetries) {
        const errorType = isTimeoutError ? 'timeout' : 'network'
        console.log(`🔄 Retrying Claude after ${errorType} error in ${retryDelay}ms... (attempt ${retryCount + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.analyzeSentiment(text, retryCount + 1)
      }
      
      // If we've exhausted retries or it's not a network error, return neutral sentiment
      console.warn(`⚠️ Returning neutral sentiment after ${retryCount + 1} failed attempts`)
      return {
        sentiment: 'neutral',
        confidence: 0.5,
        sentimentValue: 0,
        label: 'CLAUDE_NEU_FALLBACK',
        score: 0.5
      }
    }
  }

  /**
   * Analyze sentiment using CORS proxy
   */
  static async analyzeSentimentWithProxy(text: string, retryCount: number = 0): Promise<SentimentAnalysisResult> {
    try {
      console.log(`🤖 Claude analyzing sentiment with proxy (attempt ${retryCount + 1}) for: "${text.substring(0, 50)}..."`)
      
      // Use a CORS proxy that can handle API keys
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(API_ENDPOINTS.CLAUDE.PRODUCTION)}`
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.MODEL,
          max_tokens: 1000,
          messages: [
            {
              role: 'user',
              content: `Analyze the sentiment of this text and respond with ONLY a JSON object containing "sentiment" and "confidence" fields. The sentiment should be one of: "very_negative", "negative", "neutral", "positive", "very_positive". The confidence should be a number between 0 and 1.

Text: "${text}"

Respond with only the JSON object, no other text.`
            }
          ]
        }),
        signal: AbortSignal.timeout(30000)
      })

      if (!response.ok) {
        throw new Error(`Proxy API error: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      const content = result.content?.[0]?.text

      if (!content) {
        throw new Error('No content in Claude response')
      }

      // Parse the JSON response
      let sentimentData
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          sentimentData = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('No JSON found in response')
        }
      } catch (parseError) {
        console.warn('Failed to parse Claude JSON response:', content)
        throw new Error('Invalid JSON response from Claude')
      }

      const sentiment = sentimentData.sentiment
      const confidence = sentimentData.confidence || 0.5

      // Validate sentiment value
      const validSentiments = ['very_negative', 'negative', 'neutral', 'positive', 'very_positive']
      if (!validSentiments.includes(sentiment)) {
        console.warn(`Invalid sentiment from Claude: ${sentiment}, defaulting to neutral`)
        sentimentData.sentiment = 'neutral'
      }

      // Map sentiment to numeric value
      let sentimentValue = 0
      switch (sentiment) {
        case 'very_negative':
          sentimentValue = -2
          break
        case 'negative':
          sentimentValue = -1
          break
        case 'neutral':
          sentimentValue = 0
          break
        case 'positive':
          sentimentValue = 1
          break
        case 'very_positive':
          sentimentValue = 2
          break
        default:
          sentimentValue = 0
      }

      console.log(`✅ Claude proxy analysis: ${sentiment} (${sentimentValue}) confidence: ${confidence}`)

      return {
        sentiment: sentiment as 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive',
        confidence: Math.round(confidence * 100) / 100,
        sentimentValue,
        label: `CLAUDE_PROXY_${sentiment.toUpperCase()}`,
        score: confidence
      }

    } catch (error) {
      console.error(`❌ Claude proxy analysis error:`, error)
      return {
        sentiment: 'neutral',
        confidence: 0.5,
        sentimentValue: 0,
        label: 'CLAUDE_PROXY_FALLBACK',
        score: 0.5
      }
    }
  }

  /**
   * Analyze sentiment for multiple texts (batch processing with concurrency 3)
   */
  static async analyzeSentimentsBatch(texts: string[]): Promise<SentimentAnalysisResult[]> {
    const results: SentimentAnalysisResult[] = []
    const concurrency = this.CONCURRENCY

    console.log(`🤖 Claude processing ${texts.length} texts with concurrency ${concurrency}`)

    for (let i = 0; i < texts.length; i += concurrency) {
      const chunk = texts.slice(i, i + concurrency)
      console.log(`🚀 Claude processing chunk ${Math.floor(i / concurrency) + 1}/${Math.ceil(texts.length / concurrency)} (${chunk.length} texts in parallel)`)
      
      // Process chunk in parallel
      const chunkPromises = chunk.map(async (text, chunkIndex) => {
        const textIndex = i + chunkIndex + 1
        const totalTexts = texts.length
        
        console.log(`📝 Claude processing text ${textIndex}/${totalTexts}: "${text.substring(0, 50)}..."`)
        
        try {
          const result = await this.analyzeSentiment(text)
          console.log(`✅ Text ${textIndex} analyzed: ${result.sentiment} (${result.sentimentValue}) confidence: ${result.confidence}`)
          return result
        } catch (error) {
          console.error(`❌ Failed to analyze text ${textIndex}: "${text.substring(0, 50)}..."`, error)
          // Add neutral sentiment as fallback
          return {
            sentiment: 'neutral' as const,
            confidence: 0.5,
            sentimentValue: 0,
            label: 'CLAUDE_NEU_FALLBACK',
            score: 0.5
          }
        }
      })
      
      // Wait for all texts in this chunk to complete
      const chunkResults = await Promise.all(chunkPromises)
      results.push(...chunkResults)
      
      // Short delay between chunks to avoid overwhelming the API
      if (i + concurrency < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second delay between chunks
      }
    }

    console.log(`✅ Claude batch processing complete: ${results.length} results`)
    return results
  }
}

// Helper function moved to utils.ts

/**
 * Service for data processing operations
 */
export class DataProcessingService {
  /**
   * Filter tweets from recent years (2024 and 2025)
   */
  static filterRecentTweets(tweets: RawTweet[]): RawTweet[] {
    logProcessingStep(`Filtering ${tweets.length} tweets for recent years`);
    
    const filteredTweets = tweets.filter(tweet => {
      if (!tweet.Date) {
        logger.debug(`Tweet ${tweet.tweet_id} has no date`, 'DataProcessingService');
        return false;
      }

      try {
        const parsedDate = parseTweetDate(tweet.Date);
        if (!parsedDate) {
          logger.debug(`Could not parse date for tweet ${tweet.tweet_id}: ${tweet.Date}`, 'DataProcessingService');
          return false;
        }

        const tweetDate = new Date(parsedDate);
        const tweetYear = tweetDate.getFullYear();
        
        // Accept tweets from recent years
        const isRecent = tweetYear >= 2024;
        
        if (isRecent) {
          logger.debug(`Tweet ${tweet.tweet_id} is from recent year ${tweetYear}`, 'DataProcessingService');
        } else {
          logger.debug(`Tweet ${tweet.tweet_id} year ${tweetYear} is too old`, 'DataProcessingService');
        }
        
        return isRecent;
      } catch (error) {
        logger.warn(`Error parsing date for tweet ${tweet.tweet_id}: ${tweet.Date}`, 'DataProcessingService', error);
        return false;
      }
    });

    logger.info(`Filtered ${filteredTweets.length} recent tweets from ${tweets.length} total`, 'DataProcessingService');
    return filteredTweets;
  }

  /**
   * Filter tweets from a specific year
   */
  static filterTweetsByYear(tweets: RawTweet[], year: number = 2025): RawTweet[] {
    logProcessingStep(`Filtering ${tweets.length} tweets for year ${year}`);
    
    const filteredTweets = tweets.filter(tweet => {
      if (!tweet.Date) {
        logger.debug(`Tweet ${tweet.tweet_id} has no date`, 'DataProcessingService');
        return false;
      }

      try {
        const parsedDate = parseTweetDate(tweet.Date);
        if (!parsedDate) {
          logger.debug(`Could not parse date for tweet ${tweet.tweet_id}: ${tweet.Date}`, 'DataProcessingService');
          return false;
        }

        const tweetDate = new Date(parsedDate);
        const tweetYear = tweetDate.getFullYear();
        
        const isMatch = tweetYear === year;
        
        if (isMatch) {
          logger.debug(`Tweet ${tweet.tweet_id} matches year ${year}`, 'DataProcessingService');
        } else {
          logger.debug(`Tweet ${tweet.tweet_id} year ${tweetYear} doesn't match ${year}`, 'DataProcessingService');
        }
        
        return isMatch;
      } catch (error) {
        logger.warn(`Error parsing date for tweet ${tweet.tweet_id}: ${tweet.Date}`, 'DataProcessingService', error);
        return false;
      }
    });

    logger.info(`Filtered ${filteredTweets.length} tweets from year ${year}`, 'DataProcessingService');
    return filteredTweets;
  }

  /**
   * Clean and prepare tweet content for analysis
   */
  static cleanTweetContent(content: string): string {
    if (!content) return '';
    return cleanTweetContent(content);
  }

  /**
   * Process raw tweets: filter, clean, analyze sentiment, and store results
   */
  static async processTweets(
    rawTweets: RawTweet[],
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<ProcessedTweet[]> {
    const processedTweets: ProcessedTweet[] = []

    // Stage 1: Filter tweets from 2025
    onProgress?.({
      stage: 'filtering',
      progress: 10,
      message: 'Filtering tweets from 2025...'
    })

    const filteredTweets = this.filterTweetsByYear(rawTweets)
    console.log(`Filtered ${filteredTweets.length} tweets from ${rawTweets.length} total`)

    if (filteredTweets.length === 0) {
      onProgress?.({
        stage: 'completed',
        progress: 100,
        message: 'No tweets from 2025 found to process'
      })
      return processedTweets
    }

    // Stage 2: Clean content
    onProgress?.({
      stage: 'filtering',
      progress: 20,
      message: 'Cleaning tweet content...'
    })

    const cleanedTweets = filteredTweets.map(tweet => ({
      ...tweet,
      cleanedContent: this.cleanTweetContent(tweet.Content || '')
    })).filter(tweet => tweet.cleanedContent.length > 0)

    // Stage 3: Analyze sentiment
    onProgress?.({
      stage: 'analyzing',
      progress: 30,
      message: 'Analyzing sentiment with Claude Sonnet 4...'
    })

    const texts = cleanedTweets.map(tweet => tweet.cleanedContent)
    const { ClaudeSentimentAnalysisService } = await import('./claude-service')
    const sentimentResults = await ClaudeSentimentAnalysisService.analyzeSentimentsBatch(texts)

    // Stage 4: Prepare processed data
    onProgress?.({
      stage: 'analyzing',
      progress: 70,
      message: 'Preparing processed data...'
    })

    for (let i = 0; i < cleanedTweets.length; i++) {
      const rawTweet = cleanedTweets[i]
      const sentimentResult = sentimentResults[i]

      const processedTweet: ProcessedTweet = {
        original_tweet_id: rawTweet.tweet_id,
        content: rawTweet.Content || '',
        processed_content: rawTweet.cleanedContent,
        sentiment: sentimentResult.sentiment,
        confidence: sentimentResult.confidence,
        likes_count: rawTweet.Likes ? parseInt(rawTweet.Likes.replace(/[^\d]/g, '')) || 0 : 0,
        retweets_count: rawTweet.Retweets ? parseInt(rawTweet.Retweets.replace(/[^\d]/g, '')) || 0 : 0,
        replies_count: rawTweet.Replies ? parseInt(rawTweet.Replies.replace(/[^\d]/g, '')) || 0 : 0,
        views_count: rawTweet.Views ? parseInt(rawTweet.Views.replace(/[^\d]/g, '')) || 0 : 0,
        tweet_date: (() => {
          // Debug: Check what the raw tweet date looks like
          console.log(`🔍 Raw tweet date for ${rawTweet.tweet_id}: "${rawTweet.Date}"`)
          const parsedDate = this.parseTweetDate(rawTweet.Date)
          console.log(`🔍 Parsed date result: "${parsedDate}"`)
          return parsedDate || new Date().toISOString()
        })()
      }

      processedTweets.push(processedTweet)
    }

    // Stage 5: Store results
    onProgress?.({
      stage: 'storing',
      progress: 90,
      message: 'Storing processed data...'
    })

    const { error } = await supabase
      .from(TABLES.PROCESSED_TWEETS)
      .insert(processedTweets)

    if (error) {
      console.error('Error storing processed tweets:', error)
      onProgress?.({
        stage: 'error',
        progress: 0,
        message: 'Failed to store processed data',
        error: error.message
      })
      throw new Error(`Failed to store processed tweets: ${error.message}`)
    }

    onProgress?.({
      stage: 'completed',
      progress: 100,
      message: `Successfully processed ${processedTweets.length} tweets`
    })

    return processedTweets
  }

  /**
   * Clear all processed and raw tweets from the database (for end-to-end testing)
   */
  static async clearAllTweets(): Promise<{ success: boolean; message: string }> {
    console.log('🗑️ Clearing all tweets (processed and raw)...')
    
    try {
      // Clear processed tweets first
      console.log('🗑️ Clearing processed tweets...')
      const { error: processedError } = await supabase
        .from(TABLES.PROCESSED_TWEETS)
        .delete()
        .neq('id', 0) // Delete all rows (this condition is always true)

      if (processedError) {
        console.error('Error clearing processed tweets:', processedError)
        throw new Error(`Failed to clear processed tweets: ${processedError.message}`)
      }

      // Clear raw tweets
      console.log('🗑️ Clearing raw tweets...')
      const { error: rawError } = await supabase
        .from(TABLES.RAW_TWEETS)
        .delete()
        .neq('tweet_id', 0) // Delete all rows (this condition is always true)

      if (rawError) {
        console.error('Error clearing raw tweets:', rawError)
        throw new Error(`Failed to clear raw tweets: ${rawError.message}`)
      }

      console.log('✅ All tweets (processed and raw) cleared successfully')
      return {
        success: true,
        message: 'All tweets cleared successfully - ready for end-to-end test!'
      }

    } catch (error) {
      console.error('Error clearing tweets:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Trigger n8n workflow to fetch new tweets
   */
  static async triggerN8nWorkflow(): Promise<{ success: boolean; message: string }> {
    if (!N8N_WEBHOOK_URL) {
      throw new Error('n8n webhook URL not configured')
    }

    try {
      // Use GET request as configured in your webhook
      // Add timestamp as query parameter to make each request unique
      const url = new URL(N8N_WEBHOOK_URL)
      url.searchParams.set('trigger', 'frontend')
      url.searchParams.set('timestamp', new Date().toISOString())
      url.searchParams.set('action', 'fetch_new_tweets')

      const response = await fetch(url.toString(), {
        method: 'GET',
        mode: 'no-cors' // This bypasses CORS for simple GET requests
      })

      // With no-cors mode, we can't read the response, but the request was sent
      // The webhook will handle the flow and we just need to confirm it was triggered
      return {
        success: true,
        message: 'Tweet fetching workflow triggered successfully'
      }

    } catch (error) {
      console.error('Error triggering n8n workflow:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Parse tweet date from various formats to ISO string
   */
  static parseTweetDate(dateStr: string | undefined): string | null {
    if (!dateStr) return null;
    
    try {
      const trimmedDate = dateStr.trim();
      console.log(`🔧 parseTweetDate input: "${trimmedDate}"`)
      
      // Handle format: "October 29, 2015 at 05:59 AM"
      if (trimmedDate.includes('at') && (trimmedDate.includes('AM') || trimmedDate.includes('PM'))) {
        console.log(`🔧 Parsing original date format: "${trimmedDate}"`);
        
        // Use regex to extract components
        const match = trimmedDate.match(/(\w+)\s+(\d+),\s+(\d+)\s+at\s+(\d+):(\d+)\s+(AM|PM)/i);
        if (match) {
          const [, monthName, day, year, hour, minute, ampm] = match;
          const monthNum = this.getMonthNumber(monthName);
          if (monthNum) {
            // Convert to 24-hour format
            let hour24 = parseInt(hour);
            if (ampm.toUpperCase() === 'PM' && hour24 !== 12) {
              hour24 += 12;
            } else if (ampm.toUpperCase() === 'AM' && hour24 === 12) {
              hour24 = 0;
            }
            
            const isoString = `${year}-${monthNum}-${day.padStart(2, '0')}T${hour24.toString().padStart(2, '0')}:${minute.padStart(2, '0')}:00.000Z`;
            const parsedDate = new Date(isoString);
            
            if (!isNaN(parsedDate.getTime())) {
              console.log(`✅ Parsed original date: ${trimmedDate} -> ${parsedDate.toISOString()}`);
              return parsedDate.toISOString();
            }
          }
        }
      }
      
      // Try direct parsing for other formats
      console.log(`🔧 Trying direct parsing for: "${trimmedDate}"`)
      const parsedDate = new Date(trimmedDate);
      if (!isNaN(parsedDate.getTime())) {
        console.log(`✅ Direct parsed date: ${trimmedDate} -> ${parsedDate.toISOString()}`);
        return parsedDate.toISOString();
      }
      
      console.warn(`⚠️ Could not parse date: ${trimmedDate}`);
      return null;
    } catch (error) {
      console.warn(`⚠️ Error parsing date: ${dateStr}`, error);
      return null;
    }
  }

  /**
   * Get month number from month name
   */
  static getMonthNumber(monthName: string): string | null {
    const months: { [key: string]: string } = {
      'january': '01', 'february': '02', 'march': '03', 'april': '04',
      'may': '05', 'june': '06', 'july': '07', 'august': '08',
      'september': '09', 'october': '10', 'november': '11', 'december': '12'
    };
    return months[monthName.toLowerCase()] || null;
  }

  /**
   * Process tweets directly in the frontend (fetch, filter, analyze, store)
   */
  static async processTweetsDirectly(
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<ProcessedTweet[]> {
    console.log('🚀 Starting processTweetsDirectly...')

    // Stage 1: Fetch raw tweets
    console.log('📡 Stage 1: Fetching raw tweets...')
    onProgress?.({
      stage: 'fetching',
      progress: 10,
      message: 'Fetching raw tweets from database...'
    })

    const rawTweets = await TweetService.getRawTweets(1000, 0)
    console.log(`✅ Fetched ${rawTweets.length} raw tweets`)

    if (rawTweets.length === 0) {
      console.log('⚠️ No raw tweets found to process')
      onProgress?.({
        stage: 'completed',
        progress: 100,
        message: 'No raw tweets found to process'
      })
      return []
    }

    // Stage 2: Filter tweets from recent years (2024 and 2025)
    console.log('🔍 Stage 2: Filtering tweets from recent years...')
    onProgress?.({
      stage: 'filtering',
      progress: 20,
      message: 'Filtering tweets from recent years...'
    })

    const filteredTweets = this.filterRecentTweets(rawTweets)
    console.log(`✅ Filtered ${filteredTweets.length} tweets from ${rawTweets.length} total`)

    if (filteredTweets.length === 0) {
      console.log('⚠️ No recent tweets found to process')
      onProgress?.({
        stage: 'completed',
        progress: 100,
        message: 'No recent tweets found to process'
      })
      return []
    }

    // Stage 3: Clean content
    onProgress?.({
      stage: 'filtering',
      progress: 30,
      message: 'Cleaning tweet content...'
    })

    const cleanedTweets = filteredTweets.map(tweet => ({
      ...tweet,
      cleanedContent: this.cleanTweetContent(tweet.Content || '')
    })).filter(tweet => tweet.cleanedContent.length > 0)

    // Stage 4: Analyze sentiment
    onProgress?.({
      stage: 'analyzing',
      progress: 40,
      message: 'Analyzing sentiment using Claude Sonnet 4...'
    })

    const texts = cleanedTweets.map(tweet => tweet.cleanedContent)
    const { ClaudeSentimentAnalysisService } = await import('./claude-service')
    const sentimentResults = await ClaudeSentimentAnalysisService.analyzeSentimentsBatch(texts)

    // Stage 5: Prepare processed data
    onProgress?.({
      stage: 'analyzing',
      progress: 80,
      message: 'Preparing processed data...'
    })

    // Create processed tweets from cleaned tweets and sentiment results
    const processedTweets: ProcessedTweet[] = cleanedTweets.map((tweet, index) => {
      const sentimentResult = sentimentResults[index]
      return {
        original_tweet_id: tweet.tweet_id,
        content: tweet.Content || '',
        processed_content: tweet.cleanedContent,
        sentiment: sentimentResult.sentiment,
        confidence: sentimentResult.confidence,
        likes_count: tweet.Likes ? parseInt(tweet.Likes.replace(/[^\d]/g, '')) || 0 : 0,
        retweets_count: tweet.Retweets ? parseInt(tweet.Retweets.replace(/[^\d]/g, '')) || 0 : 0,
        replies_count: tweet.Replies ? parseInt(tweet.Replies.replace(/[^\d]/g, '')) || 0 : 0,
        views_count: tweet.Views ? parseInt(tweet.Views.replace(/[^\d]/g, '')) || 0 : 0,
        tweet_date: tweet.Date || new Date().toISOString(),
        processed_at: new Date().toISOString()
      }
    })

    console.log(`📊 Created ${processedTweets.length} processed tweets`)

    // Stage 6: Store results
    console.log('💾 Stage 6: Storing processed data...')
    console.log(`📊 About to store ${processedTweets.length} processed tweets`)
    onProgress?.({
      stage: 'storing',
      progress: 90,
      message: 'Storing processed data...'
    })

    const { data: insertData, error } = await supabase
      .from(TABLES.PROCESSED_TWEETS)
      .insert(processedTweets)
      .select()

    if (error) {
      console.error('❌ Error storing processed tweets:', error)
      console.error('❌ Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      onProgress?.({
        stage: 'error',
        progress: 0,
        message: 'Failed to store processed data',
        error: error.message
      })
      throw new Error(`Failed to store processed tweets: ${error.message}`)
    }

    console.log('✅ Successfully stored processed tweets:', insertData)
    onProgress?.({
      stage: 'completed',
      progress: 100,
      message: `Successfully processed ${processedTweets.length} tweets`
    })

    return processedTweets
  }

  /**
   * Get processed tweets for visualization
   */
  static async getProcessedTweets(limit: number = 1000): Promise<ProcessedTweet[]> {
    const { data, error } = await supabase
      .from(TABLES.PROCESSED_TWEETS)
      .select('*')
      .order('tweet_date', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching processed tweets:', error)
      throw new Error(`Failed to fetch processed tweets: ${error.message}`)
    }

    return data || []
  }

  /**
   * Transform processed tweets into 2D graph data
   * X-axis: Sentiment (-1 negative, 0 neutral, +1 positive)
   * Y-axis: Minutes of the day (0-1439, where 0 = midnight, 1439 = 11:59 PM)
   */
  static transformProcessedTweetsFor2DGraph(processedTweets: ProcessedTweet[]): { x: number; y: number; sentiment: string; confidence: number; tweetId: number }[] {
    console.log(`📊 Transforming ${processedTweets.length} processed tweets for 2D graph`)

    const transformedPoints = processedTweets.map((tweet, index) => {
      // Convert sentiment to numeric value
      let sentimentValue: number
      switch (tweet.sentiment) {
        case 'positive':
          sentimentValue = 1
          break
        case 'negative':
          sentimentValue = -1
          break
        case 'neutral':
          sentimentValue = 0
          break
        default:
          sentimentValue = 0
      }

      // Extract minutes from tweet_date
      let minutes = 0

      if (tweet.tweet_date) {
        try {
          let tweetDate: Date
          const dateStr = tweet.tweet_date.toString().trim()

          if (typeof tweet.tweet_date === 'string') {
            // Handle format: "April 12, 2019 at 12:38 AM"
            if (dateStr.includes('at') && dateStr.includes('AM') || dateStr.includes('PM')) {
              console.log(`🔧 Parsing date format: "${dateStr}"`)
              
              // Extract components using regex for "Month Day, Year at Hour:Minute AM/PM"
              const match = dateStr.match(/(\w+)\s+(\d+),\s+(\d+)\s+at\s+(\d+):(\d+)\s+(AM|PM)/i)
              if (match) {
                const [, month, day, year, hour, minute, ampm] = match
                console.log(`🔧 Extracted: month=${month}, day=${day}, year=${year}, hour=${hour}, minute=${minute}, ampm=${ampm}`)
                
                // Convert to 24-hour format
                let hour24 = parseInt(hour)
                if (ampm.toUpperCase() === 'PM' && hour24 !== 12) {
                  hour24 += 12
                } else if (ampm.toUpperCase() === 'AM' && hour24 === 12) {
                  hour24 = 0
                }
                
                // Create ISO date string
                const isoString = `${year}-${this.getMonthNumber(month)}-${day.padStart(2, '0')}T${hour24.toString().padStart(2, '0')}:${minute.padStart(2, '0')}:00.000Z`
                console.log(`🔧 Created ISO string: ${isoString}`)
                tweetDate = new Date(isoString)
              } else {
                console.warn(`⚠️ Could not parse date format: ${dateStr}`)
                tweetDate = new Date(dateStr)
              }
            } else {
              tweetDate = new Date(dateStr)
            }
          } else {
            tweetDate = tweet.tweet_date
          }

          if (!isNaN(tweetDate.getTime())) {
            const hours = tweetDate.getHours()
            const mins = tweetDate.getMinutes()
            minutes = hours * 60 + mins // Convert to minutes of day (0-1439)
            console.log(`✅ Parsed date: ${dateStr} -> Minutes: ${minutes} (${hours}:${mins.toString().padStart(2, '0')})`)
          } else {
            console.warn(`⚠️ Invalid date for tweet ${tweet.id}: ${tweet.tweet_date}`)
          }
        } catch (error) {
          console.warn(`⚠️ Could not parse date for tweet ${tweet.id}:`, error)
        }
      } else {
        console.warn(`⚠️ No tweet_date for tweet ${tweet.id}`)
      }

      const point = {
        x: sentimentValue,
        y: minutes,
        sentiment: tweet.sentiment,
        confidence: tweet.confidence,
        tweetId: tweet.id || tweet.original_tweet_id
      }

      // Log first few points for debugging
      if (index < 5) {
        console.log(`📊 Point ${index}:`, {
          originalTweet: { id: tweet.id, sentiment: tweet.sentiment, tweet_date: tweet.tweet_date },
          transformed: point
        })
      }

      return point
    })

    const validPoints = transformedPoints.filter(point => !isNaN(point.x) && !isNaN(point.y))
    
    console.log(`📊 Transformation complete: ${validPoints.length}/${processedTweets.length} valid points`)
    console.log(`📊 Sample valid points:`, validPoints.slice(0, 3))
    
    return validPoints
  }
}

/**
 * Service for keyword management operations
 */
export class KeywordService {
  /**
   * Get all keywords
   */
  static async getKeywords(): Promise<Keyword[]> {
    console.log('🔍 Fetching keywords...')
    
    const { data, error } = await supabase
      .from(TABLES.KEYWORDS)
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching keywords:', error)
      throw new Error(`Failed to fetch keywords: ${error.message}`)
    }

    console.log(`✅ Fetched ${data?.length || 0} keywords`)
    return data || []
  }

  /**
   * Add a new keyword
   */
  static async addKeyword(keyword: string): Promise<Keyword> {
    console.log(`➕ Adding keyword: "${keyword}"`)
    
    if (!keyword.trim()) {
      throw new Error('Keyword cannot be empty')
    }

    const { data, error } = await supabase
      .from(TABLES.KEYWORDS)
      .insert([{ keyword: keyword.trim() }])
      .select()
      .single()

    if (error) {
      console.error('❌ Error adding keyword:', error)
      throw new Error(`Failed to add keyword: ${error.message}`)
    }

    console.log(`✅ Successfully added keyword:`, data)
    return data
  }

  /**
   * Delete a keyword
   */
  static async deleteKeyword(id: number): Promise<void> {
    console.log(`🗑️ Deleting keyword with id: ${id}`)
    
    const { error } = await supabase
      .from(TABLES.KEYWORDS)
      .delete()
      .eq('id', id)

    if (error) {
      console.error('❌ Error deleting keyword:', error)
      throw new Error(`Failed to delete keyword: ${error.message}`)
    }

    console.log(`✅ Successfully deleted keyword with id: ${id}`)
  }
}
