import axios from 'axios';
import { OHLCV } from '../types';

// Rate limiting configuration
const RATE_LIMIT = {
  MAX_REQUESTS_PER_MINUTE: 30,
  COOLDOWN_MS: 60000, // 1 minute cooldown after hitting limit
};

// Type for Binance kline data
type BinanceKline = [number, string, string, string, string, string, ...any[]];

export class MarketDataService {
  private cache: Map<string, OHLCV[]> = new Map();
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes cache - much longer to prevent rate limiting
  private lastFetched: Map<string, number> = new Map();
  private pendingRequests: Map<string, Promise<OHLCV[]>> = new Map();

  // Rate limiting tracking
  private requestTimestamps: number[] = [];
  private isThrottled: boolean = false;
  private throttledUntil: number = 0;

  constructor(private readonly interval: string = '1m') {}

  public async getOHLCV(symbol: string): Promise<OHLCV[]> {
    const now = Date.now();
    const last = this.lastFetched.get(symbol) || 0;

    // Check cache first - use longer TTL to prevent rate limiting
    if (now - last < this.cacheTTL && this.cache.has(symbol)) {
      console.log('Returning cached OHLCV for:', symbol);
      return this.cache.get(symbol)!;
    }

    // If there's already a pending request for this symbol, return that promise
    if (this.pendingRequests.has(symbol)) {
      console.log('Returning pending request for:', symbol);
      return this.pendingRequests.get(symbol)!;
    }

    // Check if we're throttled
    if (this.isThrottled) {
      const waitTime = this.throttledUntil - now;
      if (waitTime > 0) {
        console.log(`Rate limited, waiting ${waitTime}ms before next request`);

        // If we have cached data, return it even if it's stale
        if (this.cache.has(symbol)) {
          console.log('Returning stale cached data due to rate limiting');
          return this.cache.get(symbol)!;
        }

        // Otherwise, wait for the cooldown period
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        // Reset throttling after waiting
        this.isThrottled = false;
      }
    }

    // Check if we've hit the rate limit
    this.cleanupOldRequests(now);
    if (this.requestTimestamps.length >= RATE_LIMIT.MAX_REQUESTS_PER_MINUTE) {
      console.log('Rate limit reached, entering cooldown mode');
      this.isThrottled = true;
      this.throttledUntil = now + RATE_LIMIT.COOLDOWN_MS;

      // If we have cached data, return it even if it's stale
      if (this.cache.has(symbol)) {
        console.log('Returning stale cached data due to rate limiting');
        return this.cache.get(symbol)!;
      }

      // Wait for the cooldown period
      await new Promise((resolve) =>
        setTimeout(resolve, RATE_LIMIT.COOLDOWN_MS)
      );
      this.isThrottled = false;
      this.requestTimestamps = [];
    }

    const requestPromise = this.fetchOHLCV(symbol)
      .then((data) => {
        this.cache.set(symbol, data);
        this.lastFetched.set(symbol, Date.now());
        this.pendingRequests.delete(symbol);
        return data;
      })
      .catch((error) => {
        this.pendingRequests.delete(symbol);

        // Check if this is a rate limit error (429)
        if (error.response?.status === 429) {
          console.log('Received 429 rate limit error, entering cooldown mode');
          this.isThrottled = true;
          this.throttledUntil = Date.now() + RATE_LIMIT.COOLDOWN_MS;

          // Return cached data if available
          if (this.cache.has(symbol)) {
            console.log('Returning stale cached data due to rate limiting');
            return this.cache.get(symbol)!;
          }
        }

        throw error;
      });

    // Track this request for rate limiting
    this.requestTimestamps.push(Date.now());
    this.pendingRequests.set(symbol, requestPromise);
    return requestPromise;
  }

  // Remove timestamps older than 1 minute to track rate limiting window
  private cleanupOldRequests(now: number): void {
    const oneMinuteAgo = now - 60000;
    this.requestTimestamps = this.requestTimestamps.filter(
      (timestamp) => timestamp > oneMinuteAgo
    );
  }

  private async fetchOHLCV(symbol: string): Promise<OHLCV[]> {
    try {
      console.log('Fetching OHLCV for:', symbol);
      const formattedSymbol = symbol.replace('/', '').toUpperCase();

      const res = await axios.get<BinanceKline[]>(
        `https://api.binance.com/api/v3/klines`,
        {
          params: {
            symbol: formattedSymbol,
            interval: this.interval,
            limit: 100,
          },
        }
      );
      if (res.data.length === 0) {
        console.log('No data found for:', symbol);
        return [];
      }

      console.log('Fetched OHLCV for:', symbol, 'close:', res.data?.[0]?.[4]);

      return res.data.map(
        (d: BinanceKline) => ({
          timestamp: d[0],
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
          volume: parseFloat(d[5]),
        })
      );
    } catch (error) {
      console.error(`Failed to fetch data for ${symbol}:`, error);
      throw error; // Re-throw to handle in the calling function
    }
  }
}

export const marketDataService = new MarketDataService('15m');