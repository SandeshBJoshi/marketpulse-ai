require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

let cache = {};

// ===== CACHE UTIL =====
function getCached(key) {
  const now = Date.now();
  return cache[key] && now - cache[key].ts < 2 * 60 * 1000 ? cache[key].data : null;
}
function setCache(key, data) {
  cache[key] = { data, ts: Date.now() };
}

// ===== POST: ANALYZE TEXT =====
// (keep this as-is if using CSV sentiment)
const Sentiment = require("sentiment");
const sentiment = new Sentiment();
app.post("/analyze-text", (req, res) => {
  const { text } = req.body;
  const result = sentiment.analyze(text);
  res.json({
    sentiment: result.score > 0 ? "Positive" : result.score < 0 ? "Negative" : "Neutral",
    score: Math.abs(result.score),
  });
});

// ===== GET: STOCK INFO (Finnhub Free API) =====
app.get("/stock/:symbol", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const cached = getCached(symbol);
  if (cached) return res.json(cached);

  try {
    const quoteRes = await axios.get("https://finnhub.io/api/v1/quote", {
      params: { symbol: symbol, token: process.env.FINNHUB_KEY },
    });

    const price = quoteRes.data.c;          // current price
    const changePercent = quoteRes.data.dp; // % change

    const response = {
      price: price,
      growth: changePercent.toFixed(2),
    };

    setCache(symbol, response);
    res.json(response);

  } catch (err) {
    console.error(`Finnhub API error for ${symbol}:`, err.message);
    res.json({ price: null, growth: null });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
