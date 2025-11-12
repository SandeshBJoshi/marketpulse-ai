require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const Sentiment = require("sentiment");
const sentiment = new Sentiment();

const app = express();
app.use(cors());
app.use(express.json());

let cache = {};
function getCached(key) {
  const now = Date.now();
  return cache[key] && now - cache[key].ts < 2 * 60 * 1000 ? cache[key].data : null;
}
function setCache(key, data) { cache[key] = { data, ts: Date.now() }; }

// POST analyze-text
app.post("/analyze-text", (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "No text provided" });
  const result = sentiment.analyze(text);
  const label = result.score > 0 ? "Positive" : result.score < 0 ? "Negative" : "Neutral";
  const score = Math.abs(result.score);
  res.json({ sentiment: label, score });
});

// GET stock/:symbol (Finnhub)
app.get("/stock/:symbol", async (req, res) => {
  const symbol = (req.params.symbol || "").toUpperCase();
  const cached = getCached(symbol);
  if (cached) return res.json(cached);

  try {
    const quoteRes = await axios.get("https://finnhub.io/api/v1/quote", {
      params: { symbol, token: process.env.FINNHUB_KEY }
    });
    const price = quoteRes.data.c || null;
    const changePercent = quoteRes.data.dp != null ? Number(quoteRes.data.dp).toFixed(2) : null;
    const response = { price, growth: changePercent };
    setCache(symbol, response);
    res.json(response);
  } catch (err) {
    console.error(`Finnhub API error for ${symbol}:`, err && err.message ? err.message : err);
    res.json({ price: null, growth: null });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 Server running on port ${PORT}`));
