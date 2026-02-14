import { getToken } from "./auth";

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  citations?: { text: string; document: string; page?: number }[];
  thinking_steps?: {
    tool: string;
    status: string;
    result_summary?: string;
  }[];
  timestamp: string;
  streaming?: boolean;
}

type MessageHandler = (message: ChatMessage) => void;
type StreamHandler = (chunk: { message_id: string; content: string; done: boolean }) => void;
type ThinkingHandler = (step: { tool: string; content: string }) => void;
type StatusHandler = (status: "connected" | "disconnected" | "reconnecting") => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private baseUrl: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers: MessageHandler[] = [];
  private streamHandlers: StreamHandler[] = [];
  private thinkingHandlers: ThinkingHandler[] = [];
  private statusHandlers: StatusHandler[] = [];

  constructor(baseUrl?: string) {
    if (baseUrl) {
      this.baseUrl = baseUrl;
    } else if (window.location.protocol === "https:") {
      // Production: nginx proxies WebSocket to backend
      this.baseUrl = `wss://${window.location.host}/api/chat/ws`;
    } else {
      // Dev: connect to backend directly (Next.js rewrites don't support WebSocket)
      this.baseUrl = `ws://${window.location.hostname}:8000/api/chat/ws`;
    }
  }

  connect(): void {
    const token = getToken();
    if (!token) {
      this.notifyStatus("disconnected");
      return;
    }

    const url = `${this.baseUrl}?token=${encodeURIComponent(token)}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.notifyStatus("connected");
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "stream") {
            this.streamHandlers.forEach((handler) =>
              handler({
                message_id: data.message_id,
                content: data.content,
                done: data.done || false,
              })
            );
          } else if (data.type === "thinking") {
            this.thinkingHandlers.forEach((handler) =>
              handler({ tool: data.tool, content: data.content })
            );
          } else if (data.type === "message") {
            this.messageHandlers.forEach((handler) => handler(data.message));
          }
        } catch {
          // Non-JSON message, ignore
        }
      };

      this.ws.onclose = () => {
        this.notifyStatus("disconnected");
        this.attemptReconnect();
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch {
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    this.reconnectAttempts++;
    this.notifyStatus("reconnecting");

    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  private notifyStatus(status: "connected" | "disconnected" | "reconnecting"): void {
    this.statusHandlers.forEach((handler) => handler(status));
  }

  send(message: string, documentIds?: string[], retry?: boolean): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          content: message,
          document_ids: documentIds || [],
          retry: retry || false,
        })
      );
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
    };
  }

  onStream(handler: StreamHandler): () => void {
    this.streamHandlers.push(handler);
    return () => {
      this.streamHandlers = this.streamHandlers.filter((h) => h !== handler);
    };
  }

  onThinking(handler: ThinkingHandler): () => void {
    this.thinkingHandlers.push(handler);
    return () => {
      this.thinkingHandlers = this.thinkingHandlers.filter((h) => h !== handler);
    };
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.push(handler);
    return () => {
      this.statusHandlers = this.statusHandlers.filter((h) => h !== handler);
    };
  }

  disconnect(): void {
    this.maxReconnectAttempts = 0;
    this.ws?.close();
    this.ws = null;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
