// server.js (updated)
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

// Log presence of FINNHUB key (safe — doesn't print the key)
console.log("FINNHUB_KEY:", process.env.FINNHUB_KEY ? "✅ Loaded" : "❌ Missing");

// ===== POST: ANALYZE TEXT =====
const Sentiment = require("sentiment");
const sentiment = new Sentiment();
app.post("/analyze-text", (req, res) => {
  const { text } = req.body;
  if (typeof text !== "string") return res.status(400).json({ error: "No text provided" });

  const result = sentiment.analyze(text);
  res.json({
    sentiment: result.score > 0 ? "Positive" : result.score < 0 ? "Negative" : "Neutral",
    score: Math.abs(result.score),
  });
});

// ===== GET: STOCK INFO (Finnhub Free API) =====
const AXIOS_TIMEOUT = 8000; // ms

app.get("/stock/:symbol", async (req, res) => {
  try {
    const raw = String(req.params.symbol || "").trim();
    if (!raw) return res.status(400).json({ error: "Missing symbol" });

    // basic validation: symbols typically letters, numbers, ., -
    if (!/^[A-Za-z0-9.\-]{1,8}$/.test(raw)) {
      return res.status(400).json({ error: "Invalid symbol format" });
    }

    const symbol = raw.toUpperCase();
    const cached = getCached(symbol);
    if (cached) return res.json(cached);

    if (!process.env.FINNHUB_KEY) {
      console.warn("Finnhub key missing — cannot fetch live price");
      return res.json({ price: null, growth: null });
    }

    const quoteRes = await axios.get("https://finnhub.io/api/v1/quote", {
      params: { symbol: symbol, token: process.env.FINNHUB_KEY },
      timeout: AXIOS_TIMEOUT,
    });

    const payload = quoteRes.data || {};
    const price = (typeof payload.c === "number") ? payload.c : null;
    const changePercent = (typeof payload.dp === "number") ? payload.dp : null;

    const response = {
      price: price,                                  // number or null
      growth: changePercent !== null ? Number(changePercent) : null // number or null
    };

    setCache(symbol, response);
    return res.json(response);
  } catch (err) {
    // better error details for debugging
    const msg = err.response?.data || err.message || String(err);
    console.error(`Finnhub API error for ${req.params.symbol}:`, msg);
    return res.json({ price: null, growth: null });
  }
});

// Simple healthcheck
app.get("/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
