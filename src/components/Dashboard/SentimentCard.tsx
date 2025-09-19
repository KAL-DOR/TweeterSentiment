import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SentimentCardProps {
  title: string;
  value: number;
  percentage: number;
  trend: 'up' | 'down' | 'neutral';
  type: 'positive' | 'negative' | 'neutral';
}

export const SentimentCard: React.FC<SentimentCardProps> = ({
  title,
  value,
  percentage,
  trend,
  type
}) => {
  const getIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4" />;
      case 'down':
        return <TrendingDown className="h-4 w-4" />;
      default:
        return <Minus className="h-4 w-4" />;
    }
  };

  const getColorClasses = () => {
    switch (type) {
      case 'positive':
        return 'text-positive border-positive/20 bg-positive/5';
      case 'negative':
        return 'text-negative border-negative/20 bg-negative/5';
      default:
        return 'text-neutral border-neutral/20 bg-neutral/5';
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-positive';
      case 'down':
        return 'text-negative';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <Card className="gradient-card border shadow-card hover:shadow-lg transition-all duration-300">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`p-2 rounded-full ${getColorClasses()}`}>
          {getIcon()}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value.toLocaleString()}</div>
        <div className={`text-xs flex items-center gap-1 mt-1 ${getTrendColor()}`}>
          <span>{percentage > 0 ? '+' : ''}{percentage}%</span>
          <span className="text-muted-foreground">from last week</span>
        </div>
      </CardContent>
    </Card>
  );
};