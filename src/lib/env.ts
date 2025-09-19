/**
 * Environment configuration
 * Centralizes environment variable handling with validation and defaults
 */

import { EnvironmentConfig } from '@/types';

// Environment variable getters with validation
function getEnvVar(name: string, defaultValue?: string): string {
  const value = import.meta.env[name] || defaultValue;
  if (!value && !defaultValue) {
    console.warn(`Environment variable ${name} is not set`);
  }
  return value || '';
}

function getRequiredEnvVar(name: string): string {
  const value = getEnvVar(name);
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

// Environment configuration
export const env: EnvironmentConfig = {
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  mode: import.meta.env.MODE || 'development',
  supabaseUrl: getRequiredEnvVar('VITE_SUPABASE_URL'),
  supabaseKey: getRequiredEnvVar('VITE_SUPABASE_ANON_KEY'),
  huggingfaceApiKey: getEnvVar('VITE_HUGGINGFACE_API_KEY'),
  anthropicApiKey: getEnvVar('VITE_ANTHROPIC_API_KEY'),
  n8nWebhookUrl: getEnvVar('VITE_N8N_WEBHOOK_URL'),
};

// Validation function
export function validateEnvironment(): void {
  const requiredVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
  ];

  const missingVars = requiredVars.filter(varName => !import.meta.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Validate Supabase URL format
  try {
    new URL(env.supabaseUrl);
  } catch {
    throw new Error('Invalid VITE_SUPABASE_URL format');
  }

  // Validate API keys if provided
  if (env.huggingfaceApiKey && env.huggingfaceApiKey.length < 10) {
    console.warn('VITE_HUGGINGFACE_API_KEY appears to be invalid (too short)');
  }

  if (env.anthropicApiKey && env.anthropicApiKey.length < 10) {
    console.warn('VITE_ANTHROPIC_API_KEY appears to be invalid (too short)');
  }

  if (env.n8nWebhookUrl) {
    try {
      new URL(env.n8nWebhookUrl);
    } catch {
      console.warn('Invalid VITE_N8N_WEBHOOK_URL format');
    }
  }
}

// Environment-specific configurations
export const isDevelopment = env.isDevelopment;
export const isProduction = env.isProduction;
export const isTest = env.mode === 'test';

// API endpoints based on environment
export const apiEndpoints = {
  claude: isProduction 
    ? '/api/claude' 
    : 'http://localhost:3001/api/claude',
  health: '/health',
  n8n: env.n8nWebhookUrl,
} as const;

// Feature flags based on environment
export const features = {
  enableDebugLogging: isDevelopment,
  enablePerformanceMonitoring: isProduction,
  enableErrorReporting: isProduction,
  enableAnalytics: isProduction,
} as const;

// Development helpers
export const devHelpers = {
  logEnv: () => {
    if (isDevelopment) {
      console.log('Environment Configuration:', {
        mode: env.mode,
        supabaseUrl: env.supabaseUrl ? 'Set' : 'Missing',
        supabaseKey: env.supabaseKey ? 'Set' : 'Missing',
        huggingfaceApiKey: env.huggingfaceApiKey ? 'Set' : 'Missing',
        anthropicApiKey: env.anthropicApiKey ? 'Set' : 'Missing',
        n8nWebhookUrl: env.n8nWebhookUrl ? 'Set' : 'Missing',
      });
    }
  },
} as const;
