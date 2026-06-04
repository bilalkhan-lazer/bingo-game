const { Redis } = require("@upstash/redis");
const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });

function generateBingoCard() {
  const ranges = [[1,15],[16,30],[31,45],[46,60],[61,75]];
  const card = [];
  for (let col = 0; col < 5; col++) {
    const [min, max] = ranges[col];
    const pool = Array.from({length: max-min+1}, (_,i) => min+i);
    for (let i = pool.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
    card.push(pool.slice(0,5));
  }
  const grid = Array.from({length:5}, (_,row) => Array.from({length:5}, (_,col) => card[col][row]));
  grid[2][2] = "FREE";
  return grid;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, body: "Invalid JSON" }; }
  const { gameId, playerName } = body;
  if (!gameId || !playerName) return { statusCode: 400, body: JSON.stringify({ error: "gameId and playerName required" }) };
  const raw = await redis.get(`game:${gameId}`);
  if (!raw) return { statusCode: 404, body: JSON.stringify({ error: "Game not found" }) };
  const game = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (game.status === "finished") return { statusCode: 400, body: JSON.stringify({ error: "Game is already finished" }) };
  if (Object.keys(game.players).length >= 10) return { statusCode: 400, body: JSON.stringify({ error: "Game is full" }) };
  const playerKey = playerName.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
  if (game.players[playerKey]) {
    return { statusCode: 200, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerKey, card: game.players[playerKey].card, drawnNumbers: game.drawnNumbers, winner: game.winner }) };
  }
  const card = generateBingoCard();
  game.players[playerKey] = { name: playerName.trim(), card, joinedAt: Date.now() };
  await redis.set(`game:${gameId}`, JSON.stringify(game), { ex: 86400 });
  return { statusCode: 200, headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerKey, card, drawnNumbers: game.drawnNumbers, winner: game.winner }) };
};
