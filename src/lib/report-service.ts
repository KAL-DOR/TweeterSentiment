import { supabase, TABLES, RawTweet, ProcessedTweet, SentimentType } from './supabase'
import jsPDF from 'jspdf'

// Report data interfaces
export interface TopAccount {
  username: string
  totalEngagement: number
  tweetCount: number
  avgEngagement: number
}

export interface FirstTweetAccount {
  username: string
  tweetId: number
  content: string
  date: string
  engagement: number
}

export interface ExtremeTweet {
  tweetId: number
  content: string
  username: string
  sentiment: SentimentType
  confidence: number
  engagement: number
  date: string
}

export interface KeywordSentiment {
  keyword: string
  totalTweets: number
  sentimentBreakdown: {
    very_positive: number
    positive: number
    neutral: number
    negative: number
    very_negative: number
  }
  overallSentiment: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative'
  sentimentScore: number
}

export interface ReportData {
  generatedAt: string
  totalTweets: number
  processedTweets: number
  dateRange: {
    earliest: string
    latest: string
  }
  topAccounts: TopAccount[]
  firstTweetAccounts: FirstTweetAccount[]
  mostNegativeTweets: ExtremeTweet[]
  mostPositiveTweets: ExtremeTweet[]
  keywordSentiments: KeywordSentiment[]
}

/**
 * Service for generating comprehensive reports from tweet data
 */
export class ReportService {
  /**
   * Extract username from Twitter URL
   */
  private static extractUsernameFromUrl(url: string): string {
    if (!url) return 'Unknown'
    
    try {
      // Twitter URL format: https://twitter.com/username/status/1234567890 or https://x.com/username/status/1234567890
      // Extract username between .com/ and the next /
      const match = url.match(/(?:twitter\.com|x\.com)\/([^\/]+)/)
      const username = match ? match[1] : 'Unknown'
      console.log(`🔍 Extracting username from URL: "${url}" -> "${username}"`)
      return username
    } catch (error) {
      console.warn('Error extracting username from URL:', url, error)
      return 'Unknown'
    }
  }

  /**
   * Clean text for PDF by removing emojis and limiting to first 10 words
   */
  private static cleanTextForPDF(text: string): string {
    if (!text) return ''
    
    // Remove emojis and special characters that cause PDF issues
    const cleaned = text
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Regional indicator symbols
      .replace(/[\u{2600}-\u{26FF}]/gu, '') // Miscellaneous symbols
      .replace(/[\u{2700}-\u{27BF}]/gu, '') // Dingbats
      .replace(/[^\x00-\x7F]/g, '') // Remove any remaining non-ASCII characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
    
    // Get first 10 words
    const words = cleaned.split(' ').slice(0, 10)
    return words.join(' ')
  }

  /**
   * Calculate total engagement for a tweet
   */
  private static calculateEngagement(tweet: RawTweet): number {
    const likes = parseInt(tweet.Likes?.replace(/[^\d]/g, '') || '0')
    const retweets = parseInt(tweet.Retweets?.replace(/[^\d]/g, '') || '0')
    const replies = parseInt(tweet.Replies?.replace(/[^\d]/g, '') || '0')
    const views = parseInt(tweet.Views?.replace(/[^\d]/g, '') || '0')
    
    // Weighted engagement calculation
    return likes + (retweets * 2) + (replies * 3) + (views * 0.1)
  }

  /**
   * Parse tweet date to ISO string
   */
  private static parseTweetDate(dateStr: string): string {
    if (!dateStr) return new Date().toISOString()
    
    try {
      // Handle various date formats
      if (dateStr.includes('at') && (dateStr.includes('AM') || dateStr.includes('PM'))) {
        const match = dateStr.match(/(\w+)\s+(\d+),\s+(\d+)\s+at\s+(\d+):(\d+)\s+(AM|PM)/i)
        if (match) {
          const [, monthName, day, year, hour, minute, ampm] = match
          const monthNum = this.getMonthNumber(monthName)
          if (monthNum) {
            let hour24 = parseInt(hour)
            if (ampm.toUpperCase() === 'PM' && hour24 !== 12) {
              hour24 += 12
            } else if (ampm.toUpperCase() === 'AM' && hour24 === 12) {
              hour24 = 0
            }
            
            const isoString = `${year}-${monthNum}-${day.padStart(2, '0')}T${hour24.toString().padStart(2, '0')}:${minute.padStart(2, '0')}:00.000Z`
            return new Date(isoString).toISOString()
          }
        }
      }
      
      return new Date(dateStr).toISOString()
    } catch (error) {
      console.warn('Error parsing date:', dateStr, error)
      return new Date().toISOString()
    }
  }

  /**
   * Get month number from month name
   */
  private static getMonthNumber(monthName: string): string | null {
    const months: { [key: string]: string } = {
      'january': '01', 'february': '02', 'march': '03', 'april': '04',
      'may': '05', 'june': '06', 'july': '07', 'august': '08',
      'september': '09', 'october': '10', 'november': '11', 'december': '12'
    }
    return months[monthName.toLowerCase()] || null
  }

  /**
   * Get top 3 accounts that received the most attention per keyword
   */
  private static async getTopAccountsByEngagement(limit: number = 3): Promise<TopAccount[]> {
    console.log('📊 Getting top accounts by engagement...')
    
    const { data: rawTweets, error } = await supabase
      .from(TABLES.RAW_TWEETS)
      .select('tweet_id, URL, Content, Likes, Retweets, Replies, Views, Date')
      .not('URL', 'is', null)
      .not('Content', 'is', null)

    if (error) {
      console.error('Error fetching tweets for top accounts:', error)
      return []
    }

    if (!rawTweets || rawTweets.length === 0) {
      console.log('No tweets found for top accounts analysis')
      return []
    }

    // Group tweets by username and calculate engagement
    const accountStats = new Map<string, { totalEngagement: number, tweetCount: number }>()

    rawTweets.forEach(tweet => {
      const username = this.extractUsernameFromUrl(tweet.URL || '')
      const engagement = this.calculateEngagement(tweet)
      
      if (username !== 'Unknown') {
        const existing = accountStats.get(username) || { totalEngagement: 0, tweetCount: 0 }
        accountStats.set(username, {
          totalEngagement: existing.totalEngagement + engagement,
          tweetCount: existing.tweetCount + 1
        })
      }
    })

    // Convert to array and sort by total engagement
    const topAccounts: TopAccount[] = Array.from(accountStats.entries())
      .map(([username, stats]) => ({
        username,
        totalEngagement: stats.totalEngagement,
        tweetCount: stats.tweetCount,
        avgEngagement: stats.totalEngagement / stats.tweetCount
      }))
      .sort((a, b) => b.totalEngagement - a.totalEngagement)
      .slice(0, limit)

    console.log(`✅ Found ${topAccounts.length} top accounts`)
    return topAccounts
  }

  /**
   * Get 3 accounts that posted the first tweets
   */
  private static async getFirstTweetAccounts(limit: number = 3): Promise<FirstTweetAccount[]> {
    console.log('📊 Getting first tweet accounts...')
    
    const { data: rawTweets, error } = await supabase
      .from(TABLES.RAW_TWEETS)
      .select('tweet_id, URL, Content, Likes, Retweets, Replies, Views, Date')
      .not('URL', 'is', null)
      .not('Content', 'is', null)
      .not('Date', 'is', null)
      .order('Date', { ascending: true })
      .limit(100) // Get more to ensure we have enough with valid usernames

    if (error) {
      console.error('Error fetching tweets for first accounts:', error)
      return []
    }

    if (!rawTweets || rawTweets.length === 0) {
      console.log('No tweets found for first accounts analysis')
      return []
    }

    const firstAccounts: FirstTweetAccount[] = []
    const seenUsernames = new Set<string>()

    for (const tweet of rawTweets) {
      const username = this.extractUsernameFromUrl(tweet.URL || '')
      
      if (username !== 'Unknown' && !seenUsernames.has(username)) {
        seenUsernames.add(username)
        firstAccounts.push({
          username,
          tweetId: tweet.tweet_id,
          content: tweet.Content || '',
          date: this.parseTweetDate(tweet.Date || ''),
          engagement: this.calculateEngagement(tweet)
        })

        if (firstAccounts.length >= limit) break
      }
    }

    console.log(`✅ Found ${firstAccounts.length} first tweet accounts`)
    return firstAccounts
  }

  /**
   * Get most negative tweets
   */
  private static async getMostNegativeTweets(limit: number = 3): Promise<ExtremeTweet[]> {
    console.log('📊 Getting most negative tweets...')
    
    const { data: processedTweets, error } = await supabase
      .from(TABLES.PROCESSED_TWEETS)
      .select(`
        id,
        original_tweet_id,
        content,
        sentiment,
        confidence,
        likes_count,
        retweets_count,
        replies_count,
        views_count,
        tweet_date
      `)
      .in('sentiment', ['very_negative', 'negative'])
      .order('confidence', { ascending: false })
      .limit(50) // Get more to filter by engagement

    if (error) {
      console.error('Error fetching negative tweets:', error)
      return []
    }

    if (!processedTweets || processedTweets.length === 0) {
      console.log('No negative tweets found')
      return []
    }

    // Get all raw tweets to match by content
    console.log('🔍 Fetching all raw tweets to match by content (negative)...')
    
    const { data: rawTweets, error: rawError } = await supabase
      .from(TABLES.RAW_TWEETS)
      .select('tweet_id, URL, Content')

    if (rawError) {
      console.error('❌ Error fetching raw tweets (negative):', rawError)
    } else {
      console.log('✅ Found raw tweets (negative):', rawTweets?.length || 0)
    }

    // Create a map of content to URL for matching
    const contentToUrlMap = new Map<string, string>()
    rawTweets?.forEach(tweet => {
      if (tweet.Content && tweet.URL) {
        // Normalize content for matching (remove extra spaces, etc.)
        const normalizedContent = tweet.Content.trim().replace(/\s+/g, ' ')
        contentToUrlMap.set(normalizedContent, tweet.URL)
      }
    })
    
    console.log('🔍 Content to URL Map size (negative):', contentToUrlMap.size)

    // Calculate engagement and sort
    const negativeTweets: ExtremeTweet[] = processedTweets
      .map(tweet => {
        const engagement = (tweet.likes_count || 0) + 
                          (tweet.retweets_count || 0) * 2 + 
                          (tweet.replies_count || 0) * 3 + 
                          (tweet.views_count || 0) * 0.1
        
        // Match by content to find the URL
        const normalizedContent = tweet.content.trim().replace(/\s+/g, ' ')
        const url = contentToUrlMap.get(normalizedContent) || ''
        const username = this.extractUsernameFromUrl(url)
        console.log(`🔍 Negative Tweet ${tweet.original_tweet_id}: Content="${normalizedContent.substring(0, 50)}..." -> URL="${url}" -> Username="${username}"`)
        console.log(`🔍 Content Map has key?`, contentToUrlMap.has(normalizedContent))
        
        return {
          tweetId: tweet.original_tweet_id,
          content: tweet.content,
          username: username,
          sentiment: tweet.sentiment,
          confidence: tweet.confidence,
          engagement,
          date: typeof tweet.tweet_date === 'string' ? tweet.tweet_date : tweet.tweet_date.toISOString()
        }
      })
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, limit)

    console.log(`✅ Found ${negativeTweets.length} most negative tweets`)
    return negativeTweets
  }

  /**
   * Get most positive tweets
   */
  private static async getMostPositiveTweets(limit: number = 3): Promise<ExtremeTweet[]> {
    console.log('📊 Getting most positive tweets...')
    
    const { data: processedTweets, error } = await supabase
      .from(TABLES.PROCESSED_TWEETS)
      .select(`
        id,
        original_tweet_id,
        content,
        sentiment,
        confidence,
        likes_count,
        retweets_count,
        replies_count,
        views_count,
        tweet_date
      `)
      .in('sentiment', ['very_positive', 'positive'])
      .order('confidence', { ascending: false })
      .limit(50) // Get more to filter by engagement

    if (error) {
      console.error('Error fetching positive tweets:', error)
      return []
    }

    if (!processedTweets || processedTweets.length === 0) {
      console.log('No positive tweets found')
      return []
    }

    // Get all raw tweets to match by content
    console.log('🔍 Fetching all raw tweets to match by content (positive)...')
    
    const { data: rawTweets, error: rawError } = await supabase
      .from(TABLES.RAW_TWEETS)
      .select('tweet_id, URL, Content')

    if (rawError) {
      console.error('❌ Error fetching raw tweets (positive):', rawError)
    } else {
      console.log('✅ Found raw tweets (positive):', rawTweets?.length || 0)
    }

    // Create a map of content to URL for matching
    const contentToUrlMap = new Map<string, string>()
    rawTweets?.forEach(tweet => {
      if (tweet.Content && tweet.URL) {
        // Normalize content for matching (remove extra spaces, etc.)
        const normalizedContent = tweet.Content.trim().replace(/\s+/g, ' ')
        contentToUrlMap.set(normalizedContent, tweet.URL)
      }
    })
    
    console.log('🔍 Content to URL Map size (positive):', contentToUrlMap.size)

    // Calculate engagement and sort
    const positiveTweets: ExtremeTweet[] = processedTweets
      .map(tweet => {
        const engagement = (tweet.likes_count || 0) + 
                          (tweet.retweets_count || 0) * 2 + 
                          (tweet.replies_count || 0) * 3 + 
                          (tweet.views_count || 0) * 0.1
        
        // Match by content to find the URL
        const normalizedContent = tweet.content.trim().replace(/\s+/g, ' ')
        const url = contentToUrlMap.get(normalizedContent) || ''
        const username = this.extractUsernameFromUrl(url)
        console.log(`🔍 Positive Tweet ${tweet.original_tweet_id}: Content="${normalizedContent.substring(0, 50)}..." -> URL="${url}" -> Username="${username}"`)
        console.log(`🔍 Content Map has key?`, contentToUrlMap.has(normalizedContent))
        
        return {
          tweetId: tweet.original_tweet_id,
          content: tweet.content,
          username: username,
          sentiment: tweet.sentiment,
          confidence: tweet.confidence,
          engagement,
          date: typeof tweet.tweet_date === 'string' ? tweet.tweet_date : tweet.tweet_date.toISOString()
        }
      })
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, limit)

    console.log(`✅ Found ${positiveTweets.length} most positive tweets`)
    return positiveTweets
  }

  /**
   * Get overall sentiment per keyword
   */
  private static async getKeywordSentiments(): Promise<KeywordSentiment[]> {
    console.log('📊 Getting keyword sentiments...')
    
    // Get all keywords
    const { data: keywords, error: keywordsError } = await supabase
      .from(TABLES.KEYWORDS)
      .select('keyword')

    if (keywordsError) {
      console.error('Error fetching keywords:', keywordsError)
      return []
    }

    if (!keywords || keywords.length === 0) {
      console.log('No keywords found')
      return []
    }

    console.log(`🔍 Found ${keywords.length} keywords:`, keywords.map(k => k.keyword))

    // Debug: Get total count of processed tweets
    const { count: totalProcessedTweets } = await supabase
      .from(TABLES.PROCESSED_TWEETS)
      .select('*', { count: 'exact', head: true })
    console.log(`📊 Total processed tweets available: ${totalProcessedTweets}`)

    const keywordSentiments: KeywordSentiment[] = []

    for (const keywordData of keywords) {
      const keyword = keywordData.keyword.toLowerCase()
      console.log(`🔍 Analyzing keyword: "${keyword}"`)
      
      // Get processed tweets that contain this keyword (search in both content and processed_content)
      const { data: processedTweets, error } = await supabase
        .from(TABLES.PROCESSED_TWEETS)
        .select('sentiment, confidence, content, processed_content')
        .or(`content.ilike.%${keyword}%,processed_content.ilike.%${keyword}%`)

      if (error) {
        console.error(`Error fetching tweets for keyword ${keyword}:`, error)
        continue
      }

      console.log(`📊 Found ${processedTweets?.length || 0} tweets for keyword "${keyword}"`)

      if (!processedTweets || processedTweets.length === 0) {
        console.log(`⚠️ No tweets found for keyword "${keyword}"`)
        continue
      }

      // Calculate sentiment breakdown
      const sentimentBreakdown = {
        very_positive: 0,
        positive: 0,
        neutral: 0,
        negative: 0,
        very_negative: 0
      }

      let totalSentimentScore = 0

      processedTweets.forEach(tweet => {
        sentimentBreakdown[tweet.sentiment]++
        
        // Calculate sentiment score (-2 to +2)
        switch (tweet.sentiment) {
          case 'very_negative':
            totalSentimentScore -= 2
            break
          case 'negative':
            totalSentimentScore -= 1
            break
          case 'neutral':
            totalSentimentScore += 0
            break
          case 'positive':
            totalSentimentScore += 1
            break
          case 'very_positive':
            totalSentimentScore += 2
            break
        }
      })

      const avgSentimentScore = totalSentimentScore / processedTweets.length
      
      // Determine overall sentiment
      let overallSentiment: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative'
      if (avgSentimentScore >= 1.5) {
        overallSentiment = 'very_positive'
      } else if (avgSentimentScore >= 0.5) {
        overallSentiment = 'positive'
      } else if (avgSentimentScore >= -0.5) {
        overallSentiment = 'neutral'
      } else if (avgSentimentScore >= -1.5) {
        overallSentiment = 'negative'
      } else {
        overallSentiment = 'very_negative'
      }

      keywordSentiments.push({
        keyword: keywordData.keyword,
        totalTweets: processedTweets.length,
        sentimentBreakdown,
        overallSentiment,
        sentimentScore: avgSentimentScore
      })
    }

    console.log(`✅ Found sentiment data for ${keywordSentiments.length} keywords`)
    return keywordSentiments
  }

  /**
   * Generate comprehensive report data
   */
  static async generateReport(): Promise<ReportData> {
    console.log('📊 Generating comprehensive report...')
    
    try {
      // Get basic stats
      const { count: totalTweets } = await supabase
        .from(TABLES.RAW_TWEETS)
        .select('*', { count: 'exact', head: true })

      const { count: processedTweets } = await supabase
        .from(TABLES.PROCESSED_TWEETS)
        .select('*', { count: 'exact', head: true })

      console.log(`📊 Total tweets: ${totalTweets}, Processed tweets: ${processedTweets}`)

      // Get date range
      const { data: dateData } = await supabase
        .from(TABLES.RAW_TWEETS)
        .select('Date')
        .not('Date', 'is', null)
        .order('Date', { ascending: true })
        .limit(1)

      const { data: latestDateData } = await supabase
        .from(TABLES.RAW_TWEETS)
        .select('Date')
        .not('Date', 'is', null)
        .order('Date', { ascending: false })
        .limit(1)

      const earliest = dateData?.[0]?.Date ? this.parseTweetDate(dateData[0].Date) : new Date().toISOString()
      const latest = latestDateData?.[0]?.Date ? this.parseTweetDate(latestDateData[0].Date) : new Date().toISOString()

      // Generate all report sections in parallel
      const [
        topAccounts,
        firstTweetAccounts,
        mostNegativeTweets,
        mostPositiveTweets,
        keywordSentiments
      ] = await Promise.all([
        this.getTopAccountsByEngagement(3),
        this.getFirstTweetAccounts(3),
        this.getMostNegativeTweets(3),
        this.getMostPositiveTweets(3),
        this.getKeywordSentiments()
      ])

      const reportData: ReportData = {
        generatedAt: new Date().toISOString(),
        totalTweets: totalTweets || 0,
        processedTweets: processedTweets || 0,
        dateRange: {
          earliest,
          latest
        },
        topAccounts,
        firstTweetAccounts,
        mostNegativeTweets,
        mostPositiveTweets,
        keywordSentiments
      }

      console.log('✅ Report generated successfully')
      return reportData

    } catch (error) {
      console.error('❌ Error generating report:', error)
      throw new Error(`Failed to generate report: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Export report as PDF
   */
  static async exportReportAsPDF(reportData: ReportData): Promise<void> {
    console.log('📄 Generating PDF report...')
    
    try {
      const pdf = new jsPDF()
      let yPosition = 20
      const margin = 20
      const pageWidth = pdf.internal.pageSize.getWidth()
      const contentWidth = pageWidth - (margin * 2)
      
      // Simple helper to add text
      const addText = (text: string, fontSize: number = 12, isBold: boolean = false) => {
        pdf.setFontSize(fontSize)
        pdf.setFont('helvetica', isBold ? 'bold' : 'normal')
        
        const lines = pdf.splitTextToSize(text, contentWidth)
        for (const line of lines) {
          if (yPosition > 280) {
            pdf.addPage()
            yPosition = 20
          }
          pdf.text(line, margin, yPosition)
          yPosition += fontSize * 0.4
        }
        yPosition += 5
      }
      
      // Title
      addText('Tweet Sentiment Analysis Report', 18, true)
      addText(`Generated on ${new Date(reportData.generatedAt).toLocaleDateString()}`, 10)
      yPosition += 10
      
      // Summary
      addText('SUMMARY STATISTICS', 14, true)
      addText(`Total Tweets: ${reportData.totalTweets.toLocaleString()}`, 12)
      addText(`Processed Tweets: ${reportData.processedTweets.toLocaleString()}`, 12)
      addText(`Date Range: ${new Date(reportData.dateRange.earliest).toLocaleDateString()} - ${new Date(reportData.dateRange.latest).toLocaleDateString()}`, 12)
      yPosition += 10
      
      // Top Accounts
      if (reportData.topAccounts.length > 0) {
        addText('TOP 3 ACCOUNTS BY ENGAGEMENT', 14, true)
        reportData.topAccounts.forEach((account, index) => {
          addText(`${index + 1}. @${account.username}`, 12, true)
          addText(`   Total Engagement: ${account.totalEngagement.toLocaleString()}`, 10)
          addText(`   Tweet Count: ${account.tweetCount}`, 10)
          addText(`   Avg Engagement: ${account.avgEngagement.toFixed(1)}`, 10)
          yPosition += 2
        })
        yPosition += 5
      }
      
      // First Tweet Accounts
      if (reportData.firstTweetAccounts.length > 0) {
        addText('FIRST TWEET ACCOUNTS', 14, true)
        reportData.firstTweetAccounts.forEach((account, index) => {
          addText(`${index + 1}. @${account.username}`, 12, true)
          addText(`   Content: ${this.cleanTextForPDF(account.content)}`, 10)
          addText(`   Date: ${new Date(account.date).toLocaleDateString()}`, 10)
          addText(`   Engagement: ${account.engagement.toLocaleString()}`, 10)
          yPosition += 2
        })
        yPosition += 5
      }
      
      // Most Negative Tweets
      if (reportData.mostNegativeTweets.length > 0) {
        addText('MOST NEGATIVE TWEETS', 14, true)
        reportData.mostNegativeTweets.forEach((tweet, index) => {
          addText(`${index + 1}. @${tweet.username}`, 12, true)
          addText(`   Content: ${this.cleanTextForPDF(tweet.content)}`, 10)
          addText(`   Sentiment: ${tweet.sentiment} (${(tweet.confidence * 100).toFixed(1)}%)`, 10)
          addText(`   Engagement: ${tweet.engagement.toLocaleString()}`, 10)
          yPosition += 2
        })
        yPosition += 5
      }
      
      // Most Positive Tweets
      if (reportData.mostPositiveTweets.length > 0) {
        addText('MOST POSITIVE TWEETS', 14, true)
        reportData.mostPositiveTweets.forEach((tweet, index) => {
          addText(`${index + 1}. @${tweet.username}`, 12, true)
          addText(`   Content: ${this.cleanTextForPDF(tweet.content)}`, 10)
          addText(`   Sentiment: ${tweet.sentiment} (${(tweet.confidence * 100).toFixed(1)}%)`, 10)
          addText(`   Engagement: ${tweet.engagement.toLocaleString()}`, 10)
          yPosition += 2
        })
        yPosition += 5
      }
      
      // Keyword Sentiments
      if (reportData.keywordSentiments.length > 0) {
        addText('SENTIMENT ANALYSIS BY KEYWORD', 14, true)
        reportData.keywordSentiments.forEach((keyword, index) => {
          addText(`${index + 1}. #${keyword.keyword}`, 12, true)
          addText(`   Total Tweets: ${keyword.totalTweets}`, 10)
          addText(`   Overall Sentiment: ${keyword.overallSentiment}`, 10)
          addText(`   Sentiment Score: ${keyword.sentimentScore.toFixed(2)}`, 10)
          yPosition += 2
        })
      }
      
      // Footer
      yPosition += 20
      addText('Report generated by Tweet Pulse Graph Analytics System', 8)
      addText('Data processed using Claude Sonnet 4 sentiment analysis', 8)
      
      // Save the PDF
      const fileName = `tweet-sentiment-report-${new Date().toISOString().split('T')[0]}.pdf`
      pdf.save(fileName)
      
      console.log('✅ PDF report generated successfully')
      
    } catch (error) {
      console.error('❌ Error generating PDF:', error)
      throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate HTML report content
   */
  private static generateHTMLReport(reportData: ReportData): string {
    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString()
    const formatNumber = (num: number) => num.toLocaleString()
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tweet Sentiment Analysis Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #fff;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #3b82f6;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #1e40af;
            margin: 0;
            font-size: 2.5em;
        }
        .header p {
            color: #6b7280;
            margin: 10px 0 0 0;
        }
        .section {
            margin-bottom: 40px;
            page-break-inside: avoid;
        }
        .section h2 {
            color: #1e40af;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
        }
        .stat-card h3 {
            margin: 0 0 10px 0;
            color: #374151;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .stat-card .value {
            font-size: 2em;
            font-weight: bold;
            color: #1e40af;
            margin: 0;
        }
        .table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        .table th,
        .table td {
            border: 1px solid #e5e7eb;
            padding: 12px;
            text-align: left;
        }
        .table th {
            background: #f3f4f6;
            font-weight: 600;
            color: #374151;
        }
        .table tr:nth-child(even) {
            background: #f9fafb;
        }
        .sentiment-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: 600;
            text-transform: uppercase;
        }
        .sentiment-very-positive { background: #dcfce7; color: #166534; }
        .sentiment-positive { background: #dcfce7; color: #166534; }
        .sentiment-neutral { background: #fef3c7; color: #92400e; }
        .sentiment-negative { background: #fee2e2; color: #991b1b; }
        .sentiment-very-negative { background: #fee2e2; color: #991b1b; }
        .tweet-content {
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 0.9em;
        }
        @media print {
            body { margin: 0; padding: 15px; }
            .section { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Tweet Sentiment Analysis Report</h1>
        <p>Generated on ${formatDate(reportData.generatedAt)}</p>
    </div>

    <div class="stats-grid">
        <div class="stat-card">
            <h3>Total Tweets</h3>
            <p class="value">${formatNumber(reportData.totalTweets)}</p>
        </div>
        <div class="stat-card">
            <h3>Processed Tweets</h3>
            <p class="value">${formatNumber(reportData.processedTweets)}</p>
        </div>
        <div class="stat-card">
            <h3>Date Range</h3>
            <p class="value">${formatDate(reportData.dateRange.earliest)} - ${formatDate(reportData.dateRange.latest)}</p>
        </div>
    </div>

    <div class="section">
        <h2>🏆 Top 3 Accounts by Engagement</h2>
        <table class="table">
            <thead>
                <tr>
                    <th>Username</th>
                    <th>Total Engagement</th>
                    <th>Tweet Count</th>
                    <th>Avg Engagement</th>
                </tr>
            </thead>
            <tbody>
                ${reportData.topAccounts.map(account => `
                    <tr>
                        <td>@${account.username}</td>
                        <td>${formatNumber(account.totalEngagement)}</td>
                        <td>${account.tweetCount}</td>
                        <td>${formatNumber(account.avgEngagement)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>First Tweet Accounts</h2>
        <table class="table">
            <thead>
                <tr>
                    <th>Username</th>
                    <th>Tweet Content</th>
                    <th>Date</th>
                    <th>Engagement</th>
                </tr>
            </thead>
            <tbody>
                ${reportData.firstTweetAccounts.map(account => `
                    <tr>
                        <td>@${account.username}</td>
                        <td class="tweet-content">${account.content}</td>
                        <td>${formatDate(account.date)}</td>
                        <td>${formatNumber(account.engagement)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>😢 Most Negative Tweets</h2>
        <table class="table">
            <thead>
                <tr>
                    <th>Username</th>
                    <th>Content</th>
                    <th>Sentiment</th>
                    <th>Confidence</th>
                    <th>Engagement</th>
                </tr>
            </thead>
            <tbody>
                ${reportData.mostNegativeTweets.map(tweet => `
                    <tr>
                        <td>@${tweet.username}</td>
                        <td class="tweet-content">${tweet.content}</td>
                        <td><span class="sentiment-badge sentiment-${tweet.sentiment}">${tweet.sentiment}</span></td>
                        <td>${(tweet.confidence * 100).toFixed(1)}%</td>
                        <td>${formatNumber(tweet.engagement)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>😊 Most Positive Tweets</h2>
        <table class="table">
            <thead>
                <tr>
                    <th>Username</th>
                    <th>Content</th>
                    <th>Sentiment</th>
                    <th>Confidence</th>
                    <th>Engagement</th>
                </tr>
            </thead>
            <tbody>
                ${reportData.mostPositiveTweets.map(tweet => `
                    <tr>
                        <td>@${tweet.username}</td>
                        <td class="tweet-content">${tweet.content}</td>
                        <td><span class="sentiment-badge sentiment-${tweet.sentiment}">${tweet.sentiment}</span></td>
                        <td>${(tweet.confidence * 100).toFixed(1)}%</td>
                        <td>${formatNumber(tweet.engagement)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>Sentiment Analysis by Keyword</h2>
        <table class="table">
            <thead>
                <tr>
                    <th>Keyword</th>
                    <th>Total Tweets</th>
                    <th>Overall Sentiment</th>
                    <th>Sentiment Score</th>
                    <th>Breakdown</th>
                </tr>
            </thead>
            <tbody>
                ${reportData.keywordSentiments.map(keyword => `
                    <tr>
                        <td>#${keyword.keyword}</td>
                        <td>${keyword.totalTweets}</td>
                        <td><span class="sentiment-badge sentiment-${keyword.overallSentiment}">${keyword.overallSentiment}</span></td>
                        <td>${keyword.sentimentScore.toFixed(2)}</td>
                        <td>
                            Very Positive: ${keyword.sentimentBreakdown.very_positive} |
                            Positive: ${keyword.sentimentBreakdown.positive} |
                            Neutral: ${keyword.sentimentBreakdown.neutral} |
                            Negative: ${keyword.sentimentBreakdown.negative} |
                            Very Negative: ${keyword.sentimentBreakdown.very_negative}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="footer">
        <p>Report generated by Tweet Pulse Graph Analytics System</p>
        <p>Data processed using Claude Sonnet 4 sentiment analysis</p>
    </div>
</body>
</html>
    `
  }
}
