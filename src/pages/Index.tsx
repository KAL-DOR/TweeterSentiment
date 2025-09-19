import React, { useState, useEffect } from 'react';
import { generateMockSentimentData, generateSummaryStats } from '@/data/mockData';
import { TweetService, DataProcessingService, KeywordService } from '@/lib/services';
import { supabase, Keyword } from '@/lib/supabase';
import { SentimentFlowChart } from '@/components/Dashboard/SentimentFlowChart';
import { ReportService } from '@/lib/report-service';
import { BarChart3, TrendingUp, Settings, Download, Database, Play, BarChart, RotateCcw, Trash2, FileText, Plus, X } from 'lucide-react';

const Index = () => {
  console.log('Index component rendering...');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [stats, setStats] = useState(generateSummaryStats());
  const [realStats, setRealStats] = useState<{totalTweets: number, processedTweets: number, remainingTweets: number} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<{ x: number; y: number; sentiment: string; confidence: number; tweetId: number }[]>([]);
  
  // Keyword management state
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [newKeyword, setNewKeyword] = useState<string>('');
  const [isAddingKeyword, setIsAddingKeyword] = useState(false);
  
  // Report export state
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  
  // Load real stats, graph data, and keywords on component mount
  useEffect(() => {
    loadRealStats();
    loadGraphData();
    loadKeywords();
  }, []);

  const loadRealStats = async () => {
    try {
      console.log('🔄 Loading real stats from Supabase...');
      const realStatsData = await TweetService.getProcessingStats();
      console.log('✅ Real stats loaded:', realStatsData);
      setRealStats(realStatsData);
      setError(null);
    } catch (error) {
      console.error('❌ Error loading real stats:', error);
      // Keep mock stats if real ones fail
      setRealStats(null);
      setError('Using mock data - check Supabase connection');
    }
  };

  const loadGraphData = async () => {
    try {
      console.log('📊 Loading processed tweets for 2D graph...');
      const processedTweets = await DataProcessingService.getProcessedTweets(1000);
      console.log(`📈 Loaded ${processedTweets.length} processed tweets`);

      if (processedTweets.length > 0) {
        console.log('📊 Sample processed tweets:', processedTweets.slice(0, 3));
        const transformedData = DataProcessingService.transformProcessedTweetsFor2DGraph(processedTweets);
        console.log(`🎯 Transformed into ${transformedData.length} 2D points`);
        console.log('🎯 Setting graph data:', transformedData);
        setGraphData(transformedData);
      } else {
        console.log('⚠️ No processed tweets found, using empty graph');
        setGraphData([]);
      }
    } catch (error) {
      console.error('❌ Error loading graph data:', error);
      setGraphData([]);
    }
  };

  const handleProcessTweets = async () => {
    console.log('🚀 Starting real tweet processing...');
    setIsProcessing(true);
    setProcessingMessage('Starting sentiment analysis...');
    setError(null);

    try {
      console.log('📡 Calling DataProcessingService.processTweetsDirectly...');
      const processedTweets = await DataProcessingService.processTweetsDirectly((progress) => {
        console.log('📊 Processing progress:', progress);
        setProcessingMessage(progress.message);
      });

      console.log('✅ Processing completed successfully!');
      console.log('📈 Processed tweets:', processedTweets);
      console.log('📊 Total processed:', processedTweets.length);

      setProcessingMessage(`✅ Successfully processed ${processedTweets.length} tweets!`);
      await loadRealStats();
      await loadGraphData(); // Reload graph data after processing

      setTimeout(() => {
        setProcessingMessage('');
        setIsProcessing(false);
      }, 4000);

    } catch (error) {
      console.error('❌ Error processing tweets:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      setError(`❌ Failed to process tweets: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setProcessingMessage('');
      setIsProcessing(false);
    }
  };

  const handleFetchNewTweets = async () => {
    console.log('🔄 Triggering n8n workflow...');
    setIsProcessing(true);
    setProcessingMessage('Triggering n8n workflow...');
    setError(null);

    try {
      console.log('📡 Calling DataProcessingService.triggerN8nWorkflow...');
      const result = await DataProcessingService.triggerN8nWorkflow();
      console.log('📊 n8n workflow result:', result);
      
      if (result.success) {
        setProcessingMessage('✅ n8n workflow triggered successfully! Fetching new tweets...');
        
        // Poll for updates every 10 seconds
        const pollInterval = setInterval(async () => {
          try {
            console.log('🔄 Polling for updates...');
            await loadRealStats();
          } catch (error) {
            console.error('❌ Error polling stats:', error);
          }
        }, 10000);

        // Stop polling after 3 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          setProcessingMessage('');
          setIsProcessing(false);
        }, 180000);
      } else {
        throw new Error(result.message);
      }

    } catch (error) {
      console.error('❌ Error triggering workflow:', error);
      setError(`❌ Failed to trigger workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setProcessingMessage('');
      setIsProcessing(false);
    }
  };

  const handleRefreshStats = async () => {
    console.log('🔄 Refreshing stats...');
    setProcessingMessage('Refreshing stats...');
    await loadRealStats();
    setProcessingMessage('✅ Stats refreshed!');

    setTimeout(() => {
      setProcessingMessage('');
    }, 2000);
  };

  const handleRefreshGraph = async () => {
    console.log('📊 Refreshing 3D graph...');
    setProcessingMessage('Loading latest data for graph...');
    await loadGraphData();
    setProcessingMessage('✅ Graph updated with latest data!');

    setTimeout(() => {
      setProcessingMessage('');
    }, 2000);
  };

  const handleReprocessAll = async () => {
    if (!confirm('⚠️ This will delete all existing processed tweets and reprocess them with the new 5-level sentiment scale. Continue?')) {
      return;
    }

    setIsProcessing(true);
    setProcessingMessage('Clearing existing processed tweets...');
    
    try {
      // Clear existing processed tweets
      const { error: deleteError } = await supabase
        .from('processed_tweets')
        .delete()
        .neq('id', 0); // Delete all rows
      
      if (deleteError) {
        throw new Error(`Failed to clear processed tweets: ${deleteError.message}`);
      }
      
      console.log('✅ Cleared existing processed tweets');
      setProcessingMessage('Reprocessing all tweets with 5-level sentiment scale...');
      
      // Now process all tweets
      await handleProcessTweets();
      
    } catch (error) {
      console.error('❌ Error reprocessing tweets:', error);
      setError(`Reprocessing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  const handleClearAllTweets = async () => {
    if (!confirm('🗑️ This will delete ALL tweets (both processed and raw). This is useful for end-to-end testing. Continue?')) {
      return;
    }

    console.log('🗑️ Starting clear all tweets...');
    setIsProcessing(true);
    setProcessingMessage('Clearing all tweets...');
    setError(null);

    try {
      console.log('📡 Calling DataProcessingService.clearAllTweets...');
      const result = await DataProcessingService.clearAllTweets();
      
      if (result.success) {
        console.log('✅ Clear completed successfully!');
        setProcessingMessage('✅ All tweets cleared! Ready for end-to-end test.');
        await loadRealStats();
        await loadGraphData(); // Reload graph data after clearing

        setTimeout(() => {
          setProcessingMessage('');
          setIsProcessing(false);
        }, 3000);
      } else {
        throw new Error(result.message);
      }

    } catch (error) {
      console.error('❌ Error clearing tweets:', error);
      setError(`❌ Failed to clear tweets: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setProcessingMessage('');
      setIsProcessing(false);
    }
  };

  // Keyword management functions
  const loadKeywords = async () => {
    try {
      console.log('🔄 Loading keywords...');
      const keywordsData = await KeywordService.getKeywords();
      setKeywords(keywordsData);
      console.log(`✅ Loaded ${keywordsData.length} keywords`);
    } catch (error) {
      console.error('❌ Failed to load keywords:', error);
      setError(`Failed to load keywords: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const addKeyword = async () => {
    if (!newKeyword.trim()) {
      setError('Please enter a keyword');
      return;
    }

    try {
      setIsAddingKeyword(true);
      setError(null);
      
      console.log(`➕ Adding keyword: "${newKeyword}"`);
      const addedKeyword = await KeywordService.addKeyword(newKeyword.trim());
      
      // Add to local state
      setKeywords(prev => [addedKeyword, ...prev]);
      setNewKeyword('');
      
      console.log('✅ Keyword added successfully');
    } catch (error) {
      console.error('❌ Failed to add keyword:', error);
      setError(`Failed to add keyword: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAddingKeyword(false);
    }
  };

  const deleteKeyword = async (id: number) => {
    try {
      console.log(`🗑️ Deleting keyword with id: ${id}`);
      await KeywordService.deleteKeyword(id);
      
      // Remove from local state
      setKeywords(prev => prev.filter(k => k.id !== id));
      
      console.log('✅ Keyword deleted successfully');
    } catch (error) {
      console.error('❌ Failed to delete keyword:', error);
      setError(`Failed to delete keyword: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleExportReport = async () => {
    console.log('📊 Starting report generation...');
    setIsGeneratingReport(true);
    setError(null);

    try {
      console.log('🔄 Generating comprehensive report data...');
      const reportData = await ReportService.generateReport();
      
      console.log('📄 Exporting report as PDF...');
      await ReportService.exportReportAsPDF(reportData);
      
      console.log('✅ Report exported successfully!');
    } catch (error) {
      console.error('❌ Error generating report:', error);
      setError(`Failed to generate report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg glow-primary">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold gradient-primary bg-clip-text text-transparent">
                  Sentiment Analytics
                </h1>
                <p className="text-sm text-muted-foreground">Real-time Twitter sentiment analysis</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-positive rounded-full animate-pulse"></div>
                <span>Live data</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard */}
      <main className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            {/* Sidebar with stats and controls */}
            <aside className="xl:col-span-2 space-y-6">
            {/* Summary Cards */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Overview
              </h2>
              
                {/* Stats Cards */}
                {realStats ? (
                  // Real stats from Supabase
                  <>
                    <div className="p-4 bg-card rounded-lg border">
                      <h3 className="text-sm font-medium text-muted-foreground">Total Tweets</h3>
                      <div className="text-2xl font-bold text-blue-500">{realStats.totalTweets.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">Raw tweets in database</div>
                    </div>
                    
                    <div className="p-4 bg-card rounded-lg border">
                      <h3 className="text-sm font-medium text-muted-foreground">Processed Tweets</h3>
                      <div className="text-2xl font-bold text-green-500">{realStats.processedTweets.toLocaleString()}</div>
                      <div className="text-xs text-green-500">Sentiment analyzed</div>
                    </div>
                    
                    <div className="p-4 bg-card rounded-lg border">
                      <h3 className="text-sm font-medium text-muted-foreground">Remaining Tweets</h3>
                      <div className="text-2xl font-bold text-orange-500">{realStats.remainingTweets.toLocaleString()}</div>
                      <div className="text-xs text-orange-500">Pending processing</div>
                    </div>
                  </>
                ) : (
                  // Mock stats fallback
                  <>
                    <div className="p-4 bg-card rounded-lg border">
                      <h3 className="text-sm font-medium text-muted-foreground">Positive Sentiment</h3>
                      <div className="text-2xl font-bold text-green-500">{stats.positive.value.toLocaleString()}</div>
                      <div className="text-xs text-green-500">+{stats.positive.percentage}% from last week</div>
                    </div>
                    
                    <div className="p-4 bg-card rounded-lg border">
                      <h3 className="text-sm font-medium text-muted-foreground">Negative Sentiment</h3>
                      <div className="text-2xl font-bold text-red-500">{stats.negative.value.toLocaleString()}</div>
                      <div className="text-xs text-red-500">{stats.negative.percentage}% from last week</div>
                    </div>
                    
                    <div className="p-4 bg-card rounded-lg border">
                      <h3 className="text-sm font-medium text-muted-foreground">Neutral Sentiment</h3>
                      <div className="text-2xl font-bold text-orange-500">{stats.neutral.value.toLocaleString()}</div>
                      <div className="text-xs text-orange-500">+{stats.neutral.percentage}% from last week</div>
                    </div>
                  </>
                )}
              </div>

              {/* Data Processing Controls */}
              <div className="p-4 bg-card rounded-lg border">
                <h3 className="text-lg font-semibold mb-4">Data Processing Controls</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleFetchNewTweets}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    title="Fetch new tweets from n8n workflow"
                  >
                    <Database className="h-4 w-4" />
                    {isProcessing ? 'Fetching...' : 'Extract'}
                  </button>
                  <button
                    onClick={handleProcessTweets}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    title="Process tweets with sentiment analysis"
                  >
                    <Play className="h-4 w-4" />
                    {isProcessing ? 'Processing...' : 'Process'}
                  </button>
                  <button
                    onClick={handleRefreshGraph}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    title="Update 3D graph with latest processed data"
                  >
                    <BarChart className="h-4 w-4" />
                    Graph
                  </button>
                  <button
                    onClick={handleReprocessAll}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    title="Clear and reprocess all tweets with 5-level sentiment scale"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reprocess All
                  </button>
                  <button
                    onClick={handleClearAllTweets}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed col-span-2 flex items-center justify-center gap-2"
                    title="Clear ALL tweets (processed and raw) for end-to-end testing"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear All
                  </button>
                  <button
                    onClick={handleExportReport}
                    disabled={isGeneratingReport || isProcessing}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed col-span-2 flex items-center justify-center gap-2"
                    title="Generate and export comprehensive sentiment analysis report"
                  >
                    <FileText className="h-4 w-4" />
                    {isGeneratingReport ? 'Generating Report...' : 'Export Report'}
                  </button>
                </div>

                <div className="mt-3 text-xs text-muted-foreground">
                  <div className="grid grid-cols-2 gap-2">
                    <div>• <strong>Extract:</strong> Fetch tweets via n8n</div>
                    <div>• <strong>Process:</strong> Analyze sentiment with Claude Sonnet 4</div>
                    <div>• <strong>Graph:</strong> Update 3D visualization</div>
                    <div>• <strong>Reprocess All:</strong> Clear and reprocess all tweets</div>
                    <div className="col-span-2">• <strong>Clear All:</strong> Delete ALL tweets for end-to-end testing</div>
                    <div className="col-span-2">• <strong>Export Report:</strong> Generate comprehensive sentiment analysis report with top accounts, extreme tweets, and keyword insights</div>
                  </div>
            </div>

                {/* Status Messages */}
                {processingMessage && (
                  <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
                    <p className="text-sm text-blue-400">{processingMessage}</p>
                  </div>
                )}
              </div>

              {/* Keyword Management */}
              <div className="p-4 bg-card rounded-lg border">
                <h3 className="text-lg font-semibold mb-4 text-white-900 dark:text-white">Tweet Search Keywords</h3>
                
                {/* Add Keyword Form */}
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="Enter keyword for tweet search..."
                    className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500 dark:placeholder-gray-400"
                    onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                    disabled={isAddingKeyword}
                  />
                  <button
                    onClick={addKeyword}
                    disabled={isAddingKeyword || !newKeyword.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
                    title="Add keyword for tweet search"
                  >
                    <Plus className="h-4 w-4" />
                    {isAddingKeyword ? 'Adding...' : 'Add'}
                  </button>
                </div>

                {/* Keywords List */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-white">
                    Current Keywords ({keywords.length})
                  </h4>
                  {keywords.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">No keywords added yet</p>
                  ) : (
                    <div className="space-y-1">
                      {keywords.map((keyword) => (
                        <div
                          key={keyword.id}
                          className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600"
                        >
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{keyword.keyword}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {keyword.created_at ? new Date(keyword.created_at).toLocaleDateString() : ''}
                            </span>
                            <button
                              onClick={() => deleteKeyword(keyword.id!)}
                              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Delete keyword"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </aside>

            {/* Main 2D Graph Area */}
            <section className="xl:col-span-3">
            <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">Sentiment Flow Throughout the Day</h2>
              <p className="text-muted-foreground">
                  Line chart showing the emotional journey and sentiment trends by hour
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    <span>Very Positive</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Positive</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span>Neutral</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span>Negative</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                    <span>Very Negative</span>
                  </div>
                  <div className="text-muted-foreground">
                    • {graphData.length} data points
                  </div>
                </div>
            </div>
            
            <div className="relative">
              <div className="h-[600px] w-full">
                  <SentimentFlowChart data={graphData} />
              </div>
            </div>
          </section>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="fixed bottom-4 right-4 p-4 bg-red-500/10 border border-red-500/20 rounded-md max-w-md">
            <p className="text-sm text-red-400">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="mt-2 text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Dismiss
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;