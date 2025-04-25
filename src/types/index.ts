export interface OHLCV {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }
  
  export interface GameData {
    id: string;
    data: {
      quoteAsset: string;
      token: {
        baseAsset: string;
      };
    };
  }
  
  export interface WebSocketMessage {
    data: GameData;
    type: string;
  }
  
  export interface GameResponse {
    data: {
      quoteAsset: string;
      token: {
        baseAsset: string;
      };
    };
  }