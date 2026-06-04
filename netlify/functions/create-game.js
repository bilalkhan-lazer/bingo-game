const { Redis } = require("@upstash/redis");
const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });

function generateId(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  const gameId = generateId(6);
  const adminKey = generateId(12);
  const gameState = { gameId, adminKey, drawnNumbers: [], players: {}, winner: null, createdAt: Date.now(), status: "waiting" };
  await redis.set(`game:${gameId}`, JSON.stringify(gameState), { ex: 86400 });
  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gameId, adminKey }) };
};
