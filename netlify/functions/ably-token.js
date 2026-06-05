const Ably = require("ably");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST" && event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  const gameId = event.queryStringParameters?.gameId;
  const clientId = event.queryStringParameters?.clientId || "anonymous";
  if (!gameId) return { statusCode: 400, body: JSON.stringify({ error: "gameId required" }) };

  try {
    const ably = new Ably.Rest(process.env.ABLY_API_KEY);
    const tokenRequest = await ably.auth.createTokenRequest({
      clientId,
      capability: JSON.stringify({ [`bingo-${gameId}`]: ["subscribe", "publish"] }),
      ttl: 3600000,
    });
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tokenRequest),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Token request failed", details: err.message }),
    };
  }
};
