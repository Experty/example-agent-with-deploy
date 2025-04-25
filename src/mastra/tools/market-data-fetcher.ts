import { createTool } from "@mastra/core";
import { marketDataService } from "../../services/market-data";
import { z } from "zod";

export const marketDataFetcher = createTool({
    id: 'Market Data Fetcher',
    description: 'Fetches OHLCV market data for a given trading pair',
    inputSchema: z.object({
      symbol: z
        .string()
        .describe(
          'Trading pair symbol in format baseAssetquoteAsset (e.g., BTCUSDT, SOLUSDT)'
        ),
    }),
    execute: async ({ context: { symbol } }) => {
      console.log('Fetching market data for:', symbol);
      try {
        const data = await marketDataService.getOHLCV(symbol);
        return {
          status: 'success',
          data: {
            ohlcv: data,
            metadata: {
              symbol,
              interval: '15m',
              dataPoints: data.length,
              timestamp: new Date().toISOString(),
            },
          },
        };
      } catch (error) {
        return {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  });