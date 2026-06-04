const Ably = require("ably");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST" && event.httpMethod !== "GET") return { statusCode: 405, body: "Method Not Allowed" };
  const gameId = event.queryStringParameters?.gameId;
  const clientId = event.queryStringParameters?.clientId || "anonymous";
  if (!gameId) return { statusCode: 400, body: JSON.stringify({ error: "gameId required" }) };
  const ably = new Ably.Rest(process.env.ABLY_API_KEY);
  const tokenParams = {
    clientId,
    capability: JSON.stringify({ [`bingo-${gameId}`]: ["subscribe", "publish"] }),
    ttl: 3600000,
  };
  return new Promise((resolve) => {
    ably.auth.createTokenRequest(tokenParams, (err, tokenRequest) => {
      if (err) resolve({ statusCode: 500, body: JSON.stringify({ error: "Token failed", details: err.message }) });
      else resolve({ statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(tokenRequest) });
    });
  });
};
