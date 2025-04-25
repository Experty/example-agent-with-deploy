import WebSocket from 'ws';
import { env } from '../config';

// configuration
const WS_URL =
  'wss://' + env.API_URL?.split('https://')?.[1]?.split('/')?.[0] + '/socket/';
const RECONNECT_INTERVAL = 10000;
const MAX_RECONNECT_ATTEMPTS = 5;

export class WebSocketService {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private messageHandlers: ((data: object) => void)[] = [];
  private isConnecting = false;
  private shouldReconnect = true;

  async connect(): Promise<void> {
    if (this.isConnecting) {
      console.log('Connection attempt already in progress');
      return;
    }

    this.isConnecting = true;
    this.shouldReconnect = true;

    try {
      await this.createWebSocketConnection();
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      this.isConnecting = false;
      if (this.shouldReconnect) {
        this.attemptReconnect();
      }
      throw error;
    }
  }

  private createWebSocketConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(WS_URL);

        const connectionTimeout = setTimeout(() => {
          if (this.socket?.readyState !== WebSocket.OPEN) {
            this.socket?.close();
            reject(new Error('Connection timeout'));
          }
        }, 10000); // 10 second timeout

        this.socket.onopen = () => {
          console.log('WebSocket connection established');
          this.reconnectAttempts = 0;
          this.isConnecting = false;
          clearTimeout(connectionTimeout);

          // Send subscription message immediately after connection
          this.send({
            type: 'subscribe',
            channel: 'agent_live_game_list',
            params: {},
          });

          resolve();
        };

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data.toString());
            this.messageHandlers.forEach((handler) => handler(data));
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          clearTimeout(connectionTimeout);
          if (this.socket?.readyState !== WebSocket.OPEN) {
            reject(error);
          }
        };

        this.socket.onclose = (event) => {
          console.log(`WebSocket connection closed (code: ${event.code})`);
          this.isConnecting = false;
          clearTimeout(connectionTimeout);
          if (this.shouldReconnect) {
            this.attemptReconnect();
          }
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  send(data: {
    type: string;
    channel: 'agent_live_game_list';
    params: Record<string, object>;
  }): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return false;
    }

    try {
      this.socket.send(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      return false;
    }
  }

  onMessage(handler: (data: object) => void): void {
    this.messageHandlers.push(handler);
  }

  removeMessageHandler(handler: (data: object) => void): void {
    this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
  }

  private attemptReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(
        `Maximum reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`
      );
      return;
    }

    this.reconnectAttempts += 1;
    console.log(
      `Attempting to reconnect (${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${RECONNECT_INTERVAL}ms...`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch((error) => {
        console.error('Reconnection attempt failed:', error);
      });
    }, RECONNECT_INTERVAL);
  }

  disconnect(): void {
    console.log('Disconnecting from WebSocket');
    this.shouldReconnect = false;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

const wsService = new WebSocketService();

process.on('SIGINT', () => {
  console.log('Process interrupted, closing WebSocket connection');
  wsService.disconnect();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Process terminated, closing WebSocket connection');
  wsService.disconnect();
  process.exit(0);
});

process.on('beforeExit', () => {
  console.log('Process exiting, closing WebSocket connection');
  wsService.disconnect();
});

export default wsService;