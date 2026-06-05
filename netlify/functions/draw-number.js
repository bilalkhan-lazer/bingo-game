const { Redis } = require("@upstash/redis");
const Ably = require("ably");
const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });

function checkBingo(card, drawnNumbers) {
  const s = new Set(drawnNumbers);
  const m = (r, c) => card[r][c] === "FREE" || s.has(card[r][c]);
  for (let r = 0; r < 5; r++) if ([0,1,2,3,4].every(c => m(r,c))) return true;
  for (let c = 0; c < 5; c++) if ([0,1,2,3,4].every(r => m(r,c))) return true;
  if ([0,1,2,3,4].every(i => m(i,i))) return true;
  if ([0,1,2,3,4].every(i => m(i,4-i))) return true;
  return false;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, body: "Invalid JSON" }; }
  const { gameId, adminKey } = body;
  if (!gameId || !adminKey) return { statusCode: 400, body: JSON.stringify({ error: "gameId and adminKey required" }) };
  const raw = await redis.get(`game:${gameId}`);
  if (!raw) return { statusCode: 404, body: JSON.stringify({ error: "Game not found" }) };
  const game = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (game.adminKey !== adminKey) return { statusCode: 403, body: JSON.stringify({ error: "Invalid admin key" }) };
  const drawn = new Set(game.drawnNumbers);
  const pool = Array.from({ length: 75 }, (_, i) => i + 1).filter(n => !drawn.has(n));
  if (!pool.length) return { statusCode: 400, body: JSON.stringify({ error: "All numbers have been drawn" }) };
  const number = pool[Math.floor(Math.random() * pool.length)];
  game.drawnNumbers.push(number);
  game.status = "active";
  if (!game.winners) game.winners = [];
  const alreadyWon = new Set(game.winners.map(w => w.playerKey));
  for (const [playerKey, player] of Object.entries(game.players)) {
    if (alreadyWon.has(playerKey)) continue;
    const cards = player.cards || [player.card];
    if (cards.some(card => checkBingo(card, game.drawnNumbers))) {
      game.winners.push({ playerKey, name: player.name, atNumber: number });
      if (!game.winner) game.winner = { playerKey, name: player.name };
    }
  }
  await redis.set(`game:${gameId}`, JSON.stringify(game), { ex: 86400 });
  const ably = new Ably.Rest(process.env.ABLY_API_KEY);
  const msg = { number, drawnNumbers: game.drawnNumbers, winner: game.winner || null, winners: game.winners, status: game.status };
  await ably.channels.get(`bingo-${gameId}`).publish("game-update", msg);
  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(msg) };
};
