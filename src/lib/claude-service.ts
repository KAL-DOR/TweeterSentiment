import { SentimentAnalysisResult } from './supabase'

/**
 * Service for Claude Sonnet 4 sentiment analysis operations via backend proxy
 */
export class ClaudeSentimentAnalysisService {
  private static readonly BACKEND_URL = process.env.NODE_ENV === 'production' 
    ? '/api/claude'  // Use relative URL for production (Vercel)
    : 'http://localhost:3001/api/claude'  // Use localhost for development
  private static readonly CONCURRENCY = 3
  private static readonly MAX_RETRIES = 2

  /**
   * Analyze sentiment of a single text using Claude Sonnet 4 via backend
   */
  static async analyzeSentiment(text: string, retryCount: number = 0): Promise<SentimentAnalysisResult> {
    const maxRetries = this.MAX_RETRIES
    const retryDelay = Math.pow(2, retryCount) * 1000 // 1s, 2s

    try {
      // Reduced logging - only log on first attempt
      if (retryCount === 0) {
        console.log(`🤖 Claude analyzing sentiment for: "${text.substring(0, 30)}..."`)
      }
      
      const response = await fetch(this.BACKEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error(`Backend API error: ${response.status} ${response.statusText}`, errorData)
        throw new Error(`Backend API error: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      
      // Reduced logging - only log successful results occasionally
      if (Math.random() < 0.1) { // Log only 10% of successful requests
        console.log(`✅ Claude analysis: ${result.sentiment} (${result.sentimentValue}) confidence: ${result.confidence}`)
      }

      return {
        sentiment: result.sentiment as 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive',
        confidence: result.confidence,
        sentimentValue: result.sentimentValue,
        label: result.label,
        score: result.score
      }

    } catch (error) {
      // Reduced logging - only log errors on first attempt
      if (retryCount === 0) {
        console.error(`❌ Claude sentiment analysis error:`, error.message)
      }
      
      // Check if it's a network error
      const isNetworkError = error instanceof TypeError && 
        (error.message.includes('Failed to fetch') || 
         error.message.includes('ERR_NETWORK_CHANGED') ||
         error.message.includes('NetworkError'))
      
      // Check if it's a timeout error
      const isTimeoutError = error instanceof Error && 
        (error.name === 'TimeoutError' || 
         error.message.includes('signal timed out') ||
         error.message.includes('timeout'))
      
      // If network/timeout error, retry
      if ((isNetworkError || isTimeoutError) && retryCount < maxRetries) {
        const errorType = isTimeoutError ? 'timeout' : 'network'
        // Reduced logging - only log retries occasionally
        if (retryCount === 0) {
          console.log(`🔄 Retrying Claude after ${errorType} error...`)
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.analyzeSentiment(text, retryCount + 1)
      }
      
      // If all retries failed, return neutral sentiment
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
   * Analyze sentiment of multiple texts in parallel with concurrency control
   */
  static async analyzeSentimentsBatch(texts: string[]): Promise<SentimentAnalysisResult[]> {
    console.log(`🚀 Claude batch processing ${texts.length} texts`)
    
    const results: SentimentAnalysisResult[] = []
    
    // Process texts in chunks to control concurrency
    for (let i = 0; i < texts.length; i += this.CONCURRENCY) {
      const chunk = texts.slice(i, i + this.CONCURRENCY)
      const chunkNumber = Math.floor(i / this.CONCURRENCY) + 1
      const totalChunks = Math.ceil(texts.length / this.CONCURRENCY)
      
      // Reduced logging - only log every 5th chunk
      if (chunkNumber % 5 === 1) {
        console.log(`🚀 Claude processing chunk ${chunkNumber}/${totalChunks}`)
      }
      
      // Process chunk in parallel
      const chunkPromises = chunk.map(async (text, index) => {
        const textIndex = i + index + 1
        // Reduced logging - only log every 10th text
        if (textIndex % 10 === 1) {
          console.log(`📝 Claude processing text ${textIndex}/${texts.length}`)
        }
        return this.analyzeSentiment(text)
      })
      
      const chunkResults = await Promise.all(chunkPromises)
      results.push(...chunkResults)
      
      // Add delay between chunks to avoid overwhelming the API
      if (i + this.CONCURRENCY < texts.length) {
        // Reduced logging - only log wait occasionally
      if (chunkNumber % 10 === 0) {
        console.log(`⏳ Processing... ${Math.round((chunkNumber / totalChunks) * 100)}% complete`)
      }
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    console.log(`✅ Claude batch processing complete: ${results.length} results`)
    return results
  }
}
