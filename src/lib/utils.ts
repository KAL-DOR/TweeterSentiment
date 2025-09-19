/**
 * Utility functions for common operations
 * Provides reusable functions for data manipulation, validation, and formatting
 */

import { REGEX_PATTERNS, MONTH_NUMBERS, ENGAGEMENT_WEIGHTS, SENTIMENT_CONFIG } from './constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Parse tweet date from various formats to ISO string
 */
export function parseTweetDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  
  try {
    const trimmedDate = dateStr.trim();
    
    // Handle format: "October 29, 2015 at 05:59 AM"
    if (trimmedDate.includes('at') && (trimmedDate.includes('AM') || trimmedDate.includes('PM'))) {
      const match = trimmedDate.match(REGEX_PATTERNS.DATE_WITH_TIME);
      if (match) {
        const [, monthName, day, year, hour, minute, ampm] = match;
        const monthNum = getMonthNumber(monthName);
        if (monthNum) {
          // Convert to 24-hour format
          let hour24 = parseInt(hour);
          if (ampm.toUpperCase() === 'PM' && hour24 !== 12) {
            hour24 += 12;
          } else if (ampm.toUpperCase() === 'AM' && hour24 === 12) {
            hour24 = 0;
          }
          
          const isoString = `${year}-${monthNum}-${day.padStart(2, '0')}T${hour24.toString().padStart(2, '0')}:${minute.padStart(2, '0')}:00.000Z`;
          const parsedDate = new Date(isoString);
          
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString();
          }
        }
      }
    }
    
    // Try direct parsing for other formats
    const parsedDate = new Date(trimmedDate);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString();
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Get month number from month name
 */
export function getMonthNumber(monthName: string): string | null {
  return MONTH_NUMBERS[monthName.toLowerCase()] || null;
}

/**
 * Extract username from Twitter URL
 */
export function extractUsernameFromUrl(url: string): string {
  if (!url) return 'Unknown';
  
  try {
    const match = url.match(REGEX_PATTERNS.TWITTER_URL);
    return match ? match[1] : 'Unknown';
  } catch (error) {
    return 'Unknown';
  }
}

/**
 * Calculate total engagement for a tweet
 */
export function calculateEngagement(tweet: {
  Likes?: string;
  Retweets?: string;
  Replies?: string;
  Views?: string;
}): number {
  const likes = parseInt(tweet.Likes?.replace(REGEX_PATTERNS.NUMBERS_ONLY, '') || '0');
  const retweets = parseInt(tweet.Retweets?.replace(REGEX_PATTERNS.NUMBERS_ONLY, '') || '0');
  const replies = parseInt(tweet.Replies?.replace(REGEX_PATTERNS.NUMBERS_ONLY, '') || '0');
  const views = parseInt(tweet.Views?.replace(REGEX_PATTERNS.NUMBERS_ONLY, '') || '0');
  
  return (
    likes * ENGAGEMENT_WEIGHTS.LIKES +
    retweets * ENGAGEMENT_WEIGHTS.RETWEETS +
    replies * ENGAGEMENT_WEIGHTS.REPLIES +
    views * ENGAGEMENT_WEIGHTS.VIEWS
  );
}

/**
 * Clean text for PDF by removing emojis and limiting to first 10 words
 */
export function cleanTextForPDF(text: string): string {
  if (!text) return '';
  
  // Remove emojis and special characters that cause PDF issues
  const cleaned = text
    .replace(REGEX_PATTERNS.EMOJI, '') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Regional indicator symbols
    .replace(/[\u{2600}-\u{26FF}]/gu, '') // Miscellaneous symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '') // Dingbats
    .replace(/[^\x00-\x7F]/g, '') // Remove any remaining non-ASCII characters
    .replace(REGEX_PATTERNS.WHITESPACE, ' ') // Normalize whitespace
    .trim();
  
  // Get first 10 words
  const words = cleaned.split(' ').slice(0, 10);
  return words.join(' ');
}

/**
 * Clean and prepare tweet content for analysis
 */
export function cleanTweetContent(content: string): string {
  if (!content) return '';

  return content
    .trim()
    .replace(REGEX_PATTERNS.WHITESPACE, ' ') // Remove excessive whitespace
    .replace(REGEX_PATTERNS.URL, '') // Remove URLs
    .replace(REGEX_PATTERNS.MENTION, '') // Remove mentions
    .replace(REGEX_PATTERNS.HASHTAG, '') // Remove hashtags symbols but keep the text
    .replace(REGEX_PATTERNS.EXCESSIVE_PUNCTUATION, '.') // Remove extra punctuation
    .substring(0, 500) // Limit length for API
    .trim();
}

/**
 * Map sentiment to numeric value
 */
export function getSentimentValue(sentiment: string): number {
  switch (sentiment) {
    case 'very_negative':
      return SENTIMENT_CONFIG.LEVELS.VERY_NEGATIVE;
    case 'negative':
      return SENTIMENT_CONFIG.LEVELS.NEGATIVE;
    case 'neutral':
      return SENTIMENT_CONFIG.LEVELS.NEUTRAL;
    case 'positive':
      return SENTIMENT_CONFIG.LEVELS.POSITIVE;
    case 'very_positive':
      return SENTIMENT_CONFIG.LEVELS.VERY_POSITIVE;
    default:
      return SENTIMENT_CONFIG.LEVELS.NEUTRAL;
  }
}

/**
 * Format number with locale-specific formatting
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Format date for display
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString();
}

/**
 * Format date and time for display
 */
export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

/**
 * Debounce function to limit function calls
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Throttle function to limit function calls
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  };
}

/**
 * Sleep function for delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
  
  throw lastError!;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a random ID
 */
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }
  
  if (typeof obj === 'object') {
    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  
  return obj;
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array, empty object)
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  
  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }
  
  return false;
}

/**
 * Capitalize first letter of a string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert string to kebab-case
 */
export function kebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Convert string to camelCase
 */
export function camelCase(str: string): string {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, '');
}

/**
 * Utility function for combining class names
 * This is used by the UI components
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}