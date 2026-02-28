// ── Types ──────────────────────────────────────────────────────────

interface Env {
  DB: D1Database;
  SCHEDULE: KVNamespace;
  GAME_BUNDLES: R2Bucket;
  GAME_ROOM: DurableObjectNamespace;
}

interface RoomPlayer {
  id: string;
  ready: boolean;
  connectedAt: number;
}

interface RoomMessage {
  type: string;
  payload: unknown;
  playerId: string;
  timestamp: number;
}

interface RoomState {
  gameId: string | null;
  players: Map<string, RoomPlayer>;
  started: boolean;
  startTime: number | null;
  maxPlayers: number;
  maxDurationMs: number;
}

// Default max game duration: 5 minutes
const DEFAULT_MAX_DURATION_MS = 5 * 60 * 1000;
const DEFAULT_MAX_PLAYERS = 4;

// ── GameRoom Durable Object ────────────────────────────────────────

export class GameRoom implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private room: RoomState;
  private playerSockets: Map<string, WebSocket>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.playerSockets = new Map();
    this.room = {
      gameId: null,
      players: new Map(),
      started: false,
      startTime: null,
      maxPlayers: DEFAULT_MAX_PLAYERS,
      maxDurationMs: DEFAULT_MAX_DURATION_MS,
    };

    // Restore hibernated websocket connections
    this.state.getWebSockets().forEach((ws) => {
      const meta = ws.deserializeAttachment() as {
        playerId: string;
        gameId: string;
      } | null;
      if (meta?.playerId) {
        this.playerSockets.set(meta.playerId, ws);
        this.room.players.set(meta.playerId, {
          id: meta.playerId,
          ready: false,
          connectedAt: Date.now(),
        });
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      return this.handleWebSocket(request, url);
    }

    return new Response("Not found", { status: 404 });
  }

  private handleWebSocket(request: Request, url: URL): Response {
    const playerId = url.searchParams.get("player_id");
    const gameId = url.searchParams.get("game_id");

    if (!playerId || !gameId) {
      return new Response("player_id and game_id required", { status: 400 });
    }

    // Check room capacity
    if (
      this.room.players.size >= this.room.maxPlayers &&
      !this.room.players.has(playerId)
    ) {
      return new Response("Room is full", { status: 409 });
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    // Accept with hibernation
    this.state.acceptWebSocket(server);

    // Attach metadata for hibernation recovery
    server.serializeAttachment({ playerId, gameId });

    // Set game ID if not set
    if (!this.room.gameId) {
      this.room.gameId = gameId;
    }

    // Add player
    this.room.players.set(playerId, {
      id: playerId,
      ready: false,
      connectedAt: Date.now(),
    });
    this.playerSockets.set(playerId, server);

    // Notify others about new player
    this.broadcast(
      {
        type: "player-joined",
        payload: {
          playerId,
          playerCount: this.room.players.size,
          maxPlayers: this.room.maxPlayers,
        },
        playerId: "system",
        timestamp: Date.now(),
      },
      playerId
    );

    // Send room state to the joining player
    this.sendTo(playerId, {
      type: "room-state",
      payload: {
        gameId: this.room.gameId,
        players: Array.from(this.room.players.values()).map((p) => ({
          id: p.id,
          ready: p.ready,
        })),
        started: this.room.started,
        maxPlayers: this.room.maxPlayers,
      },
      playerId: "system",
      timestamp: Date.now(),
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(
    ws: WebSocket,
    rawMessage: string | ArrayBuffer
  ): Promise<void> {
    const meta = ws.deserializeAttachment() as {
      playerId: string;
      gameId: string;
    } | null;

    if (!meta?.playerId) {
      ws.close(1008, "No player identity");
      return;
    }

    const playerId = meta.playerId;
    let message: RoomMessage;

    try {
      const text =
        typeof rawMessage === "string"
          ? rawMessage
          : new TextDecoder().decode(rawMessage);
      message = JSON.parse(text) as RoomMessage;
    } catch {
      this.sendTo(playerId, {
        type: "error",
        payload: { message: "Invalid message format" },
        playerId: "system",
        timestamp: Date.now(),
      });
      return;
    }

    switch (message.type) {
      case "ready":
        this.handleReady(playerId);
        break;

      case "move":
        this.handleMove(playerId, message);
        break;

      case "ping":
        this.sendTo(playerId, {
          type: "pong",
          payload: null,
          playerId: "system",
          timestamp: Date.now(),
        });
        break;

      default:
        // Forward unknown message types as-is for game-specific logic
        this.broadcast(
          {
            ...message,
            playerId,
            timestamp: Date.now(),
          },
          playerId
        );
    }
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    _reason: string,
    _wasClean: boolean
  ): Promise<void> {
    const meta = ws.deserializeAttachment() as {
      playerId: string;
    } | null;

    if (meta?.playerId) {
      this.removePlayer(meta.playerId);
    }
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    const meta = ws.deserializeAttachment() as {
      playerId: string;
    } | null;

    if (meta?.playerId) {
      this.removePlayer(meta.playerId);
    }
  }

  async alarm(): Promise<void> {
    // Game timeout - notify all players and close
    this.broadcast(
      {
        type: "game-timeout",
        payload: {
          message: "Game duration exceeded. Room closing.",
          duration_ms: this.room.maxDurationMs,
        },
        playerId: "system",
        timestamp: Date.now(),
      }
    );

    // Close all connections
    for (const [playerId, ws] of this.playerSockets) {
      try {
        ws.close(1000, "Game timeout");
      } catch {
        // Socket may already be closed
      }
      this.room.players.delete(playerId);
    }
    this.playerSockets.clear();
  }

  // ── Internal Methods ─────────────────────────────────────────────

  private handleReady(playerId: string): void {
    const player = this.room.players.get(playerId);
    if (!player) return;

    player.ready = true;

    this.broadcast({
      type: "player-ready",
      payload: { playerId },
      playerId: "system",
      timestamp: Date.now(),
    });

    // Check if all players are ready
    const allReady =
      this.room.players.size >= 2 &&
      Array.from(this.room.players.values()).every((p) => p.ready);

    if (allReady && !this.room.started) {
      this.startGame();
    }
  }

  private handleMove(playerId: string, message: RoomMessage): void {
    if (!this.room.started) {
      this.sendTo(playerId, {
        type: "error",
        payload: { message: "Game has not started yet" },
        playerId: "system",
        timestamp: Date.now(),
      });
      return;
    }

    // Broadcast move to all other players
    this.broadcast(
      {
        type: "move",
        payload: message.payload,
        playerId,
        timestamp: Date.now(),
      },
      playerId
    );
  }

  private startGame(): void {
    this.room.started = true;
    this.room.startTime = Date.now();

    this.broadcast({
      type: "game-start",
      payload: {
        startTime: this.room.startTime,
        players: Array.from(this.room.players.values()).map((p) => ({
          id: p.id,
        })),
        maxDurationMs: this.room.maxDurationMs,
      },
      playerId: "system",
      timestamp: Date.now(),
    });

    // Set alarm for game timeout
    this.state.storage.setAlarm(Date.now() + this.room.maxDurationMs);
  }

  private removePlayer(playerId: string): void {
    this.room.players.delete(playerId);
    this.playerSockets.delete(playerId);

    this.broadcast({
      type: "player-left",
      payload: {
        playerId,
        playerCount: this.room.players.size,
      },
      playerId: "system",
      timestamp: Date.now(),
    });

    // If room is empty, cancel any alarm
    if (this.room.players.size === 0) {
      this.state.storage.deleteAlarm();
    }
  }

  private broadcast(message: RoomMessage, excludePlayerId?: string): void {
    const data = JSON.stringify(message);

    for (const [playerId, ws] of this.playerSockets) {
      if (playerId === excludePlayerId) continue;
      try {
        ws.send(data);
      } catch {
        // Socket closed, will be cleaned up in webSocketClose
      }
    }
  }

  private sendTo(playerId: string, message: RoomMessage): void {
    const ws = this.playerSockets.get(playerId);
    if (!ws) return;

    try {
      ws.send(JSON.stringify(message));
    } catch {
      // Socket closed
    }
  }
}
