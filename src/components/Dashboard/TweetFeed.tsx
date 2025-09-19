import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Repeat } from 'lucide-react';

interface Tweet {
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

interface TweetFeedProps {
  tweets: Tweet[];
}

export const TweetFeed: React.FC<TweetFeedProps> = ({ tweets }) => {
  const getSentimentBadge = (sentiment: Tweet['sentiment'], confidence: number) => {
    const baseClasses = "text-xs";
    
    switch (sentiment) {
      case 'positive':
        return <Badge variant="default" className={`${baseClasses} bg-positive text-positive-foreground`}>
          Positive ({Math.round(confidence * 100)}%)
        </Badge>;
      case 'negative':
        return <Badge variant="default" className={`${baseClasses} bg-negative text-negative-foreground`}>
          Negative ({Math.round(confidence * 100)}%)
        </Badge>;
      default:
        return <Badge variant="default" className={`${baseClasses} bg-neutral text-neutral-foreground`}>
          Neutral ({Math.round(confidence * 100)}%)
        </Badge>;
    }
  };

  return (
    <Card className="gradient-card border shadow-card h-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Recent Tweets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-h-96 overflow-y-auto">
        {tweets.map((tweet) => (
          <div
            key={tweet.id}
            className="p-4 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{tweet.author}</span>
                  <span className="text-xs text-muted-foreground">{tweet.timestamp}</span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{tweet.content}</p>
              </div>
            </div>
            
            <div className="flex justify-between items-center mt-3">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Heart className="h-3 w-3" />
                  <span>{tweet.likes}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Repeat className="h-3 w-3" />
                  <span>{tweet.retweets}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" />
                  <span>{tweet.replies}</span>
                </div>
              </div>
              
              {getSentimentBadge(tweet.sentiment, tweet.confidence)}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};