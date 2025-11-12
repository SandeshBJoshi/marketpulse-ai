// ===== CONFIG =====
const BACKEND_BASE = "https://marketpulse-ai-kir2.onrender.com"; // <- Render backend
const CSV_ROW_LIMIT = 20;           // how many CSV rows to analyze at once
const TYPEWRITER_SPEED = 8;        // ms per character (smaller => faster). Set low so typewriter finishes quicker.
const TICKER_SPEED = 3;             // pixels per frame (increase to speed up ticker)

// ===== MATRIX ANIMATION =====
const canvas = document.getElementById("matrix");
const ctx = canvas.getContext("2d");
function resizeCanvas() {
  canvas.height = window.innerHeight;
  canvas.width = window.innerWidth;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789@#$%^&*()*&^%";
const fontSize = 14;
let columns = Math.floor(canvas.width / fontSize);
let drops = Array(columns).fill(1);

function drawMatrix() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
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

// ===== UTILS =====
async function fetchJson(url, opts){ try{ const r = await fetch(url, opts); return await r.json(); } catch(e){ console.error("fetch error",e); return null; } }

// ===== SENTIMENT CALL =====
async function analyzeSentiment(text) {
  try {
    const response = await fetch(`${BACKEND_BASE}/analyze-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    return await response.json();
  } catch (err) {
    console.error("Sentiment call failed:", err);
    return null;
  }
}

// ===== UI refs =====
const awaitingText = document.getElementById("awaiting");
const analyzingText = document.getElementById("analyzing");
const resultPopup = document.getElementById("resultPopup");
const typewriterDiv = document.getElementById("typewriter");
const uploadBtn = document.getElementById("uploadBtn");
const fileInput = document.getElementById("fileInput");
const downloadCsvBtn = document.getElementById("downloadCsv");
const viewEdaBtn = document.getElementById("viewEdaBtn");
const closeResult = document.getElementById("closeResult");
const resultClose = document.getElementById("resultClose");

const analysisPopup = document.getElementById("analysisPopup");
const closeAnalysis = document.getElementById("closeAnalysis");
const statPos = document.getElementById("statPos");
const statNeu = document.getElementById("statNeu");
const statNeg = document.getElementById("statNeg");
const summaryText = document.getElementById("summaryText");

// EDA state
let edaCounts = { Positive: 0, Neutral: 0, Negative: 0 };
let lastParsedRows = [];

// helper to remove stray canvases (fixes top-left floating charts)
function removeStrayEdaCanvases() {
  document.querySelectorAll('canvas.eda-canvas').forEach(c => {
    // only keep ones inside analysisPopup panel
    if (!analysisPopup.contains(c)) {
      c.remove();
    }
  });
}

// ensure Chart.js is loaded
function loadChartJs() {
  return new Promise((resolve, reject) => {
    if (window.Chart) return resolve();
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Chart.js load failed"));
    document.head.appendChild(s);
  });
}

// create charts inside the provided canvas ids
let charts = [];
async function createEdaCharts(rows) {
  // rows: [{text, sentiment, score}]
  await loadChartJs();
  removeStrayEdaCanvases();

  // get counts and basic timeline (counts per row index)
  const counts = { Positive:0, Neutral:0, Negative:0 };
  const series = rows.map((r, i) => {
    counts[r.sentiment] = (counts[r.sentiment]||0)+1;
    return { idx: i+1, sentiment: r.sentiment };
  });
  edaCounts = counts;
  statPos.textContent = `Positive ${counts.Positive}`;
  statNeu.textContent = `Neutral ${counts.Neutral}`;
  statNeg.textContent = `Negative ${counts.Negative}`;
  summaryText.textContent = `Analyzed ${rows.length} rows.`;

  // destroy existing charts
  charts.forEach(c => c.destroy?.());
  charts = [];

  // chart1: pie
  const ctx1 = document.getElementById('chart1').getContext('2d');
  charts.push(new Chart(ctx1, {
    type: 'doughnut',
    data: {
      labels: ['Positive','Neutral','Negative'],
      datasets:[{ data: [counts.Positive, counts.Neutral, counts.Negative], backgroundColor: ['#4CAF50','#BDBDBD','#F44336'] }]
    },
    options: { responsive:true, maintainAspectRatio:false }
  }));

  // chart2: bar per category
  const ctx2 = document.getElementById('chart2').getContext('2d');
  charts.push(new Chart(ctx2, {
    type:'bar',
    data: { labels:['Positive','Neutral','Negative'], datasets:[{ label:'Count', data:[counts.Positive, counts.Neutral, counts.Negative], backgroundColor:['#4CAF50','#90A4AE','#F06292'] }] },
    options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true, ticks:{ stepSize:1 } } } }
  }));

  // chart3: simple timeline (sentiment index over rows)
  const ctx3 = document.getElementById('chart3').getContext('2d');
  const labels = rows.map((r,i)=>`R${i+1}`);
  const positiveSeries = rows.map(r => r.sentiment === 'Positive' ? 1 : 0);
  const neutralSeries = rows.map(r => r.sentiment === 'Neutral' ? 1 : 0);
  const negativeSeries = rows.map(r => r.sentiment === 'Negative' ? 1 : 0);
  charts.push(new Chart(ctx3, {
    type:'line',
    data:{ labels, datasets:[
      { label:'Positive', data:positiveSeries, fill:false, tension:0.2 },
      { label:'Neutral', data:neutralSeries, fill:false, tension:0.2 },
      { label:'Negative', data:negativeSeries, fill:false, tension:0.2 }
    ]},
    options:{ responsive:true, maintainAspectRatio:false }
  }));
}

// typewriter that updates EDA counts after finishing
async function typeWriter(container, lines, speed=TYPEWRITER_SPEED) {
  container.textContent = "";
  const parsedRows = [];
  for (const line of lines) {
    for (let i=0;i<line.length;i++){
      container.textContent += line[i];
      await new Promise(r => setTimeout(r, speed));
    }
    container.textContent += "\n\n";
    // parse sentiment
    const m = line.match(/Sentiment:\s*(Positive|Neutral|Negative)/i);
    const p = line.match(/\((\d{1,3})%\)/);
    const label = m ? (m[1][0].toUpperCase()+m[1].slice(1).toLowerCase()) : "Neutral";
    const score = p ? Number(p[1]) : "";
    parsedRows.push({ text: line.split('\n')[0].replace(/^"/,'').replace(/"$/,''), sentiment: label, score });
  }
  return parsedRows;
}

// download CSV utility
function downloadCsvFromRows(rows){
  const header = ['Sentence','Sentiment','Score'];
  const csv = [header.join(',')].concat(rows.map(r=>{
    const safe = s => `"${String(s||'').replace(/"/g,'""')}"`;
    return [safe(r.text), safe(r.sentiment), safe(r.score)].join(',');
  })).join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `marketpulse_results_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ===== CSV upload & analysis flow =====
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  uploadBtn.classList.add('uploaded');
  uploadBtn.textContent = '📤 Uploaded';
  awaitingText.style.display = 'none';
  analyzingText.style.display = 'block';

  const text = await file.text();
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) { alert("CSV empty or invalid."); analyzingText.style.display='none'; awaitingText.style.display='block'; return; }
  const header = lines[0].toLowerCase();
  if (!header.includes('sentence')) { alert("CSV must have a 'Sentence' column."); analyzingText.style.display='none'; awaitingText.style.display='block'; return; }

  const posts = lines.slice(1, 1 + CSV_ROW_LIMIT);
  const results = [];

  // reset eda counters
  edaCounts = { Positive:0, Neutral:0, Negative:0 };
  lastParsedRows = [];

  // analyze rows (server calls)
  for (const row of posts) {
    if (!row.trim()) continue;
    const subs = row.match(/[^.!?]+[.!?]?/g) || [row];
    const sentiList = [];
    for (const s of subs) {
      const r = await analyzeSentiment(s);
      if (r && r.sentiment) sentiList.push(r);
    }
    let finalLabel='Neutral', finalScore=0;
    if (sentiList.length>0) {
      const top = sentiList.reduce((a,b)=> a.score > b.score ? a : b);
      finalLabel = top.sentiment;
      finalScore = top.score;
    }
    const percentScore = Math.min(Math.round(finalScore*10),100);
    results.push(`"${row.trim()}"\n → Sentiment: ${finalLabel} (${percentScore}%)`);
  }

  analyzingText.style.display='none';
  awaitingText.style.display='block';

  // show typewriter popup only AFTER analysis is done
  resultPopup.classList.add('show');
  resultPopup.setAttribute('aria-hidden','false');
  // clear typewriter
  typewriterDiv.textContent = '';
  lastParsedRows = await typeWriter(typewriterDiv, results, TYPEWRITER_SPEED);

  // update counters (for quick badge display under popup)
  const counts = { Positive:0, Neutral:0, Negative:0 };
  lastParsedRows.forEach(r => counts[r.sentiment] = (counts[r.sentiment]||0)+1);
  document.querySelectorAll('.badge').forEach(el => el.remove()); // clear any old badges
  // add small badges at top-right of popup (optional)
  const badgesRow = document.createElement('div');
  badgesRow.style.position = 'absolute';
  badgesRow.style.top = '12px';
  badgesRow.style.right = '18px';
  badgesRow.style.display = 'flex';
  badgesRow.style.gap = '10px';
  badgesRow.innerHTML = `<div class="badge pos">POSITIVE: ${counts.Positive}</div><div class="badge neu">NEUTRAL: ${counts.Neutral}</div><div class="badge neg">NEGATIVE: ${counts.Negative}</div>`;
  // append once
  if (!document.querySelector('#resultPopup .badge-row')) {
    badgesRow.classList.add('badge-row');
    document.getElementById('resultPopup').appendChild(badgesRow);
  }

  // prepare EDA charts ready to view (but don't open)
  lastParsedRows = lastParsedRows; // already set
});

// download button
downloadCsvBtn.addEventListener('click', () => {
  if (lastParsedRows && lastParsedRows.length) downloadCsvFromRows(lastParsedRows);
  else alert('No results available yet.');
});

// open EDA popup
viewEdaBtn.addEventListener('click', async () => {
  if (!lastParsedRows || lastParsedRows.length === 0) {
    alert('No analysis finished yet.');
    return;
  }
  analysisPopup.style.display = 'flex';
  analysisPopup.setAttribute('aria-hidden','false');
  await createEdaCharts(lastParsedRows);
});

// close handlers
closeResult.addEventListener('click', ()=> { resultPopup.classList.remove('show'); resultPopup.setAttribute('aria-hidden','true'); });
resultClose.addEventListener('click', ()=> { resultPopup.classList.remove('show'); resultPopup.setAttribute('aria-hidden','true'); });
closeAnalysis.addEventListener('click', ()=> { analysisPopup.style.display='none'; analysisPopup.setAttribute('aria-hidden','true'); });

// ===== LIVE STOCK TICKER (unchanged) =====
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
  } catch(err){ console.error(err); return `<span class="stock-item">${symbol}: 🔴 N/A</span>`; }
}
let tickerX = 0, contentWidth = 0, viewportWidth = 0;
async function updateTicker(){
  const headlines = await Promise.all(symbols.map(fetchStock));
  tickerHeadlines.innerHTML = headlines.join(" ");
  contentWidth = tickerHeadlines.offsetWidth || 1000;
  viewportWidth = tickerHeadlines.parentElement.offsetWidth || window.innerWidth;
  tickerX = viewportWidth;
}
function animateTicker(){
  tickerX -= TICKER_SPEED;
  if (tickerX <= -contentWidth) tickerX = viewportWidth;
  tickerHeadlines.style.transform = `translateX(${tickerX}px)`;
  requestAnimationFrame(animateTicker);
}
updateTicker().then(()=>requestAnimationFrame(animateTicker));
setInterval(updateTicker, 15000);
