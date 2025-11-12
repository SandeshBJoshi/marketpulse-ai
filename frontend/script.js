// ===== CONFIG =====
const BACKEND_BASE = "https://marketpulse-ai-kir2.onrender.com"; // Render backend URL
const CSV_ROW_LIMIT = 20;           // how many CSV rows to analyze at once
const TYPEWRITER_SPEED = 20;        // ms per character
const TICKER_SPEED = 3;             // pixels per frame

// ===== MATRIX ANIMATION =====
const canvas = document.getElementById("matrix");
const ctx = canvas.getContext("2d");
function resizeMatrix() {
  canvas.height = window.innerHeight;
  canvas.width = window.innerWidth;
}
resizeMatrix();
window.addEventListener("resize", resizeMatrix);

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789@#$%^&*()*&^%";
const fontSize = 14;
let columns = Math.floor(canvas.width / fontSize);
let drops = Array(columns).fill(1);
function recomputeDrops(){
  columns = Math.floor(canvas.width / fontSize);
  drops = Array(columns).fill(1);
}
window.addEventListener("resize", recomputeDrops);

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

// ===== UTILS: Load Chart.js when needed =====
function loadChartJs() {
  if (window.Chart) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Chart.js"));
    document.head.appendChild(s);
  });
}

// ===== SENTIMENT CALL =====
async function analyzeSentiment(text) {
  try {
    const response = await fetch(`${BACKEND_BASE}/analyze-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.error("Sentiment call failed:", err);
    return null;
  }
}

// ===== TYPEWRITER THAT DOES NOT AUTO OPEN EDA (user clicks View Analysis) =====
async function typeWriter(container, lines, speed = TYPEWRITER_SPEED) {
  container.textContent = "";
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      container.textContent += line[i];
      await new Promise(r => setTimeout(r, speed));
    }
    container.textContent += "\n\n";
    await new Promise(r => setTimeout(r, Math.max(25, speed)));
  }
}

// ===== UI REFS =====
const awaitingText = document.getElementById("awaiting");
const analyzingText = document.getElementById("analyzing");
const resultPopup = document.getElementById("resultPopup");
const typewriterDiv = document.getElementById("typewriter");
const uploadLabel = document.getElementById("uploadLabel");
const fileInput = document.getElementById("fileInput");
const downloadBtn = document.getElementById("downloadCsv");
const viewAnalysisBtn = document.getElementById("viewAnalysis");
const closeBtn = document.getElementById("closeBtn");
const closeResults = document.getElementById("closeResults");

const analysisPopup = document.getElementById("analysisPopup");
const closeAnal = document.getElementById("closeAnal");
const statPos = document.getElementById("statPos");
const statNeu = document.getElementById("statNeu");
const statNeg = document.getElementById("statNeg");
const summaryText = document.getElementById("summaryText");

// store parsed rows for download & charts
window._lastParsedRows = [];

// ===== CSV UPLOAD HANDLER =====
fileInput.addEventListener("change", async function (e) {
  const file = e.target.files[0];
  if (!file) return;
  // mark UI
  uploadLabel.classList.add("uploaded");
  uploadLabel.textContent = "📤 Uploaded";
  awaitingText.style.display = "none";
  analyzingText.style.display = "block";

  const reader = new FileReader();
  reader.onload = async function(event) {
    const allLines = event.target.result.split("\n");
    // remove BOM lines and blank
    const lines = allLines.filter(l => l && l.trim());
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
    window._lastParsedRows = [];
    // analyze each row
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
      results.push(`"${line.trim()}"\n → Sentiment: ${finalLabel} (${percentScore}%)`);
      window._lastParsedRows.push({ text: line.trim().replace(/^"|"$/g, ""), sentiment: finalLabel, score: percentScore });
    }

    analyzingText.style.display = "none";
    awaitingText.style.display = "block";

    // show results popup (typewriter)
    resultPopup.classList.add("show");
    resultPopup.setAttribute("aria-hidden", "false");
    typewriterDiv.textContent = "";
    await typeWriter(typewriterDiv, results, TYPEWRITER_SPEED);

    // result typed, enable view analysis
    viewAnalysisBtn.disabled = false;
    downloadBtn.disabled = false;
  };

  reader.readAsText(file);
});

// download results button
downloadBtn.addEventListener("click", () => {
  if (!window._lastParsedRows || !window._lastParsedRows.length) {
    alert("No parsed rows to download yet.");
    return;
  }
  downloadCsvFromRows(window._lastParsedRows);
});

// close / popup handlers
closeBtn.addEventListener("click", () => { resultPopup.classList.remove("show"); resultPopup.setAttribute("aria-hidden","true"); });
closeResults.addEventListener("click", () => { resultPopup.classList.remove("show"); resultPopup.setAttribute("aria-hidden","true"); });

// open analysis popup (manual — user requested)
viewAnalysisBtn.addEventListener("click", async () => {
  if (!window._lastParsedRows || !window._lastParsedRows.length) {
    alert("No analysis data available. First upload a CSV and wait for results.");
    return;
  }
  // open analysis popup and then create charts
  analysisPopup.style.display = "flex";
  analysisPopup.setAttribute("aria-hidden","false");
  // create charts (safe)
  await createEdaCharts(window._lastParsedRows);
});

// close analysis
closeAnal.addEventListener("click", () => {
  analysisPopup.style.display = "none";
  analysisPopup.setAttribute("aria-hidden","true");
});

// ===== Download CSV helper =====
function downloadCsvFromRows(rows) {
  const header = ["Sentence","Sentiment","Score"];
  const csv = [header.join(",")].concat(rows.map(r => {
    const safe = s => `"${String(s||"").replace(/"/g,'""')}"`;
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

// ===== LIVE STOCK TICKER =====
const tickerHeadlines = document.getElementById("ticker-headlines");
const symbols = ["AAPL","GOOGL","MSFT","AMZN","TSLA","META","NFLX","NVDA","BABA","DIS"];
async function fetchStock(symbol) {
  try {
    const res = await fetch(`${BACKEND_BASE}/stock/${symbol}`);
    const data = await res.json();
    if (!data || data.price === null) return `<span class="stock-item">${symbol}: 🔴 N/A</span>`;
    const growthNum = Number(data.growth || 0);
    const growthSign = growthNum > 0 ? "+" : "";
    const growthStr = `${growthSign}${Number(growthNum).toFixed(2)}%`;
    const priceStr = Number(data.price).toFixed(2);
    return `<span class="stock-item"><span class="stock-name">${symbol}</span>: <span class="stock-value">${growthNum>0?"🟢":"🔴"} ${growthStr} $${priceStr}</span></span>`;
  } catch (err) {
    return `<span class="stock-item">${symbol}: 🔴 N/A</span>`;
  }
}

let tickerX = 0, contentWidth = 0, viewportWidth = 0;
async function updateTicker() {
  const headlines = await Promise.all(symbols.map(fetchStock));
  tickerHeadlines.innerHTML = headlines.join(" ");
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

// ===== EDA CHARTS: remove stray canvases and create charts safely =====
function removeStrayEdaCanvases() {
  document.querySelectorAll('canvas').forEach(c => {
    const id = c.id || "";
    const isEda = c.classList.contains('eda-canvas') || id.startsWith('chart');
    if (isEda && !analysisPopup.contains(c)) c.remove();
  });
}
let charts = [];
async function createEdaCharts(rows) {
  await loadChartJs();
  removeStrayEdaCanvases();
  // compute counts
  const counts = { Positive:0, Neutral:0, Negative:0 };
  rows.forEach(r => { counts[r.sentiment] = (counts[r.sentiment]||0) + 1; });
  // update summary UI
  statPos.textContent = `Positive ${counts.Positive}`;
  statNeu.textContent = `Neutral ${counts.Neutral}`;
  statNeg.textContent = `Negative ${counts.Negative}`;
  summaryText.textContent = `ANALYZED ${rows.length} ROWS.`;

  // destroy old charts
  charts.forEach(c => { try{ c.destroy(); } catch(e){} });
  charts = [];

  // helper to prepare canvas size & context for high-DPI
  function prepareCanvas(id) {
    const canvas = document.getElementById(id);
    const parent = canvas.parentElement;
    const w = Math.max(150, parent.clientWidth);
    const h = Math.max(120, parent.clientHeight);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.floor(w * devicePixelRatio);
    canvas.height = Math.floor(h * devicePixelRatio);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
    return ctx;
  }

  // CHART 1 - Doughnut
  const ctx1 = prepareCanvas('chart1');
  charts.push(new Chart(ctx1.canvas.getContext('2d'), {
    type:'doughnut',
    data:{ labels:['Positive','Neutral','Negative'], datasets:[{ data:[counts.Positive, counts.Neutral, counts.Negative], backgroundColor:['#4CAF50','#90A4AE','#F44336'] }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend: { position:'bottom' } } }
  }));

  // CHART 2 - Bar
  const ctx2 = prepareCanvas('chart2');
  charts.push(new Chart(ctx2.canvas.getContext('2d'), {
    type:'bar',
    data:{ labels:['Positive','Neutral','Negative'], datasets:[{ label:'Count', data:[counts.Positive, counts.Neutral, counts.Negative], backgroundColor:['#4CAF50','#90A4AE','#F06292'] }] },
    options:{ responsive:true, maintainAspectRatio:false, scales:{ y: { beginAtZero:true, ticks:{ stepSize:1 } } } }
  }));

  // CHART 3 - Timeline
  const ctx3 = prepareCanvas('chart3');
  const labels = rows.map((r,i)=>`R${i+1}`);
  const posSeries = rows.map(r => r.sentiment === 'Positive' ? 1 : 0);
  const neuSeries = rows.map(r => r.sentiment === 'Neutral' ? 1 : 0);
  const negSeries = rows.map(r => r.sentiment === 'Negative' ? 1 : 0);
  charts.push(new Chart(ctx3.canvas.getContext('2d'), {
    type:'line',
    data:{ labels, datasets:[
      { label:'Positive', data:posSeries, borderColor:'#4CAF50', fill:false, tension:0.2 },
      { label:'Neutral', data:neuSeries, borderColor:'#90A4AE', fill:false, tension:0.2 },
      { label:'Negative', data:negSeries, borderColor:'#F44336', fill:false, tension:0.2 }
    ]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'top' } } }
  }));

  // done
}
