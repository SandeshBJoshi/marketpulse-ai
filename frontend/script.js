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

/* ===== Popup structure / Chart.js loader (creates UI inside #resultPopup) ===== */
let chartInstance = null;
let edaCounts = { Positive: 0, Neutral: 0, Negative: 0 };

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

function ensurePopupStructure() {
  const popup = document.getElementById("resultPopup");
  // If popup-content exists, assume structure is ready
  if (popup.querySelector(".popup-content")) return; 

  // Create structure: popup-content -> type-col + eda-col
  popup.innerHTML = `
    <button class="popup-close" title="Close">✖</button>
    <div class="popup-content">
      <div class="type-col">
        <div id="typewriter" style="min-height:220px;font-family:'Courier New',monospace;color:#eafcff;"></div>
        <div class="popup-controls">
          <button class="download-btn" id="downloadCsv">Download Results</button>
        </div>
      </div>
      <div class="eda-col">
        <canvas id="edaChart" aria-label="EDA Chart"></canvas>
        <div class="eda-badges">
          <div class="badge pos" id="badgePos">Positive: 0</div>
          <div class="badge neu" id="badgeNeu">Neutral: 0</div>
          <div class="badge neg" id="badgeNeg">Negative: 0</div>
        </div>
      </div>
    </div>
  `;

  // close button handler
  popup.querySelector(".popup-close").addEventListener("click", () => {
    popup.classList.remove("show");
  });
}

async function initChartIfNeeded() {
  await ensureChartjsLoaded();
  ensurePopupStructure();

  const ctx = document.getElementById("edaChart").getContext("2d");
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
          "rgba(76, 175, 80, 0.8)",
          "rgba(158, 158, 158, 0.8)",
          "rgba(244, 67, 54, 0.8)",
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

function updateEdaUI() {
  // update badges
  const bPos = document.getElementById("badgePos");
  const bNeu = document.getElementById("badgeNeu");
  const bNeg = document.getElementById("badgeNeg");
  if (bPos) bPos.textContent = `Positive: ${edaCounts.Positive}`;
  if (bNeu) bNeu.textContent = `Neutral: ${edaCounts.Neutral}`;
  if (bNeg) bNeg.textContent = `Negative: ${edaCounts.Negative}`;

  // update chart
  if (chartInstance) {
    chartInstance.data.datasets[0].data = [edaCounts.Positive, edaCounts.Neutral, edaCounts.Negative];
    chartInstance.update();
  }
}

/* ===== Typewriter that updates EDA live ===== */
async function typeWriterWithEda(container, lines, speed = TYPEWRITER_SPEED) {
  container.textContent = "";
  // We'll also store parsed results for download
  const parsedRows = [];

  for (const line of lines) {
    // type the line character by character
    for (let i = 0; i < line.length; i++) {
      container.textContent += line[i];
      await new Promise(r => setTimeout(r, speed));
    }
    container.textContent += "\n\n";

    // parse sentiment word from the just-typed line
    // Expected format: → Sentiment: <Label> (<NN>%)
    const m = line.match(/Sentiment:\s*(Positive|Neutral|Negative)/i);
    const p = line.match(/\((\d{1,3})%\)/);
    const label = m ? (m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()) : "Neutral";
    const percent = p ? Number(p[1]) : null;

    // update counters
    if (!edaCounts[label]) edaCounts[label] = 0;
    edaCounts[label] += 1;
    updateEdaUI();

    // save parsed row for download
    parsedRows.push({ text: line.split("\n")[0].replace(/^"/, "").replace(/"$/, ""), sentiment: label, score: percent ?? "" });

    // short pause between lines
    await new Promise(r => setTimeout(r, Math.max(40, speed)));
  }

  return parsedRows;
}

/* ===== UI refs ===== */
const awaitingText = document.getElementById("awaiting");
const analyzingText = document.getElementById("analyzing");
const resultPopup = document.getElementById("resultPopup");
let typewriterDiv = document.getElementById("typewriter"); // may be replaced when popup structure created

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
    const results = []; // string lines to type

    // reset EDA counts
    edaCounts = { Positive: 0, Neutral: 0, Negative: 0 };

    // prepare popup structure + chart
    ensurePopupStructure();
    await initChartIfNeeded(); // loads Chart.js if needed
    typewriterDiv = document.getElementById("typewriter"); // update ref
    // clear any previous text
    typewriterDiv.textContent = "";
    updateEdaUI();

    // analyze each row (split sub-sentences) and build result lines array
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

    // show popup
    resultPopup.classList.add("show");

    // hook download button (created in ensurePopupStructure)
    const downloadBtn = document.getElementById("downloadCsv");
    downloadBtn.onclick = () => {
      // we'll build CSV from the currently displayed rows (the results array may be typed partly)
      // if chart counts aren't in sync yet, that's fine — we download parsedRows returned after typing
      if (window._lastParsedRows && window._lastParsedRows.length) {
        downloadCsvFromRows(window._lastParsedRows);
      } else {
        // fallback: download the prepared results with unknown sentiment
        const rows = results.map(r => {
          const txt = r.split("\n")[0].replace(/^"/, "").replace(/"$/, "");
          const m = r.match(/Sentiment:\s*(Positive|Neutral|Negative)/i);
          const p = r.match(/\((\d{1,3})%\)/);
          return { text: txt, sentiment: m ? m[1] : "Neutral", score: p ? p[1] : "" };
        });
        downloadCsvFromRows(rows);
      }
    };

    // run typewriter that updates EDA live and also returns parsed rows for download
    const parsedRows = await typeWriterWithEda(typewriterDiv, results, TYPEWRITER_SPEED);
    // store globally so download button can use it immediately after typing
    window._lastParsedRows = parsedRows.slice();

    // final UI update
    updateEdaUI();
  };

  reader.readAsText(file);
});

/* ===== Download CSV utility ===== */
function downloadCsvFromRows(rows) {
  // rows: [{text, sentiment, score}]
  const header = ["Sentence", "Sentiment", "Score"];
  const csv = [header.join(",")].concat(rows.map(r => {
    // escape quotes and commas
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

// Fetch price & growth from backend (Render)
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
