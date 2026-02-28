// ── Types ──────────────────────────────────────────────────────────

interface OpenRoom {
  roomId: string;
  gameId: string;
  playerCount: number;
  maxPlayers: number;
  createdAt: number;
}

// ── Matchmaking ────────────────────────────────────────────────────

/**
 * Find an available room for the player or create a new one.
 *
 * Uses KV to track open rooms. Each game has a list of rooms that
 * still have capacity. When a room fills up, it is removed from
 * the available list.
 *
 * KV keys:
 *   - `rooms:{gameId}:open` → JSON array of OpenRoom
 *   - `rooms:{gameId}:{roomId}` → OpenRoom details
 */
export async function findOrCreateRoom(
  kv: KVNamespace,
  gameRoomNS: DurableObjectNamespace,
  gameId: string,
  playerId: string,
  maxPlayers: number
): Promise<string> {
  const openRoomsKey = `rooms:${gameId}:open`;

  // Get current open rooms
  let openRooms: OpenRoom[] = [];
  const raw = await kv.get(openRoomsKey, "json");
  if (raw) {
    openRooms = raw as OpenRoom[];
  }

  // Prune stale rooms (older than 10 minutes with no activity)
  const staleThreshold = Date.now() - 10 * 60 * 1000;
  openRooms = openRooms.filter((room) => room.createdAt > staleThreshold);

  // Find a room with capacity
  let targetRoom: OpenRoom | null = null;

  for (const room of openRooms) {
    if (room.playerCount < room.maxPlayers) {
      targetRoom = room;
      break;
    }
  }

  if (targetRoom) {
    // Join existing room
    targetRoom.playerCount += 1;

    // If room is now full, remove from open list
    if (targetRoom.playerCount >= targetRoom.maxPlayers) {
      openRooms = openRooms.filter((r) => r.roomId !== targetRoom!.roomId);
    }

    // Update KV
    await kv.put(openRoomsKey, JSON.stringify(openRooms), {
      expirationTtl: 3600,
    });

    // Update individual room record
    await kv.put(
      `rooms:${gameId}:${targetRoom.roomId}`,
      JSON.stringify(targetRoom),
      { expirationTtl: 3600 }
    );

    return targetRoom.roomId;
  }

  // No room available, create a new one
  const roomId = `${gameId}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  const newRoom: OpenRoom = {
    roomId,
    gameId,
    playerCount: 1,
    maxPlayers,
    createdAt: Date.now(),
  };

  openRooms.push(newRoom);

  // Persist to KV
  await kv.put(openRoomsKey, JSON.stringify(openRooms), {
    expirationTtl: 3600,
  });

  await kv.put(`rooms:${gameId}:${roomId}`, JSON.stringify(newRoom), {
    expirationTtl: 3600,
  });

  return roomId;
}

/**
 * Remove a room from the available list.
 * Called when a room should no longer accept new players.
 */
export async function closeRoom(
  kv: KVNamespace,
  gameId: string,
  roomId: string
): Promise<void> {
  const openRoomsKey = `rooms:${gameId}:open`;

  const raw = await kv.get(openRoomsKey, "json");
  if (!raw) return;

  let openRooms = raw as OpenRoom[];
  openRooms = openRooms.filter((r) => r.roomId !== roomId);

  await kv.put(openRoomsKey, JSON.stringify(openRooms), {
    expirationTtl: 3600,
  });

  // Clean up individual room record
  await kv.delete(`rooms:${gameId}:${roomId}`);
}

/**
 * Decrement the player count for a room.
 * If the room becomes empty, remove it entirely.
 */
export async function playerLeftRoom(
  kv: KVNamespace,
  gameId: string,
  roomId: string
): Promise<void> {
  const roomKey = `rooms:${gameId}:${roomId}`;
  const raw = await kv.get(roomKey, "json");
  if (!raw) return;

  const room = raw as OpenRoom;
  room.playerCount = Math.max(0, room.playerCount - 1);

  if (room.playerCount === 0) {
    // Room is empty, clean up
    await closeRoom(kv, gameId, roomId);
    return;
  }

  // Update room record
  await kv.put(roomKey, JSON.stringify(room), { expirationTtl: 3600 });

  // Re-add to open rooms if it was previously full
  const openRoomsKey = `rooms:${gameId}:open`;
  const openRaw = await kv.get(openRoomsKey, "json");
  let openRooms: OpenRoom[] = openRaw ? (openRaw as OpenRoom[]) : [];

  const alreadyListed = openRooms.some((r) => r.roomId === roomId);
  if (!alreadyListed && room.playerCount < room.maxPlayers) {
    openRooms.push(room);
    await kv.put(openRoomsKey, JSON.stringify(openRooms), {
      expirationTtl: 3600,
    });
  }
}
