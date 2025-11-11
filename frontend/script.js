// ===== CONFIG =====
const BACKEND_BASE = "https://marketpulse-ai-kir2.onrender.com"; // <- Render backend
const CSV_ROW_LIMIT = 20;           // how many CSV rows to analyze at once
const TYPEWRITER_SPEED = 20;        // ms per character (smaller => faster)
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

// ===== CSV SENTIMENT ANALYSIS (backend call) =====
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

/* ===== POPUP + EDA (lazy-created) ===== */
let chartInstance = null;
let edaCounts = { Positive: 0, Neutral: 0, Negative: 0 };

// Helper: load Chart.js only when needed
function ensureChartjsLoaded() {
  return new Promise((resolve, reject) => {
    if (window.Chart) return resolve();
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Chart.js"));
    document.head.appendChild(s);
  });
}

// Build popup DOM only when required
function ensurePopupStructure() {
  const popup = document.getElementById("resultPopup");
  if (!popup) {
    console.error("No #resultPopup element found in HTML.");
    return;
  }

  // If structure already built, just return
  if (popup.dataset.built === "1") return;

  // Clear any existing children (defensive)
  popup.innerHTML = "";

  // Create markup (two columns: typewriter + EDA)
  const html = `
    <button class="popup-close" title="Close">✖</button>
    <div class="popup-content" style="display:flex;gap:18px;flex-wrap:wrap;">
      <div class="type-col" style="flex:1 1 55%;min-width:320px;">
        <div id="typewriter" style="min-height:220px;font-family:'Courier New',monospace;color:#eafcff;padding-right:8px;"></div>
        <div class="popup-controls" style="margin-top:12px;display:flex;gap:8px;">
          <button class="download-btn" id="downloadCsv">⬇ Download Results</button>
          <button class="view-eda-btn" id="viewEdaBtn" disabled>📊 View EDA</button>
        </div>
      </div>
      <div class="eda-col" style="flex:1 1 35%;min-width:240px;display:none;">
        <div style="height:220px;">
          <canvas id="edaChart" aria-label="EDA Chart" style="width:100%;height:100%;"></canvas>
        </div>
        <div class="eda-badges" style="display:flex;gap:8px;margin-top:10px;">
          <div class="badge pos" id="badgePos" style="background:#4CAF50;color:#021; padding:6px 10px;border-radius:14px;">Positive: 0</div>
          <div class="badge neu" id="badgeNeu" style="background:#9E9E9E;color:#021; padding:6px 10px;border-radius:14px;">Neutral: 0</div>
          <div class="badge neg" id="badgeNeg" style="background:#F44336;color:#021; padding:6px 10px;border-radius:14px;">Negative: 0</div>
        </div>
      </div>
    </div>
  `;
  popup.innerHTML = html;
  popup.dataset.built = "1";

  // Close handler
  popup.querySelector(".popup-close").addEventListener("click", () => {
    hidePopup();
  });
}

// Initialize Chart if needed or update it
async function initChartIfNeeded() {
  await ensureChartjsLoaded();
  ensurePopupStructure();

  const canvasEl = document.getElementById("edaChart");
  if (!canvasEl) return;

  const ctx = canvasEl.getContext("2d");
  if (chartInstance) {
    chartInstance.data.datasets[0].data = [edaCounts.Positive, edaCounts.Neutral, edaCounts.Negative];
    chartInstance.update();
    return;
  }

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Positive", "Neutral", "Negative"],
      datasets: [{
        label: "Sentiment counts",
        data: [edaCounts.Positive, edaCounts.Neutral, edaCounts.Negative],
        backgroundColor: [
          "rgba(76, 175, 80, 0.9)",
          "rgba(158, 158, 158, 0.9)",
          "rgba(244, 67, 54, 0.9)",
        ],
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

// update badges + chart
function updateEdaUI() {
  const bPos = document.getElementById("badgePos");
  const bNeu = document.getElementById("badgeNeu");
  const bNeg = document.getElementById("badgeNeg");
  if (bPos) bPos.textContent = `Positive: ${edaCounts.Positive}`;
  if (bNeu) bNeu.textContent = `Neutral: ${edaCounts.Neutral}`;
  if (bNeg) bNeg.textContent = `Negative: ${edaCounts.Negative}`;

  if (chartInstance) {
    chartInstance.data.datasets[0].data = [edaCounts.Positive, edaCounts.Neutral, edaCounts.Negative];
    chartInstance.update();
  }
}

/* Typewriter that updates EDA live */
async function typeWriterWithEda(container, lines, speed = TYPEWRITER_SPEED) {
  container.textContent = "";
  const parsedRows = [];

  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      container.textContent += line[i];
      await new Promise(r => setTimeout(r, speed));
    }
    container.textContent += "\n\n";

    const m = line.match(/Sentiment:\s*(Positive|Neutral|Negative)/i);
    const p = line.match(/\((\d{1,3})%\)/);
    const labelRaw = m ? m[1] : "Neutral";
    const label = labelRaw[0].toUpperCase() + labelRaw.slice(1).toLowerCase();
    const percent = p ? Number(p[1]) : null;

    if (!edaCounts[label]) edaCounts[label] = 0;
    edaCounts[label] += 1;
    updateEdaUI();

    parsedRows.push({ text: line.split("\n")[0].replace(/^"/, "").replace(/"$/, ""), sentiment: label, score: percent ?? "" });
    await new Promise(r => setTimeout(r, Math.max(25, speed)));
  }

  return parsedRows;
}

/* UI refs + defensive popup hide on load */
const awaitingText = document.getElementById("awaiting");
const analyzingText = document.getElementById("analyzing");
const resultPopup = document.getElementById("resultPopup");

// Defensive: ensure popup hidden on load (both CSS class and inline display)
if (resultPopup) {
  resultPopup.classList.remove("show");
  resultPopup.style.display = "none";
} else {
  console.warn("#resultPopup element not found — please ensure your HTML contains <div id='resultPopup'></div>");
}

let typewriterDiv = document.getElementById("typewriter"); // may be replaced later

// Show / hide helpers (use both display and class to avoid flashes)
function showPopup() {
  const popup = document.getElementById("resultPopup");
  if (!popup) return;
  popup.style.display = "block";
  // small timeout to allow CSS transitions if any
  setTimeout(() => popup.classList.add("show"), 8);
}
function hidePopup() {
  const popup = document.getElementById("resultPopup");
  if (!popup) return;
  popup.classList.remove("show");
  // remove inline after transition (safe fallback: 250ms)
  setTimeout(() => { popup.style.display = "none"; }, 260);
}

/* CSV upload handler (main flow) */
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

    const posts = lines.slice(1, 1 + CSV_ROW_LIMIT);
    const results = [];

    edaCounts = { Positive: 0, Neutral: 0, Negative: 0 };

    // Prepare popup structure (DOM built lazily)
    ensurePopupStructure();
    typewriterDiv = document.getElementById("typewriter");
    if (!typewriterDiv) {
      // fallback: create a simple container if missing
      const popup = document.getElementById("resultPopup");
      popup.innerHTML = popup.innerHTML + '<div id="typewriter" style="min-height:160px"></div>';
      typewriterDiv = document.getElementById("typewriter");
    }
    // clear previous
    typewriterDiv.textContent = "";
    updateEdaUI();

    // analyze rows (call backend)
    for (const line of posts) {
      if (!line.trim()) continue;

      const subSentences = line.match(/[^.!?]+[.!?]?/g) || [line];
      const sentiments = [];
      for (const sub of subSentences) {
        const s = await analyzeSentiment(sub);
        if (s && s.sentiment) sentiments.push(s);
      }

      let finalLabel = "Neutral", finalScore = 0;
      if (sentiments.length > 0) {
        const top = sentiments.reduce((a, b) => (a.score > b.score ? a : b));
        finalLabel = top.sentiment;
        finalScore = top.score;
      }

      const percentScore = Math.min(Math.round(finalScore * 10), 100);
      results.push(`"${line.trim()}"\n → Sentiment: ${finalLabel} (${percentScore}%)`);
    }

    analyzingText.style.display = "none";
    awaitingText.style.display = "block";

    // Show popup (only now)
    showPopup();

    // Setup buttons
    const downloadBtn = document.getElementById("downloadCsv");
    const viewEdaBtn = document.getElementById("viewEdaBtn");
    const edaCol = document.querySelector("#resultPopup .eda-col");

    downloadBtn.onclick = () => {
      if (window._lastParsedRows && window._lastParsedRows.length) {
        downloadCsvFromRows(window._lastParsedRows);
      } else {
        const rows = results.map(r => {
          const txt = r.split("\n")[0].replace(/^"/, "").replace(/"$/, "");
          const m = r.match(/Sentiment:\s*(Positive|Neutral|Negative)/i);
          const p = r.match(/\((\d{1,3})%\)/);
          return { text: txt, sentiment: m ? m[1] : "Neutral", score: p ? p[1] : "" };
        });
        downloadCsvFromRows(rows);
      }
    };

    // view EDA lazy-load
    viewEdaBtn.disabled = true;
    viewEdaBtn.onclick = async () => {
      await initChartIfNeeded();
      if (edaCol) edaCol.style.display = "block";
      updateEdaUI();
    };

    // Do the typing (fast) and update EDA live
    const parsedRows = await typeWriterWithEda(typewriterDiv, results, TYPEWRITER_SPEED);
    window._lastParsedRows = parsedRows.slice();

    // enable view EDA after typing
    viewEdaBtn.disabled = false;

    updateEdaUI();
  };

  reader.readAsText(file);
});

/* Download CSV utility */
function downloadCsvFromRows(rows) {
  const header = ["Sentence", "Sentiment", "Score"];
  const csv = [header.join(",")].concat(rows.map(r => {
    const safe = (s) => `"${String(s || "").replace(/"/g, '""')}"`;
    return [safe(r.text), safe(r.sentiment), safe(r.score)].join(",");
  })).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `marketpulse_results_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ===== LIVE STOCK TICKER ===== */
const tickerHeadlines = document.getElementById("ticker-headlines");
const symbols = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "META", "NFLX", "NVDA", "BABA", "DIS"];

async function fetchStock(symbol) {
  try {
    const res = await fetch(`${BACKEND_BASE}/stock/${symbol}`);
    const data = await res.json();
    if (!data || data.price === null) {
      return `<span class="stock-item">${symbol}: 🔴 N/A</span>`;
    }

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

let tickerX = 0;
let contentWidth = 0;
let viewportWidth = 0;

async function updateTicker() {
  const headlines = await Promise.all(symbols.map(fetchStock));
  const html = headlines.join(" ");
  tickerHeadlines.innerHTML = html;

  contentWidth = tickerHeadlines.offsetWidth || 1000;
  viewportWidth = tickerHeadlines.parentElement.offsetWidth || window.innerWidth;
  tickerX = viewportWidth;
}
function animateTicker() {
  tickerX -= TICKER_SPEED;
  if (tickerX <= -contentWidth) {
    tickerX = viewportWidth;
  }
  tickerHeadlines.style.transform = `translateX(${tickerX}px)`;
  requestAnimationFrame(animateTicker);
}

updateTicker().then(() => {
  requestAnimationFrame(animateTicker);
});
setInterval(updateTicker, 15000);
