import { Hono } from "hono";
import { cors } from "hono/cors";
import { GameRoom } from "./game-room";
import { findOrCreateRoom } from "./matchmaking";

// ── Types ──────────────────────────────────────────────────────────

export interface Env {
  DB: D1Database;
  SCHEDULE: KVNamespace;
  GAME_BUNDLES: R2Bucket;
  GAME_ROOM: DurableObjectNamespace;
}

interface Player {
  id: string;
  display_name: string;
  avatar_url: string | null;
  total_xp: number;
  streak: number;
  last_played_date: string | null;
  games_played: number;
  games_won: number;
  created_at: string;
  updated_at: string;
}

interface GameResult {
  id: string;
  player_id: string;
  game_id: string;
  game_date: string;
  score: number;
  placement: number | null;
  xp_earned: number;
  duration_ms: number | null;
  created_at: string;
}

interface ScoreSubmission {
  player_id: string;
  game_id: string;
  score: number;
  game_date: string;
  placement?: number;
  duration_ms?: number;
}

interface GameManifest {
  game_id: string;
  name: string;
  bundle_url: string;
  max_players: number;
  max_duration_ms: number;
  date: string;
}

interface LeaderboardEntry {
  player_id: string;
  display_name: string;
  avatar_url: string | null;
  best_score: number;
  rank: number;
}

interface Trophy {
  id: string;
  name: string;
  description: string;
  icon: string;
  criteria_type: string;
  criteria_value: number;
}

interface PlayerTrophy {
  trophy_id: string;
  name: string;
  description: string;
  icon: string;
  earned_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────

function todayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

function yesterdayDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

function generateId(): string {
  return crypto.randomUUID();
}

function calculateXP(
  score: number,
  placement: number | null,
  streak: number,
  isFirstGameToday: boolean
): number {
  const baseXP = 10;
  const scoreBonus = Math.min(Math.floor(score / 10), 50);
  const winBonus = placement === 1 ? 25 : 0;
  const streakBonus = Math.min(streak * 2, 20);
  const dailyFirstBonus = isFirstGameToday ? 15 : 0;

  return baseXP + scoreBonus + winBonus + streakBonus + dailyFirstBonus;
}

function updateStreak(
  lastPlayedDate: string | null,
  currentStreak: number,
  today: string
): number {
  if (lastPlayedDate === today) {
    return currentStreak;
  }
  if (lastPlayedDate === yesterdayDateString()) {
    return currentStreak + 1;
  }
  return 1;
}

// ── Trophy Checking ────────────────────────────────────────────────

async function checkAndAwardTrophies(
  db: D1Database,
  playerId: string,
  player: Player
): Promise<PlayerTrophy[]> {
  const trophies = await db
    .prepare("SELECT * FROM trophies")
    .all<Trophy>();

  if (!trophies.results) return [];

  const existingTrophies = await db
    .prepare("SELECT trophy_id FROM player_trophies WHERE player_id = ?")
    .bind(playerId)
    .all<{ trophy_id: string }>();

  const existingSet = new Set(
    existingTrophies.results?.map((t) => t.trophy_id) ?? []
  );

  const newlyEarned: PlayerTrophy[] = [];

  for (const trophy of trophies.results) {
    if (existingSet.has(trophy.id)) continue;

    let earned = false;

    switch (trophy.criteria_type) {
      case "wins":
        earned = player.games_won >= trophy.criteria_value;
        break;
      case "streak":
        earned = player.streak >= trophy.criteria_value;
        break;
      case "games_played":
        earned = player.games_played >= trophy.criteria_value;
        break;
      case "total_xp":
        earned = player.total_xp >= trophy.criteria_value;
        break;
    }

    if (earned) {
      await db
        .prepare(
          "INSERT OR IGNORE INTO player_trophies (player_id, trophy_id) VALUES (?, ?)"
        )
        .bind(playerId, trophy.id)
        .run();

      newlyEarned.push({
        trophy_id: trophy.id,
        name: trophy.name,
        description: trophy.description,
        icon: trophy.icon,
        earned_at: new Date().toISOString(),
      });
    }
  }

  return newlyEarned;
}

// ── App ────────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: Env }>();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  })
);

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Schedule Routes ────────────────────────────────────────────────

app.get("/api/schedule", async (c) => {
  const today = todayDateString();
  const manifest = await c.env.SCHEDULE.get(`schedule:${today}`, "json");

  if (!manifest) {
    return c.json({ error: "No game scheduled for today" }, 404);
  }

  return c.json(manifest);
});

app.get("/api/schedule/:date", async (c) => {
  const date = c.req.param("date");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: "Invalid date format. Use YYYY-MM-DD" }, 400);
  }

  const manifest = await c.env.SCHEDULE.get(`schedule:${date}`, "json");

  if (!manifest) {
    return c.json({ error: `No game scheduled for ${date}` }, 404);
  }

  return c.json(manifest);
});

// ── Score Submission ───────────────────────────────────────────────

app.post("/api/scores", async (c) => {
  let body: ScoreSubmission;
  try {
    body = await c.req.json<ScoreSubmission>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { player_id, game_id, score, game_date, placement, duration_ms } =
    body;

  if (!player_id || !game_id || score === undefined || !game_date) {
    return c.json(
      { error: "Missing required fields: player_id, game_id, score, game_date" },
      400
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(game_date)) {
    return c.json({ error: "Invalid game_date format. Use YYYY-MM-DD" }, 400);
  }

  const db = c.env.DB;

  // Fetch player
  const player = await db
    .prepare("SELECT * FROM players WHERE id = ?")
    .bind(player_id)
    .first<Player>();

  if (!player) {
    return c.json({ error: "Player not found" }, 404);
  }

  const today = todayDateString();

  // Check if this is the first game today
  const todayGames = await db
    .prepare(
      "SELECT COUNT(*) as count FROM game_results WHERE player_id = ? AND game_date = ?"
    )
    .bind(player_id, game_date)
    .first<{ count: number }>();

  const isFirstGameToday = (todayGames?.count ?? 0) === 0;

  // Calculate streak
  const newStreak = updateStreak(
    player.last_played_date,
    player.streak,
    today
  );

  // Calculate XP
  const xpEarned = calculateXP(
    score,
    placement ?? null,
    newStreak,
    isFirstGameToday
  );

  const resultId = generateId();

  // Insert game result
  await db
    .prepare(
      `INSERT INTO game_results (id, player_id, game_id, game_date, score, placement, xp_earned, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      resultId,
      player_id,
      game_id,
      game_date,
      score,
      placement ?? null,
      xpEarned,
      duration_ms ?? null
    )
    .run();

  // Update player stats
  const newTotalXP = player.total_xp + xpEarned;
  const newGamesPlayed = player.games_played + 1;
  const newGamesWon = placement === 1 ? player.games_won + 1 : player.games_won;

  await db
    .prepare(
      `UPDATE players
       SET total_xp = ?, streak = ?, last_played_date = ?,
           games_played = ?, games_won = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(newTotalXP, newStreak, today, newGamesPlayed, newGamesWon, player_id)
    .run();

  // Update leaderboard
  const existingEntry = await db
    .prepare(
      "SELECT best_score FROM daily_leaderboard WHERE game_date = ? AND player_id = ?"
    )
    .bind(game_date, player_id)
    .first<{ best_score: number }>();

  if (!existingEntry || score > existingEntry.best_score) {
    await db
      .prepare(
        `INSERT INTO daily_leaderboard (game_date, player_id, best_score)
         VALUES (?, ?, ?)
         ON CONFLICT(game_date, player_id)
         DO UPDATE SET best_score = excluded.best_score`
      )
      .bind(game_date, player_id, score)
      .run();

    // Recompute ranks for this date
    await db
      .prepare(
        `UPDATE daily_leaderboard
         SET rank = (
           SELECT COUNT(*) + 1
           FROM daily_leaderboard AS lb2
           WHERE lb2.game_date = daily_leaderboard.game_date
             AND lb2.best_score > daily_leaderboard.best_score
         )
         WHERE game_date = ?`
      )
      .bind(game_date)
      .run();
  }

  // Check trophies with updated player state
  const updatedPlayer: Player = {
    ...player,
    total_xp: newTotalXP,
    streak: newStreak,
    games_played: newGamesPlayed,
    games_won: newGamesWon,
    last_played_date: today,
  };

  const newTrophies = await checkAndAwardTrophies(
    db,
    player_id,
    updatedPlayer
  );

  return c.json({
    result_id: resultId,
    xp_earned: xpEarned,
    total_xp: newTotalXP,
    streak: newStreak,
    new_trophies: newTrophies,
  });
});

// ── Leaderboard ────────────────────────────────────────────────────

app.get("/api/leaderboard/:date", async (c) => {
  const date = c.req.param("date");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: "Invalid date format. Use YYYY-MM-DD" }, 400);
  }

  const db = c.env.DB;

  const entries = await db
    .prepare(
      `SELECT lb.player_id, p.display_name, p.avatar_url, lb.best_score, lb.rank
       FROM daily_leaderboard lb
       JOIN players p ON p.id = lb.player_id
       WHERE lb.game_date = ?
       ORDER BY lb.best_score DESC
       LIMIT 100`
    )
    .bind(date)
    .all<LeaderboardEntry>();

  return c.json({
    date,
    entries: entries.results ?? [],
  });
});

// ── Player Routes ──────────────────────────────────────────────────

app.get("/api/players/:id", async (c) => {
  const playerId = c.req.param("id");
  const db = c.env.DB;

  const player = await db
    .prepare("SELECT * FROM players WHERE id = ?")
    .bind(playerId)
    .first<Player>();

  if (!player) {
    return c.json({ error: "Player not found" }, 404);
  }

  const trophies = await db
    .prepare(
      `SELECT t.id as trophy_id, t.name, t.description, t.icon, pt.earned_at
       FROM player_trophies pt
       JOIN trophies t ON t.id = pt.trophy_id
       WHERE pt.player_id = ?
       ORDER BY pt.earned_at DESC`
    )
    .bind(playerId)
    .all<PlayerTrophy>();

  return c.json({
    ...player,
    trophies: trophies.results ?? [],
  });
});

app.post("/api/players", async (c) => {
  let body: { id?: string; display_name: string; avatar_url?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { display_name, avatar_url } = body;

  if (!display_name) {
    return c.json({ error: "display_name is required" }, 400);
  }

  const db = c.env.DB;
  const playerId = body.id ?? generateId();

  // Upsert player
  const existing = await db
    .prepare("SELECT id FROM players WHERE id = ?")
    .bind(playerId)
    .first();

  if (existing) {
    await db
      .prepare(
        `UPDATE players
         SET display_name = ?, avatar_url = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(display_name, avatar_url ?? null, playerId)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO players (id, display_name, avatar_url)
         VALUES (?, ?, ?)`
      )
      .bind(playerId, display_name, avatar_url ?? null)
      .run();
  }

  const player = await db
    .prepare("SELECT * FROM players WHERE id = ?")
    .bind(playerId)
    .first<Player>();

  return c.json(player, existing ? 200 : 201);
});

// ── Game Bundle ────────────────────────────────────────────────────

app.get("/api/games/:gameId/bundle", async (c) => {
  const gameId = c.req.param("gameId");
  const bucket = c.env.GAME_BUNDLES;

  const key = `games/${gameId}/bundle.zip`;
  const object = await bucket.head(key);

  if (!object) {
    return c.json({ error: "Game bundle not found" }, 404);
  }

  return c.json({
    game_id: gameId,
    bundle_key: key,
    size: object.size,
    etag: object.etag,
    uploaded: object.uploaded.toISOString(),
  });
});

// ── Matchmaking / WebSocket ────────────────────────────────────────

app.get("/api/rooms/:gameId/connect", async (c) => {
  const gameId = c.req.param("gameId");
  const playerId = c.req.query("player_id");

  if (!playerId) {
    return c.json({ error: "player_id query parameter required" }, 400);
  }

  // Get game manifest for max_players
  const today = todayDateString();
  const manifest = await c.env.SCHEDULE.get(
    `schedule:${today}`,
    "json"
  ) as GameManifest | null;

  const maxPlayers = manifest?.max_players ?? 4;

  const roomId = await findOrCreateRoom(
    c.env.SCHEDULE,
    c.env.GAME_ROOM,
    gameId,
    playerId,
    maxPlayers
  );

  const roomObjectId = c.env.GAME_ROOM.idFromName(roomId);
  const roomStub = c.env.GAME_ROOM.get(roomObjectId);

  const url = new URL(c.req.url);
  url.pathname = `/ws`;
  url.searchParams.set("player_id", playerId);
  url.searchParams.set("game_id", gameId);

  return roomStub.fetch(url.toString(), {
    headers: c.req.raw.headers,
  });
});

// ── 404 fallback ───────────────────────────────────────────────────

app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

// ── Exports ────────────────────────────────────────────────────────

export { GameRoom };
export default app;
