import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { TweetService, DataProcessingService, ClaudeSentimentAnalysisService } from '@/lib/services'
import type { ProcessingProgress, ProcessingStats } from '@/lib/services'
import { DebugService } from '@/lib/debug'
import { Play, RefreshCw, CheckCircle, AlertCircle, Database, Zap, Bug } from 'lucide-react'

export const DataProcessingControls: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState<ProcessingProgress>({
    stage: 'idle',
    progress: 0,
    message: 'Ready to process tweets'
  })
  const [stats, setStats] = useState<ProcessingStats | null>(null)
  const [lastProcessedDate, setLastProcessedDate] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  // Load initial stats
  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      console.log('Loading stats...')
      const [statsData, lastDate] = await Promise.all([
        TweetService.getProcessingStats(),
        TweetService.getLastProcessedDate()
      ])
      setStats(statsData)
      setLastProcessedDate(lastDate)
      setError(null) // Clear any previous errors
    } catch (error) {
      console.error('Error loading stats:', error)
      setError('Failed to load processing statistics - check console for details')
      // Set fallback stats to prevent UI issues
      setStats({
        totalTweets: 0,
        processedTweets: 0,
        remainingTweets: 0
      })
    }
  }

  const handleProcessTweets = async () => {
    console.log('Processing tweets button clicked')
    setIsProcessing(true)
    setError(null)

    try {
      // Process tweets directly in the frontend
      const processedTweets = await DataProcessingService.processTweetsDirectly((progress) => {
        setProgress(progress)
      })

      toast({
        title: "Processing Complete",
        description: `Successfully processed ${processedTweets.length} tweets with sentiment analysis.`,
      })

      // Refresh stats after processing
      await loadStats()

    } catch (error) {
      console.error('Error processing tweets:', error)
      setError(error instanceof Error ? error.message : 'Failed to process tweets')
      setProgress({
        stage: 'error',
        progress: 0,
        message: 'Processing failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      toast({
        title: "Processing Failed",
        description: error instanceof Error ? error.message : 'Failed to process tweets',
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFetchNewTweets = async () => {
    console.log('Fetch new tweets button clicked')
    setIsProcessing(true)
    setError(null)
    setProgress({
      stage: 'fetching',
      progress: 0,
      message: 'Triggering n8n workflow to fetch new tweets...'
    })

    try {
      // Trigger n8n workflow to fetch new tweets
      const result = await DataProcessingService.triggerN8nWorkflow()

      if (!result.success) {
        throw new Error(result.message)
      }

      toast({
        title: "Fetching Started",
        description: "n8n workflow has been triggered to fetch new tweets from Twitter.",
      })

      // Poll for updates every 5 seconds
      const pollInterval = setInterval(async () => {
        try {
          await loadStats()
        } catch (error) {
          console.error('Error polling stats:', error)
        }
      }, 5000)

      // Stop polling after 2 minutes
      setTimeout(() => {
        clearInterval(pollInterval)
        setIsProcessing(false)
        setProgress({
          stage: 'completed',
          progress: 100,
          message: 'Tweet fetching completed. You can now process the new tweets.'
        })
      }, 120000)

    } catch (error) {
      console.error('Error triggering workflow:', error)
      setError(error instanceof Error ? error.message : 'Failed to trigger workflow')
      setIsProcessing(false)
      setProgress({
        stage: 'error',
        progress: 0,
        message: 'Fetching failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      toast({
        title: "Fetching Failed",
        description: error instanceof Error ? error.message : 'Failed to trigger workflow',
        variant: "destructive"
      })
    }
  }

  const handleRefreshStats = async () => {
    console.log('Refresh stats button clicked')
    await loadStats()
    toast({
      title: "Stats Updated",
      description: "Processing statistics have been refreshed.",
    })
  }

  const handleDebugCheck = async () => {
    console.log('🔍 Debug check button clicked - Running debug checks...')
    try {
      await DebugService.runAllChecks()
      toast({
        title: "Debug Check Complete",
        description: "Check the browser console for detailed debug information.",
      })
    } catch (error) {
      console.error('Debug check failed:', error)
      toast({
        title: "Debug Check Failed",
        description: "Check the browser console for error details.",
        variant: "destructive"
      })
    }
  }

  const testClaudeService = async () => {
    try {
      console.log('Testing Claude 3.5 Haiku sentiment analysis...')
      setIsProcessing(true)
      setProgress({
        stage: 'analyzing',
        progress: 0,
        message: 'Testing Claude sentiment analysis...'
      })
      
      const testTexts = [
        "I love this new feature!",
        "This is terrible and I hate it.",
        "The weather is okay today.",
        "This is absolutely amazing and wonderful!",
        "I'm so disappointed with this service."
      ]
      
      const results = await ClaudeSentimentAnalysisService.analyzeSentimentsBatch(testTexts)
      
      console.log('Claude test results:', results)
      
      toast({
        title: 'Claude Test Complete',
        description: `Successfully analyzed ${results.length} texts with Claude 3.5 Haiku`,
        variant: 'default'
      })
      
      setProgress({
        stage: 'completed',
        progress: 100,
        message: 'Claude test completed successfully'
      })
      
    } catch (error) {
      console.error('Claude test failed:', error)
      toast({
        title: 'Claude Test Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive'
      })
      setProgress({
        stage: 'error',
        progress: 0,
        message: 'Claude test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const getProgressColor = () => {
    switch (progress.stage) {
      case 'completed': return 'bg-green-500'
      case 'error': return 'bg-red-500'
      default: return 'bg-blue-500'
    }
  }

  const getStatusIcon = () => {
    switch (progress.stage) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />
      default: return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
    }
  }

  return (
    <div className="space-y-4">
      {/* Processing Control Card */}
      <Card className="gradient-card border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Data Processing Control
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Control Buttons */}
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Button
                onClick={handleProcessTweets}
                disabled={isProcessing}
                className="flex items-center gap-2"
              >
                <Play className="h-4 w-4" />
                {isProcessing ? 'Processing...' : 'Process Tweets'}
              </Button>

              <Button
                variant="outline"
                onClick={handleFetchNewTweets}
                disabled={isProcessing}
                className="flex items-center gap-2"
              >
                <Zap className="h-4 w-4" />
                Fetch New Tweets
              </Button>

              <Button
                variant="outline"
                onClick={handleRefreshStats}
                disabled={isProcessing}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh Stats
              </Button>

              <Button
                variant="outline"
                onClick={handleDebugCheck}
                disabled={isProcessing}
                className="flex items-center gap-2"
              >
                <Bug className="h-4 w-4" />
                Debug Check
              </Button>
              <Button
                variant="outline"
                onClick={testClaudeService}
                disabled={isProcessing}
                className="flex items-center gap-2"
              >
                <Zap className="h-4 w-4" />
                Test Claude
              </Button>
            </div>
            
            <div className="text-xs text-muted-foreground">
              <strong>Process Tweets:</strong> Analyzes sentiment of existing raw tweets using Claude 3.5 Haiku<br/>
              <strong>Fetch New Tweets:</strong> Triggers n8n workflow to get new tweets from Twitter<br/>
              <strong>Test Claude:</strong> Tests Claude 3.5 Haiku sentiment analysis with sample texts
            </div>
          </div>

          {/* Progress Indicator */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Processing Progress</span>
                <span className="text-sm font-medium">{progress.progress}%</span>
              </div>
              <Progress value={progress.progress} className="w-full" />
              <div className="flex items-center gap-2">
                {getStatusIcon()}
                <span className="text-sm">{progress.message}</span>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Statistics Card */}
      <Card className="gradient-card border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Processing Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{stats.totalTweets.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Tweets</div>
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{stats.processedTweets.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Processed</div>
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-orange-500">{stats.remainingTweets.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Remaining</div>
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">
                  {stats.totalTweets > 0 ? Math.round((stats.processedTweets / stats.totalTweets) * 100) : 0}%
                </div>
                <div className="text-sm text-muted-foreground">Complete</div>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              Loading statistics...
            </div>
          )}

          {/* Last Processed Date */}
          {lastProcessedDate && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Last Processed:</span>
                <Badge variant="outline">
                  {new Date(lastProcessedDate).toLocaleString()}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions Card */}
      <Card className="border shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">1</div>
            <div>Click "Fetch New Tweets" to trigger n8n workflow for getting new tweets from Twitter</div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">2</div>
            <div>n8n stores new tweets in Supabase "Extracted Uncleaned" table</div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">3</div>
            <div>Click "Process Tweets" to analyze sentiment of existing raw tweets</div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">4</div>
            <div>Filters tweets from 2025 and performs Spanish sentiment analysis using UMUTeam/roberta-spanish-sentiment-analysis</div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">5</div>
            <div>Stores processed results in "processed_tweets" table and updates dashboard</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
