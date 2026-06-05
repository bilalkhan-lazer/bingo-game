const { Redis } = require("@upstash/redis");
const Ably = require("ably");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function generateBingoCard() {
  const ranges = [[1,15],[16,30],[31,45],[46,60],[61,75]];
  const card = [];
  for (let col = 0; col < 5; col++) {
    const [min, max] = ranges[col];
    const pool = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    card.push(pool.slice(0, 5));
  }
  const grid = Array.from({ length: 5 }, (_, row) =>
    Array.from({ length: 5 }, (_, col) => card[col][row])
  );
  grid[2][2] = "FREE";
  return grid;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, body: "Invalid JSON" }; }
  const { gameId, playerName, cardCount = 1 } = body;
  if (!gameId || !playerName)
    return { statusCode: 400, body: JSON.stringify({ error: "gameId and playerName required" }) };
  const numCards = Math.min(Math.max(parseInt(cardCount) || 1, 1), 4);
  const raw = await redis.get(`game:${gameId}`);
  if (!raw) return { statusCode: 404, body: JSON.stringify({ error: "Game not found" }) };
  const game = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (Object.keys(game.players).length >= 10)
    return { statusCode: 400, body: JSON.stringify({ error: "Game is full (max 10 players)" }) };
  const playerKey = playerName.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
  const nameLower = playerName.trim().toLowerCase();
  for (const [key, player] of Object.entries(game.players)) {
    if (player.name.toLowerCase() === nameLower && key !== playerKey)
      return { statusCode: 400, body: JSON.stringify({ error: "That name is already taken. Please choose a different name." }) };
  }
  if (game.players[playerKey]) {
    const p = game.players[playerKey];
    const cards = p.cards || [p.card];
    return { statusCode: 200, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerKey, cards, drawnNumbers: game.drawnNumbers, winner: game.winner, winners: game.winners || [] }) };
  }
  const cards = Array.from({ length: numCards }, () => generateBingoCard());
  game.players[playerKey] = { name: playerName.trim(), cards, joinedAt: Date.now() };
  await redis.set(`game:${gameId}`, JSON.stringify(game), { ex: 86400 });
  try {
    const ably = new Ably.Rest(process.env.ABLY_API_KEY);
    const playerList = Object.fromEntries(Object.entries(game.players).map(([k, p]) => [k, {
      name: p.name, joinedAt: p.joinedAt, cardCount: (p.cards || [p.card]).length,
    }]));
    await ably.channels.get(`bingo-${gameId}`).publish("player-joined", { playerKey, name: playerName.trim(), players: playerList });
  } catch (_) {}
  return { statusCode: 200, headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerKey, cards, drawnNumbers: game.drawnNumbers, winner: game.winner, winners: game.winners || [] }) };
};
