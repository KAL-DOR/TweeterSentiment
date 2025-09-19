import React, { useMemo } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, ReferenceLine } from 'recharts';

interface SentimentPoint {
  x: number; // Sentiment: -2 (very negative), -1 (negative), 0 (neutral), +1 (positive), +2 (very positive)
  y: number; // Minutes: 0-1439 (0 = midnight, 1439 = 11:59 PM)
  sentiment: string;
  confidence: number;
  tweetId: number;
}

interface SentimentFlowChartProps {
  data: SentimentPoint[];
}

interface TimeAggregatedData {
  time: string; // Hour format like "00:00", "01:00", etc.
  hour: number; // 0-23
  avgSentiment: number; // Average sentiment for this hour
  tweetCount: number; // Number of tweets in this hour
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  confidence: number; // Average confidence
}

export const SentimentFlowChart: React.FC<SentimentFlowChartProps> = ({ data }) => {
  console.log(`🎯 SentimentFlowChart received ${data.length} data points`);

  // Aggregate data by 30-minute intervals to show flow throughout the day
  const aggregatedData = useMemo(() => {
    if (data.length === 0) return [];

    // Group tweets by 30-minute intervals
    const intervalData = new Map<number, SentimentPoint[]>();
    
    data.forEach(point => {
      const interval = Math.floor(point.y / 30); // Convert minutes to 30-minute intervals
      if (!intervalData.has(interval)) {
        intervalData.set(interval, []);
      }
      intervalData.get(interval)!.push(point);
    });

    // Calculate averages for each 30-minute interval
    const result: TimeAggregatedData[] = [];
    
    for (let interval = 0; interval < 48; interval++) { // 48 intervals of 30 minutes each
      const tweetsInInterval = intervalData.get(interval) || [];
      
      if (tweetsInInterval.length > 0) {
        const avgSentiment = tweetsInInterval.reduce((sum, tweet) => sum + tweet.x, 0) / tweetsInInterval.length;
        const avgConfidence = tweetsInInterval.reduce((sum, tweet) => sum + tweet.confidence, 0) / tweetsInInterval.length;
        
        const veryPositiveCount = tweetsInInterval.filter(t => t.sentiment === 'very_positive').length;
        const positiveCount = tweetsInInterval.filter(t => t.sentiment === 'positive').length;
        const neutralCount = tweetsInInterval.filter(t => t.sentiment === 'neutral').length;
        const negativeCount = tweetsInInterval.filter(t => t.sentiment === 'negative').length;
        const veryNegativeCount = tweetsInInterval.filter(t => t.sentiment === 'very_negative').length;
        
        // Convert interval to time format (30-minute intervals)
        const hour = Math.floor(interval / 2);
        const minute = (interval % 2) * 30;
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        result.push({
          time: timeStr,
          hour: interval, // Use interval as hour for consistency
          avgSentiment: Math.round(avgSentiment * 100) / 100, // Round to 2 decimal places
          tweetCount: tweetsInInterval.length,
          veryPositiveCount,
          positiveCount,
          neutralCount,
          negativeCount,
          veryNegativeCount,
          confidence: Math.round(avgConfidence * 100) / 100
        });
      } else {
        // Add empty intervals to maintain continuity
        const hour = Math.floor(interval / 2);
        const minute = (interval % 2) * 30;
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        result.push({
          time: timeStr,
          hour: interval,
          avgSentiment: 0,
          tweetCount: 0,
          veryPositiveCount: 0,
          positiveCount: 0,
          neutralCount: 0,
          negativeCount: 0,
          veryNegativeCount: 0,
          confidence: 0
        });
      }
    }

    console.log(`📊 Aggregated into ${result.length} 30-minute interval data points`);
    console.log(`📊 Sample aggregated data:`, result.slice(0, 5));
    
    return result;
  }, [data]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border rounded-lg p-3 shadow-lg">
          <p className="font-semibold">{`Time: ${label}`}</p>
          <p className="text-sm">
            <span className="text-blue-600">Sentiment: {data.avgSentiment}</span>
          </p>
          <p className="text-sm">
            <span className="text-green-600">Very Positive: {data.veryPositiveCount}</span> | 
            <span className="text-green-500">Positive: {data.positiveCount}</span> | 
            <span className="text-orange-600">Neutral: {data.neutralCount}</span> | 
            <span className="text-red-500">Negative: {data.negativeCount}</span> | 
            <span className="text-red-600">Very Negative: {data.veryNegativeCount}</span>
          </p>
          <p className="text-sm text-gray-600">
            Total tweets: {data.tweetCount} | Confidence: {data.confidence}
          </p>
        </div>
      );
    }
    return null;
  };

  // Format X-axis labels to show only every 2 hours (since we have 30-min intervals)
  const formatXAxisLabel = (tickItem: string) => {
    const hour = parseInt(tickItem.split(':')[0]);
    const minute = parseInt(tickItem.split(':')[1]);
    // Show labels for even hours at :00 and :30
    if (hour % 2 === 0 && (minute === 0 || minute === 30)) {
      return tickItem;
    }
    return '';
  };

  // Debug: Log aggregated data before rendering
  console.log('🎨 Chart rendering with aggregated data:', aggregatedData.length, 'points');
  console.log('🎨 Sample aggregated data for chart:', aggregatedData.slice(0, 3));

  return (
    <div className="w-full h-full bg-card rounded-lg border shadow-card overflow-hidden">
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold">Sentiment Flow Throughout the Day</h3>
        <p className="text-sm text-muted-foreground">
          Average sentiment by 30-minute intervals showing the emotional journey of the day
        </p>
      </div>
      
      <div className="p-4">
        <div className="h-[500px] w-full" style={{ minHeight: '500px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={aggregatedData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <defs>
                <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                  <stop offset="50%" stopColor="#f59e0b" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.8}/>
                </linearGradient>
              </defs>
              
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              
              <XAxis 
                dataKey="time" 
                stroke="#9ca3af"
                fontSize={12}
                tickFormatter={formatXAxisLabel}
                interval={3} // Show every 4th tick (every 2 hours)
              />
              
              <YAxis 
                domain={[-2.2, 2.2]}
                stroke="#9ca3af"
                fontSize={12}
                tickFormatter={(value) => {
                  if (value === 2) return 'Very Positive (+2)';
                  if (value === 1) return 'Positive (+1)';
                  if (value === 0) return 'Neutral (0)';
                  if (value === -1) return 'Negative (-1)';
                  if (value === -2) return 'Very Negative (-2)';
                  return value.toString();
                }}
              />
              
              <Tooltip content={<CustomTooltip />} />
              
              {/* Reference lines for sentiment levels */}
              <ReferenceLine y={2} stroke="#16a34a" strokeDasharray="5 5" opacity={0.4} />
              <ReferenceLine y={1} stroke="#22c55e" strokeDasharray="5 5" opacity={0.5} />
              <ReferenceLine y={0} stroke="#f59e0b" strokeDasharray="5 5" opacity={0.5} />
              <ReferenceLine y={-1} stroke="#ef4444" strokeDasharray="5 5" opacity={0.5} />
              <ReferenceLine y={-2} stroke="#dc2626" strokeDasharray="5 5" opacity={0.4} />
              
              {/* Area under the curve for better visual flow */}
              <Area
                type="monotone"
                dataKey="avgSentiment"
                stroke="#3b82f6"
                strokeWidth={3}
                fill="url(#sentimentGradient)"
                fillOpacity={0.3}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Legend and insights */}
      <div className="p-4 border-t bg-muted/20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <h4 className="font-semibold mb-2">Sentiment Scale</h4>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-600 rounded"></div>
                <span>+2.0 (Very Positive)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>+1.0 (Positive)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                <span>0.0 (Neutral)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span>-1.0 (Negative)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-600 rounded"></div>
                <span>-2.0 (Very Negative)</span>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">Time Periods</h4>
            <div className="space-y-1 text-muted-foreground">
              <div>Morning: 6 AM - 12 PM</div>
              <div>Afternoon: 12 PM - 6 PM</div>
              <div>Evening: 6 PM - 12 AM</div>
              <div>Night: 12 AM - 6 AM</div>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">Data Summary</h4>
            <div className="space-y-1 text-muted-foreground">
              <div>Total data points: {data.length}</div>
              <div>Hours with data: {aggregatedData.filter(d => d.tweetCount > 0).length}</div>
              <div>Peak sentiment: {Math.max(...aggregatedData.map(d => d.avgSentiment)).toFixed(2)}</div>
              <div>Lowest sentiment: {Math.min(...aggregatedData.map(d => d.avgSentiment)).toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
