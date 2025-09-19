# Tweet Pulse Graph

A real-time Twitter sentiment analysis dashboard that processes tweets, analyzes sentiment, and visualizes emotional trends throughout the day.

## Features

- **Real-time Data Processing**: Fetch tweets via n8n workflows and store in Supabase
- **Sentiment Analysis**: Analyze Spanish tweets using HuggingFace models
- **Interactive Visualizations**: Beautiful line charts showing sentiment flow throughout the day
- **Data Management**: Process, filter, and analyze tweet data with progress tracking

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI Components**: shadcn/ui, Tailwind CSS
- **Charts**: Recharts for data visualization
- **Backend**: Supabase (PostgreSQL)
- **AI/ML**: HuggingFace API for sentiment analysis
- **Automation**: n8n workflows for data fetching

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- HuggingFace API key
- n8n workflow setup

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd tweet-pulse-graph
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_HUGGINGFACE_API_KEY=your_huggingface_api_key
VITE_N8N_WEBHOOK_URL=your_n8n_webhook_url
```

4. Set up the database:
Run the SQL commands in `SUPABASE_SETUP.sql` in your Supabase SQL editor.

5. Start the development server:
```bash
npm run dev
```

## Usage

### Dashboard Controls

- **📥 Extract**: Fetch new tweets via n8n webhook
- **⚙️ Process**: Analyze sentiment of raw tweets
- **📊 Graph**: Update the sentiment flow visualization
- **🔍 Debug**: Check system status and connectivity

### Data Flow

1. **Extract**: n8n workflow fetches tweets and stores in `"Extracted Uncleaned"` table
2. **Process**: Filter tweets from 2025, clean content, analyze sentiment
3. **Store**: Save processed results in `processed_tweets` table
4. **Visualize**: Display sentiment trends in interactive charts

## Database Schema

### Raw Tweets Table (`"Extracted Uncleaned"`)
- `tweet_id`: Unique identifier
- `Content`: Tweet text content
- `Date`: Tweet timestamp
- `URL`, `Likes`, `Retweets`, etc.: Engagement metrics

### Processed Tweets Table (`processed_tweets`)
- `id`: Primary key
- `original_tweet_id`: Reference to raw tweet
- `sentiment`: positive/negative/neutral
- `confidence`: Analysis confidence score
- `tweet_date`: Processed timestamp

## Sentiment Analysis

Uses the `cardiffnlp/twitter-xlm-roberta-base-sentiment` model for Spanish sentiment analysis:
- **LABEL_0**: Negative sentiment
- **LABEL_1**: Neutral sentiment  
- **LABEL_2**: Positive sentiment

## Visualization

The dashboard features:
- **Sentiment Flow Chart**: Line chart showing hourly sentiment trends
- **Time-based Analysis**: Visualize emotional patterns throughout the day
- **Interactive Tooltips**: Detailed breakdowns by hour
- **Real-time Updates**: Live data processing and visualization

## Development

### Project Structure
```
src/
├── components/
│   ├── Dashboard/
│   │   ├── SentimentFlowChart.tsx
│   │   └── DataProcessingControls.tsx
│   └── ui/           # shadcn/ui components
├── lib/
│   ├── services.ts   # API and data processing
│   ├── supabase.ts   # Database client
│   └── debug.ts      # Debug utilities
├── pages/
│   └── Index.tsx     # Main dashboard
└── data/
    └── mockData.ts   # Sample data
```

### Available Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run preview`: Preview production build
- `npm run lint`: Run ESLint

## 🚀 Deployment

### Vercel Deployment

This application is ready for deployment on Vercel. See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

**Quick Deploy:**
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy!

**Environment Variables Required:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ANTHROPIC_API_KEY`
- `VITE_HUGGINGFACE_API_KEY`
- `VITE_N8N_WEBHOOK_URL`

### Live Demo

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/tweet-pulse-graph)

## 📊 Features

### Report Export
- **PDF Generation**: Export comprehensive sentiment analysis reports
- **Top Accounts**: Most engaging accounts by keyword
- **First Tweets**: Chronologically first tweets from different accounts
- **Sentiment Extremes**: Most positive and negative tweets
- **Keyword Analysis**: Sentiment breakdown per tracked keyword

### Data Processing
- **Real-time Processing**: Live sentiment analysis with progress tracking
- **Batch Processing**: Efficient handling of large tweet datasets
- **Error Handling**: Robust error recovery and fallback mechanisms
- **Content Cleaning**: Automatic emoji removal and text normalization

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.