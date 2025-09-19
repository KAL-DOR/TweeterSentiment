# 🚀 Vercel Deployment Guide

This guide will help you deploy your Tweet Pulse Graph application to Vercel.

## 📋 Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Push your code to GitHub
3. **Environment Variables**: Have your API keys ready

## 🔧 Environment Variables

You'll need to set these environment variables in Vercel:

### Required Variables:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `VITE_ANTHROPIC_API_KEY` - Your Anthropic API key for Claude
- `VITE_HUGGINGFACE_API_KEY` - Your HuggingFace API key
- `VITE_N8N_WEBHOOK_URL` - Your n8n webhook URL (optional)

## 🚀 Deployment Steps

### Method 1: Deploy via Vercel Dashboard

1. **Connect GitHub Repository**:
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository

2. **Configure Project**:
   - Framework Preset: `Vite`
   - Root Directory: `./` (default)
   - Build Command: `npm run build`
   - Output Directory: `dist`

3. **Set Environment Variables**:
   - Go to Project Settings → Environment Variables
   - Add each required variable
   - Make sure to add them for Production, Preview, and Development

4. **Deploy**:
   - Click "Deploy"
   - Wait for the build to complete

### Method 2: Deploy via Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```

4. **Set Environment Variables**:
   ```bash
   vercel env add VITE_SUPABASE_URL
   vercel env add VITE_SUPABASE_ANON_KEY
   vercel env add VITE_ANTHROPIC_API_KEY
   vercel env add VITE_HUGGINGFACE_API_KEY
   vercel env add VITE_N8N_WEBHOOK_URL
   ```

5. **Redeploy with Environment Variables**:
   ```bash
   vercel --prod
   ```

## 🔍 Post-Deployment Checklist

- [ ] Application loads without errors
- [ ] Supabase connection works
- [ ] Sentiment analysis functions properly
- [ ] PDF export works
- [ ] All dashboard features are functional

## 🛠️ Troubleshooting

### Common Issues:

1. **Build Failures**:
   - Check that all dependencies are in `package.json`
   - Ensure TypeScript compilation passes
   - Verify environment variables are set

2. **Runtime Errors**:
   - Check browser console for errors
   - Verify API keys are correct
   - Ensure Supabase connection is working

3. **CORS Issues**:
   - Make sure your Supabase project allows your Vercel domain
   - Check API endpoints for CORS configuration

### Environment Variable Issues:

If you see "Missing environment variables" errors:
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add the missing variables
3. Redeploy the project

## 📊 Performance Optimization

The application is optimized for Vercel with:
- ✅ Static asset caching
- ✅ Proper build configuration
- ✅ Optimized bundle size
- ✅ CDN distribution

## 🔄 Continuous Deployment

Once connected to GitHub:
- Every push to `main` branch triggers automatic deployment
- Pull requests create preview deployments
- Environment variables are automatically available

## 📝 Notes

- **Backend Server**: The Express.js backend (`backend/` folder) is deployed as Vercel serverless functions
- **API Routes**: Backend API calls are routed through `/api/*` endpoints
- **CORS Configuration**: Backend is configured to accept requests from your Vercel domain
- **Environment Variables**: Make sure your Supabase project is configured for production use
- **Domain Configuration**: Update the CORS origin in `backend/server.js` with your actual Vercel domain

## 🆘 Support

If you encounter issues:
1. Check the Vercel deployment logs
2. Review the browser console for errors
3. Verify all environment variables are set correctly
4. Ensure your Supabase project is properly configured

---

**Happy Deploying! 🎉**
