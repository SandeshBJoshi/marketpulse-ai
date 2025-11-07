// ===== CONFIG =====
const BACKEND_BASE = "https://marketpulse-ai-kir2.onrender.com"; // <- Render backend
const CSV_ROW_LIMIT = 20;           // how many CSV rows to analyze at once
const TYPEWRITER_SPEED = 35;        // ms per character (smaller => faster)
const TICKER_SPEED = 3;             // pixels per frame (increase to speed up ticker)

// ===== MATRIX ANIMATION =====
const canvas = document.getElementById("matrix");
const ctx = canvas.getContext("2d");
canvas.height = window.innerHeight;
canvas.width = window.innerWidth;

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789@#$%^&*()*&^%";
const fontSize = 14;
let columns = Math.floor(canvas.width / fontSize);
let drops = Array(columns).fill(1);

function resizeMatrix() {
  canvas.height = window.innerHeight;
  canvas.width = window.innerWidth;
  columns = Math.floor(canvas.width / fontSize);
  drops = Array(columns).fill(1);
}
window.addEventListener("resize", resizeMatrix);

function drawMatrix() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#00fff7";
  ctx.font = fontSize + "px 'Ndot 57 Aligned'";
  for (let i = 0; i < drops.length; i++) {
    const text = letters.charAt(Math.floor(Math.random() * letters.length));
    ctx.fillText(text, i * fontSize, drops[i] * fontSize);
    if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
    drops[i]++;
  }
}
setInterval(drawMatrix, 33);

// ===== CSV SENTIMENT ANALYSIS =====
async function analyzeSentiment(text) {
  try {
    const response = await fetch(`${BACKEND_BASE}/analyze-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    const result = await response.json();
    return result;
  } catch (err) {
    console.error("Sentiment call failed:", err);
    return null;
  }
}

async function typeWriter(container, lines, speed = TYPEWRITER_SPEED) {
  container.textContent = "";
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      container.textContent += line[i];
      await new Promise(r => setTimeout(r, speed));
    }
    container.textContent += "\n\n";
    // small pause between lines
    await new Promise(r => setTimeout(r, Math.max(40, speed)));
  }
}

// ===== UI refs =====
const awaitingText = document.getElementById("awaiting");
const analyzingText = document.getElementById("analyzing");
const resultPopup = document.getElementById("resultPopup");
const typewriterDiv = document.getElementById("typewriter");

// CSV upload handler
document.getElementById("fileInput").addEventListener("change", async function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();

  awaitingText.style.display = "none";
  analyzingText.style.display = "block";

  reader.onload = async function (event) {
    const lines = event.target.result.split("\n").filter(l => l.trim());
    if (lines.length < 2) {
      alert("CSV looks empty or invalid.");
      analyzingText.style.display = "none";
      awaitingText.style.display = "block";
      return;
    }

    const header = lines[0].toLowerCase();
    if (!header.includes("sentence")) {
      alert("CSV must have a 'Sentence' column in the header.");
      analyzingText.style.display = "none";
      awaitingText.style.display = "block";
      return;
    }

    // take up to CSV_ROW_LIMIT rows for client-side analysis
    const posts = lines.slice(1, 1 + CSV_ROW_LIMIT);
    const results = [];

    for (const line of posts) {
      if (!line.trim()) continue;

      // split to sub-sentences so the analyzer can work better on long text
      const subSentences = line.match(/[^.!?]+[.!?]?/g) || [line];
      const sentiments = [];
      for (const sub of subSentences) {
        const s = await analyzeSentiment(sub);
        if (s && s.sentiment) sentiments.push(s);
      }

      // pick highest-score sentiment if available, else Neutral
      let finalLabel = "Neutral", finalScore = 0;
      if (sentiments.length > 0) {
        const top = sentiments.reduce((a, b) => (a.score > b.score ? a : b));
        finalLabel = top.sentiment;
        finalScore = top.score;
      }

      // percentage formatting (server returns number not in percent; treat as magnitude)
      const percentScore = Math.min(Math.round(finalScore * 10), 100);
      results.push(`"${line.trim()}"\n → Sentiment: ${finalLabel} (${percentScore}%)`);
    }

    analyzingText.style.display = "none";
    awaitingText.style.display = "block";

    // show popup with typed results
    resultPopup.classList.add("show");
    // clear previous text
    typewriterDiv.textContent = "";
    await typeWriter(typewriterDiv, results, TYPEWRITER_SPEED);
  };

  reader.readAsText(file);
});

// ===== LIVE STOCK TICKER =====
const tickerHeadlines = document.getElementById("ticker-headlines");
const symbols = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "META", "NFLX", "NVDA", "BABA", "DIS"];

// Fetch price & growth from backend (Render)
async function fetchStock(symbol) {
  try {
    const res = await fetch(`${BACKEND_BASE}/stock/${symbol}`);
    const data = await res.json();
    if (!data || data.price === null) {
      return `<span class="stock-item">${symbol}: 🔴 N/A</span>`;
    }

    // Nice formatting
    const growthNum = Number(data.growth);
    const growthSign = growthNum > 0 ? "+" : "";
    const growthStr = `${growthSign}${Number(growthNum).toFixed(2)}%`;
    const priceStr = Number(data.price).toFixed(2);

    return `<span class="stock-item">
      <span class="stock-name">${symbol}</span>:
      <span class="stock-value">${growthNum > 0 ? "🟢" : growthNum < 0 ? "🔴" : "⚪"} ${growthStr} $${priceStr}</span>
    </span>`;
  } catch (err) {
    console.error(`fetchStock ${symbol} error:`, err);
    return `<span class="stock-item">${symbol}: 🔴 N/A</span>`;
  }
}

// Ticker animation (smooth translateX using requestAnimationFrame)
let tickerX = 0;
let contentWidth = 0;
let viewportWidth = 0;

async function updateTicker() {
  const headlines = await Promise.all(symbols.map(fetchStock));
  const html = headlines.join(" ");
  tickerHeadlines.innerHTML = html;

  // measure widths and set starting x at viewport right edge
  contentWidth = tickerHeadlines.offsetWidth || 1000;
  viewportWidth = tickerHeadlines.parentElement.offsetWidth || window.innerWidth;
  tickerX = viewportWidth; // start from right edge
}
function animateTicker() {
  tickerX -= TICKER_SPEED;
  // when content moved fully off left side, reset to start on right
  if (tickerX <= -contentWidth) {
    tickerX = viewportWidth;
  }
  tickerHeadlines.style.transform = `translateX(${tickerX}px)`;
  requestAnimationFrame(animateTicker);
}

// init
updateTicker().then(() => {
  requestAnimationFrame(animateTicker);
});
// refresh data every 15s without restarting animation
setInterval(updateTicker, 15000);
