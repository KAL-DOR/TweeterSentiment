# Environment Configuration

## Required Environment Variables

Create a `.env` file in the root directory with the following variables:

### Supabase Configuration
```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**How to get these:**
1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Copy the Project URL and anon/public key

### HuggingFace API Configuration
```bash
VITE_HUGGINGFACE_API_KEY=hf_your_api_key_here
```

**How to get this:**
1. Go to [HuggingFace Settings](https://huggingface.co/settings/tokens)
2. Create a new token with "Read" permissions
3. Copy the token value

**Model Used:** `UMUTeam/roberta-spanish-sentiment-analysis`
- Specifically fine-tuned for Spanish sentiment analysis
- Returns POSITIVE, NEGATIVE, or NEUTRAL classifications
- Optimized for Spanish text understanding

### n8n Webhook Configuration
```bash
VITE_N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/your-webhook-id
```

**How to get this:**
1. In your n8n workflow, add a "Webhook" trigger node
2. Configure it to accept POST requests
3. Copy the webhook URL from the node

**Note:** The n8n workflow is only used to fetch new tweets from Twitter. Sentiment analysis is performed directly in the frontend using the HuggingFace API.

## Example .env file

```bash
# Supabase
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# HuggingFace
VITE_HUGGINGFACE_API_KEY=hf_abcdEfghIjklMnopQrStuvWxYz

# n8n
VITE_N8N_WEBHOOK_URL=https://my-n8n-instance.com/webhook/12345678-1234-1234-1234-123456789012
```

## Security Notes

- Never commit your `.env` file to version control
- Use different API keys for development and production
- Regularly rotate your API keys
- Ensure your Supabase keys have appropriate Row Level Security (RLS) policies

## Testing Configuration

To test if your environment is properly configured:

1. Start the development server: `npm run dev`
2. Open the browser console
3. Check for any Supabase or API connection errors
4. Try triggering the data processing workflow from the dashboard

## Troubleshooting

### Common Issues:

1. **"Missing Supabase environment variables"**
   - Ensure your `.env` file exists in the project root
   - Check that variable names match exactly (case-sensitive)
   - Restart the development server after adding variables

2. **"HuggingFace API key not configured"**
   - Verify your API key is valid and has correct permissions
   - Check your HuggingFace account has access to the model

3. **"n8n webhook error"**
   - Verify the webhook URL is correct and accessible
   - Check that your n8n workflow is active and properly configured
   - Ensure CORS is properly configured in n8n

4. **Database connection errors**
   - Verify Supabase project is active
   - Check that the anon key has the necessary permissions
   - Ensure Row Level Security policies allow the required operations
