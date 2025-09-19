const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-app.vercel.app'] // Replace with your actual Vercel domain
    : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080'],
  credentials: true
}));
app.use(express.json());

// Claude API proxy endpoint
app.post('/api/claude', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    if (!process.env.VITE_ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Anthropic API key not configured' });
    }

    console.log(`🤖 Backend: Analyzing sentiment for: "${text.substring(0, 50)}..."`);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.VITE_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: `Analyze the sentiment of this text and respond with ONLY a JSON object containing "sentiment" and "confidence" fields. The sentiment should be one of: "very_negative", "negative", "neutral", "positive", "very_positive". The confidence should be a number between 0 and 1. Any neutral sentiment with a confidence greater than 0.7 should be marked as positive.

Text: "${text}"

Respond with only the JSON object, no other text.`
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Claude API error: ${response.status} ${response.statusText}`, errorText);
      return res.status(response.status).json({ error: `Claude API error: ${response.status} ${response.statusText}` });
    }

    const result = await response.json();
    const content = result.content?.[0]?.text;

    if (!content) {
      return res.status(500).json({ error: 'No content in Claude response' });
    }

    // Parse JSON from Claude's response
    let sentimentData;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        sentimentData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.warn('Failed to parse Claude JSON response:', content);
      return res.status(500).json({ error: 'Invalid JSON response from Claude' });
    }

    const sentiment = sentimentData.sentiment;
    const confidence = sentimentData.confidence || 0.5;

    // Validate sentiment
    const validSentiments = ['very_negative', 'negative', 'neutral', 'positive', 'very_positive'];
    if (!validSentiments.includes(sentiment)) {
      console.warn(`Invalid sentiment from Claude: ${sentiment}, defaulting to neutral`);
      sentimentData.sentiment = 'neutral';
    }

    // Map sentiment to numeric value
    let sentimentValue = 0;
    switch (sentiment) {
      case 'very_negative': sentimentValue = -2; break;
      case 'negative': sentimentValue = -1; break;
      case 'neutral': sentimentValue = 0; break;
      case 'positive': sentimentValue = 1; break;
      case 'very_positive': sentimentValue = 2; break;
      default: sentimentValue = 0;
    }

    console.log(`✅ Backend: Claude analysis: ${sentiment} (${sentimentValue}) confidence: ${confidence}`);

    res.json({
      sentiment: sentiment,
      confidence: Math.round(confidence * 100) / 100,
      sentimentValue,
      label: `CLAUDE_${sentiment.toUpperCase()}`,
      score: confidence
    });

  } catch (error) {
    console.error('Backend Claude API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Export for Vercel serverless functions
module.exports = app;

// Only start server if not in Vercel environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🚀 Backend server running on port ${PORT}`);
    console.log(`📡 Claude API proxy available at http://localhost:${PORT}/api/claude`);
  });
}
