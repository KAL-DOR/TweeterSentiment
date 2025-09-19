export interface SentimentData {
  day: number;
  hour: number;
  positive: number;
  negative: number;
  neutral: number;
}

export interface Tweet {
  id: string;
  content: string;
  author: string;
  timestamp: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  likes: number;
  retweets: number;
  replies: number;
}

// Generate mock 3D sentiment data
export const generateMockSentimentData = (): SentimentData[] => {
  const data: SentimentData[] = [];
  
  for (let day = 1; day <= 7; day++) {
    for (let hour = 0; hour < 24; hour += 2) {
      // Simulate realistic patterns
      const isWorkingHours = hour >= 9 && hour <= 17;
      const isWeekend = day === 6 || day === 7;
      
      let basePositive = Math.random() * 3 + 1;
      let baseNegative = Math.random() * 2 + 0.5;
      let baseNeutral = Math.random() * 2 + 1;
      
      // Working hours tend to have more negative sentiment
      if (isWorkingHours && !isWeekend) {
        baseNegative *= 1.5;
        basePositive *= 0.8;
      }
      
      // Weekends tend to be more positive
      if (isWeekend) {
        basePositive *= 1.4;
        baseNegative *= 0.7;
      }
      
      data.push({
        day,
        hour,
        positive: Math.max(0.1, basePositive),
        negative: Math.max(0.1, baseNegative),
        neutral: Math.max(0.1, baseNeutral),
      });
    }
  }
  
  return data;
};

// Generate mock tweets
export const generateMockTweets = (): Tweet[] => {
  const sampleTweets = [
    {
      content: "Just launched our new product! So excited to see the community response 🚀",
      author: "@techstartup",
      sentiment: 'positive' as const,
      likes: 245,
      retweets: 67,
      replies: 23
    },
    {
      content: "Another day, another bug in production. Why does this always happen on Fridays? 😤",
      author: "@frustratedddev",
      sentiment: 'negative' as const,
      likes: 12,
      retweets: 3,
      replies: 8
    },
    {
      content: "Weather looks okay today. Might go for a walk later.",
      author: "@casualuser",
      sentiment: 'neutral' as const,
      likes: 5,
      retweets: 0,
      replies: 2
    },
    {
      content: "Amazing conference today! Learned so much about AI and machine learning. Thanks to all the speakers! 🎯",
      author: "@airesearcher",
      sentiment: 'positive' as const,
      likes: 189,
      retweets: 45,
      replies: 31
    },
    {
      content: "Traffic is absolutely terrible this morning. Already 30 minutes late to work 🚗💨",
      author: "@commuter2023",
      sentiment: 'negative' as const,
      likes: 28,
      retweets: 5,
      replies: 12
    },
    {
      content: "Coffee shop is playing jazz music today. Pretty standard Tuesday.",
      author: "@coffeelover",
      sentiment: 'neutral' as const,
      likes: 8,
      retweets: 1,
      replies: 3
    }
  ];

  return sampleTweets.map((tweet, index) => ({
    id: `tweet-${index}`,
    ...tweet,
    timestamp: `${Math.floor(Math.random() * 12) + 1}h`,
    confidence: Math.random() * 0.3 + 0.7, // 70-100% confidence
  }));
};

// Generate summary statistics
export const generateSummaryStats = () => {
  const totalTweets = 12847;
  
  return {
    positive: {
      value: Math.floor(totalTweets * 0.45),
      percentage: 12.3,
      trend: 'up' as const
    },
    negative: {
      value: Math.floor(totalTweets * 0.25),
      percentage: -5.2,
      trend: 'down' as const
    },
    neutral: {
      value: Math.floor(totalTweets * 0.30),
      percentage: 2.1,
      trend: 'up' as const
    }
  };
};