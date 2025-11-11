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

// ===== CSV SENTIMENT ANALYSIS (client -> backend) =====
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

// ===== UI refs =====
const uploadLabel = document.getElementById("uploadLabel");
const fileInput = document.getElementById("fileInput");
const awaitingText = document.getElementById("awaiting");
const analyzingText = document.getElementById("analyzing");
const resultPopup = document.getElementById("resultPopup");
const typewriterPre = document.getElementById("typewriter");
const badgeSmallPos = document.getElementById("badgeSmallPos");
const badgeSmallNeu = document.getElementById("badgeSmallNeu");
const badgeSmallNeg = document.getElementById("badgeSmallNeg");
const downloadBtn = document.getElementById("downloadCsv");
const viewAnalysisBtn = document.getElementById("viewAnalysis");
const closePopupBtn = document.getElementById("closePopup");
const analysisPopup = document.getElementById("analysisPopup");
const closeAnalysis = document.getElementById("closeAnalysis");
const analysisSummary = document.getElementById("analysisSummary");
const statPos = document.getElementById("statPos");
const statNeu = document.getElementById("statNeu");
const statNeg = document.getElementById("statNeg");

// EDA counters & storage
let edaCounts = { Positive: 0, Neutral: 0, Negative: 0 };
let lastParsedRows = [];

// helper to type quickly
async function typeWriter(container, lines, speed = TYPEWRITER_SPEED) {
  container.textContent = "";
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      container.textContent += line[i];
      await new Promise(r => setTimeout(r, speed));
    }
    container.textContent += "\n\n";
    await new Promise(r => setTimeout(r, Math.max(40, speed)));
  }
}

// ensure Chart.js is loaded
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

// update small badges
function updateBadges() {
  badgeSmallPos.textContent = `Positive: ${edaCounts.Positive}`;
  badgeSmallNeu.textContent = `Neutral: ${edaCounts.Neutral}`;
  badgeSmallNeg.textContent = `Negative: ${edaCounts.Negative}`;
  statPos.textContent = `POSITIVE ${edaCounts.Positive}`;
  statNeu.textContent = `NEUTRAL ${edaCounts.Neutral}`;
  statNeg.textContent = `NEGATIVE ${edaCounts.Negative}`;
}

// CSV -> analyze
fileInput.addEventListener("change", async function (e) {
  const file = e.target.files[0];
  if (!file) return;
  uploadLabel.classList.add("uploaded");
  uploadLabel.textContent = "Uploaded ✓";
  awaitingText.style.display = "none";
  analyzingText.style.display = "block";

  const reader = new FileReader();
  reader.onload = async function (event) {
    const rawLines = event.target.result.split("\n");
    const lines = rawLines.filter(l => l.trim());
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

    // analyze rows
    const posts = lines.slice(1, 1 + CSV_ROW_LIMIT);
    const results = [];
    edaCounts = { Positive: 0, Neutral: 0, Negative: 0 };
    lastParsedRows = [];

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
        const top = sentiments.reduce((a,b) => (a.score > b.score ? a : b));
        finalLabel = top.sentiment;
        finalScore = top.score;
      }

      const percentScore = Math.min(Math.round(finalScore * 10), 100);
      const lineText = line.trim().replace(/^"|"$/g, "");
      results.push(`"${lineText}"\n → Sentiment: ${finalLabel} (${percentScore}%)`);

      // update EDA counts immediately (for badges)
      edaCounts[finalLabel] = (edaCounts[finalLabel] || 0) + 1;
      lastParsedRows.push({ text: lineText, sentiment: finalLabel, score: percentScore });
      updateBadges();
    }

    analyzingText.style.display = "none";
    awaitingText.style.display = "block";

    // show result popup but do NOT auto-scroll to bottom — user can read
    resultPopup.classList.add("show");
    resultPopup.setAttribute("aria-hidden", "false");

    // type results (faster)
    await typeWriter(typewriterPre, results, TYPEWRITER_SPEED);

    // store parsed rows for download / EDA
    window._lastParsedRows = lastParsedRows.slice();
    updateBadges();
  };

  reader.readAsText(file);
});

// download CSV results
downloadBtn.addEventListener("click", () => {
  const rows = window._lastParsedRows && window._lastParsedRows.length ? window._lastParsedRows :
    [];
  if (!rows.length) {
    alert("No results to download yet.");
    return;
  }
  const header = ["Sentence", "Sentiment", "Score"];
  const csv = [header.join(",")].concat(rows.map(r => {
    const safe = s => `"${String(s || "").replace(/"/g,'""')}"`;
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
});

// open analysis panel (loads charts)
viewAnalysisBtn.addEventListener("click", async () => {
  if (!window._lastParsedRows || !window._lastParsedRows.length) {
    alert("Nothing to analyze yet — upload and run first.");
    return;
  }
  // show analysis popup
  analysisPopup.style.display = "flex";
  analysisPopup.setAttribute("aria-hidden", "false");

  // prepare data
  const rows = window._lastParsedRows;
  const pos = rows.filter(r => r.sentiment === "Positive").length;
  const neu = rows.filter(r => r.sentiment === "Neutral").length;
  const neg = rows.filter(r => r.sentiment === "Negative").length;
  const labels = rows.map((r, i) => `R${i+1}`);

  // load Chart.js and render
  await ensureChartjsLoaded();
  // tidy up if charts exist from earlier
  if (window._mpPie) window._mpPie.destroy();
  if (window._mpLine) window._mpLine.destroy();
  if (window._mpBar) window._mpBar.destroy();

  const pieCtx = document.getElementById("chartPie").getContext("2d");
  window._mpPie = new Chart(pieCtx, {
    type: "doughnut",
    data: { labels:["Positive","Neutral","Negative"], datasets:[{ data:[pos,neu,neg], backgroundColor:["#4CAF50","#9E9E9E","#F44336"] }] },
    options: { responsive:true, maintainAspectRatio:false }
  });

  const lineCtx = document.getElementById("chartLine").getContext("2d");
  const lineData = rows.map(r => Number(r.score)||0);
  window._mpLine = new Chart(lineCtx, {
    type: "line",
    data: { labels, datasets:[{ label:"Score (%)", data:lineData, tension:0.25, fill:false }] },
    options: { responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } }
  });

  const barCtx = document.getElementById("chartBar").getContext("2d");
  window._mpBar = new Chart(barCtx, {
    type: "bar",
    data: { labels:["Positive","Neutral","Negative"], datasets:[{ label:"Count", data:[pos,neu,neg], backgroundColor:["#4CAF50","#9E9E9E","#F44336"] }] },
    options: { responsive:true, maintainAspectRatio:false }
  });

  // summary text & badges
  analysisSummary.textContent = `Analyzed ${rows.length} rows. Positive ${((pos/rows.length)*100).toFixed(1)}%, Neutral ${((neu/rows.length)*100).toFixed(1)}%, Negative ${((neg/rows.length)*100).toFixed(1)}%.`;
  statPos.textContent = `POSITIVE ${pos}`;
  statNeu.textContent = `NEUTRAL ${neu}`;
  statNeg.textContent = `NEGATIVE ${neg}`;
});

// close behaviors
closePopupBtn.addEventListener("click", () => {
  resultPopup.classList.remove("show");
  resultPopup.setAttribute("aria-hidden","true");
});
closeAnalysis.addEventListener("click", () => {
  analysisPopup.style.display = "none";
  analysisPopup.setAttribute("aria-hidden","true");
});

// ===== LIVE STOCK TICKER (unchanged logic) =====
const tickerHeadlines = document.getElementById("ticker-headlines");
const symbols = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "META", "NFLX", "NVDA", "BABA", "DIS"];

async function fetchStock(symbol) {
  try {
    const res = await fetch(`${BACKEND_BASE}/stock/${symbol}`);
    const data = await res.json();
    if (!data || data.price === null) return `<span class="stock-item">${symbol}: 🔴 N/A</span>`;
    const growthNum = Number(data.growth);
    const growthSign = growthNum > 0 ? "+" : "";
    const growthStr = `${growthSign}${Number(growthNum).toFixed(2)}%`;
    const priceStr = Number(data.price).toFixed(2);
    return `<span class="stock-item"><span class="stock-name">${symbol}</span>: <span class="stock-value">${growthNum > 0 ? "🟢" : growthNum < 0 ? "🔴" : "⚪"} ${growthStr} $${priceStr}</span></span>`;
  } catch (err) {
    console.error(`fetchStock ${symbol} error:`, err);
    return `<span class="stock-item">${symbol}: 🔴 N/A</span>`;
  }
}

let tickerX = 0, contentWidth = 0, viewportWidth = 0;
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
  if (tickerX <= -contentWidth) tickerX = viewportWidth;
  tickerHeadlines.style.transform = `translateX(${tickerX}px)`;
  requestAnimationFrame(animateTicker);
}
updateTicker().then(()=>requestAnimationFrame(animateTicker));
setInterval(updateTicker, 15000);
