const { Redis } = require("@upstash/redis");
const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return { statusCode: 405, body: "Method Not Allowed" };
  const gameId = event.queryStringParameters?.gameId;
  if (!gameId) return { statusCode: 400, body: JSON.stringify({ error: "gameId required" }) };
  const raw = await redis.get(`game:${gameId}`);
  if (!raw) return { statusCode: 404, body: JSON.stringify({ error: "Game not found" }) };
  const game = typeof raw === "string" ? JSON.parse(raw) : raw;
  const publicState = {
    gameId: game.gameId, gameName: game.gameName || null,
    drawnNumbers: game.drawnNumbers,
    players: Object.fromEntries(Object.entries(game.players).map(([k, p]) => [k, { name: p.name, joinedAt: p.joinedAt, cardCount: (p.cards || [p.card]).length }])),
    winner: game.winner, winners: game.winners || [], status: game.status,
    totalNumbers: 75, remaining: 75 - game.drawnNumbers.length,
  };
  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(publicState) };
};
