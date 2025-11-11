// ===== CONFIG =====
const BACKEND_BASE = "https://marketpulse-ai-kir2.onrender.com"; // your backend
const CSV_ROW_LIMIT = 20;
const TYPEWRITER_SPEED = 25;  // ms per char (adjust to taste)
const TICKER_SPEED = 3;

// ===== MATRIX ANIMATION (kept lightweight) =====
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
  ctx.fillStyle = "rgba(0,0,0,0.11)";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = "#00fff7";
  ctx.font = fontSize + "px 'Ndot 57 Aligned'";
  for (let i=0;i<drops.length;i++){
    const t = letters.charAt(Math.floor(Math.random()*letters.length));
    ctx.fillText(t, i*fontSize, drops[i]*fontSize);
    if (drops[i]*fontSize > canvas.height && Math.random()>0.975) drops[i] = 0;
    drops[i]++;
  }
}
setInterval(drawMatrix, 33);

// ===== BACKEND SENTIMENT CALL =====
async function analyzeSentiment(text){
  try{
    const res = await fetch(`${BACKEND_BASE}/analyze-text`, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ text })
    });
    return await res.json();
  } catch(e){
    console.error("Sentiment call failed:", e);
    return null;
  }
}

// ===== DYNAMIC Chart.js LOADER =====
function loadChartJS(){
  return new Promise((resolve, reject) => {
    if (window.Chart) return resolve(window.Chart);
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js";
    s.onload = () => resolve(window.Chart);
    s.onerror = () => reject(new Error("Chart.js failed to load"));
    document.head.appendChild(s);
  });
}

// ===== RESULT POPUP BUILDERS =====
const resultPopup = document.getElementById("resultPopup");
function ensureResultPopupStructure(){
  if (resultPopup.querySelector(".popup-content")) return;
  resultPopup.innerHTML = `
    <div class="popup-content" style="display:flex;gap:18px;align-items:flex-start;">
      <div class="type-col" style="flex:1">
        <div id="typewriter" style="min-height:220px;font-family:'Courier New',monospace;color:#eafcff;padding:8px">Loading...</div>
        <div style="margin-top:12px;display:flex;gap:8px;align-items:center">
          <button id="downloadCsv" class="upload-btn" style="padding:10px 16px;font-size:0.95rem">⬇ Download Results</button>
          <button id="viewAnalysis" class="upload-btn" style="padding:10px 16px;font-size:0.95rem">🔍 View Analysis</button>
          <button id="closeResult" class="upload-btn" style="padding:10px 16px;font-size:0.95rem;background:#333;color:#fff">Close</button>
        </div>
      </div>
      <div class="eda-summary" style="width:320px">
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <div class="badge pos" id="badgePos" style="padding:8px;border-radius:999px;background:rgba(76,175,80,0.12);color:#7bf08f">Positive: 0</div>
          <div class="badge neu" id="badgeNeu" style="padding:8px;border-radius:999px;background:rgba(158,158,158,0.06);color:#ddd">Neutral: 0</div>
          <div class="badge neg" id="badgeNeg" style="padding:8px;border-radius:999px;background:rgba(244,67,54,0.06);color:#ffb3b3">Negative: 0</div>
        </div>
        <div style="margin-top:16px">
          <div style="font-size:0.9rem;color:#bfeff3">Quick insights</div>
          <div id="quickInsights" style="margin-top:10px;color:#dff;line-height:1.3">No insights yet.</div>
        </div>
      </div>
    </div>
  `;
  resultPopup.querySelector("#closeResult").addEventListener("click", ()=> resultPopup.classList.remove("show"));
}

// analysis popup (overlay)
function ensureAnalysisPopup(){
  if (document.getElementById("analysisPopup")) return;
  const a = document.createElement("div");
  a.id = "analysisPopup";
  a.innerHTML = `
    <div class="panel">
      <div class="analysis-header">
        <h3>In-depth MarketPulse EDA</h3>
        <button class="close-anal" id="closeAnal">✖</button>
      </div>
      <div class="analysis-grid">
        <div class="analysis-box">
          <canvas id="chartBar"></canvas>
        </div>
        <div class="analysis-box">
          <canvas id="chartPie"></canvas>
        </div>
        <div class="analysis-box">
          <canvas id="chartLine"></canvas>
        </div>
        <div class="analysis-box">
          <canvas id="chartDonut"></canvas>
        </div>
      </div>
      <div style="margin-top:12px;display:flex;gap:10px;align-items:center">
        <div class="stat-row">
          <div class="stat pos" id="statPos">Positive 0</div>
          <div class="stat neu" id="statNeu">Neutral 0</div>
          <div class="stat neg" id="statNeg">Negative 0</div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(a);
  a.querySelector("#closeAnal").addEventListener("click", ()=> { a.style.display = "none"; });
}

// chart instances holder
let charts = {};

// render analysis charts using parsedRows
async function renderAnalysisCharts(parsedRows){
  await loadChartJS();
  ensureAnalysisPopup();
  const ap = document.getElementById("analysisPopup");
  ap.style.display = "flex";

  const counts = { Positive:0, Neutral:0, Negative:0 };
  const timeSeries = [];
  parsedRows.forEach((r,i)=>{
    const lab = (r.sentiment || "Neutral");
    counts[lab] = (counts[lab] || 0) + 1;
    timeSeries.push({ idx: i+1, val: Number(r.score)||0 });
  });

  // Bar
  const barCtx = document.getElementById("chartBar").getContext("2d");
  if (charts.bar) charts.bar.destroy();
  charts.bar = new Chart(barCtx, {
    type: "bar",
    data: { labels:["Positive","Neutral","Negative"], datasets:[{ label:"Counts", data:[counts.Positive, counts.Neutral, counts.Negative], backgroundColor:["#4CAF50","#9E9E9E","#F44336"] }] },
    options:{responsive:true, plugins:{legend:{display:false}}}
  });

  // Pie
  const pieCtx = document.getElementById("chartPie").getContext("2d");
  if (charts.pie) charts.pie.destroy();
  charts.pie = new Chart(pieCtx, {
    type:"pie",
    data:{ labels:["Positive","Neutral","Negative"], datasets:[{ data:[counts.Positive, counts.Neutral, counts.Negative], backgroundColor:["#4CAF50","#9E9E9E","#F44336"] }] },
    options:{responsive:true}
  });

  // Line
  const lineCtx = document.getElementById("chartLine").getContext("2d");
  if (charts.line) charts.line.destroy();
  charts.line = new Chart(lineCtx, {
    type:"line",
    data:{ labels: timeSeries.map(t=>t.idx), datasets:[{ label:"Score (approx)", data: timeSeries.map(t=>t.val), fill:false, tension:0.25 }] },
    options:{responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}}}
  });

  // Donut
  const donutCtx = document.getElementById("chartDonut").getContext("2d");
  if (charts.donut) charts.donut.destroy();
  charts.donut = new Chart(donutCtx, {
    type:"doughnut",
    data:{ labels:["Positive","Negative"], datasets:[{ data: [counts.Positive, counts.Negative], backgroundColor:["#4CAF50","#F44336"] }] },
    options:{responsive:true, plugins:{legend:{position:'bottom'}}}
  });

  document.getElementById("statPos").textContent = `Positive ${counts.Positive}`;
  document.getElementById("statNeu").textContent = `Neutral ${counts.Neutral}`;
  document.getElementById("statNeg").textContent = `Negative ${counts.Negative}`;
}

// typewriter that returns parsed rows
async function typeWriterWithEda(container, lines, speed = TYPEWRITER_SPEED){
  container.textContent = "";
  const parsed = [];
  for (const line of lines){
    for (let i=0;i<line.length;i++){
      container.textContent += line[i];
      await new Promise(r => setTimeout(r, speed));
    }
    container.textContent += "\n\n";

    const labelMatch = line.match(/Sentiment:\s*(Positive|Neutral|Negative)/i);
    const pMatch = line.match(/\((\d{1,3})%\)/);
    const label = labelMatch ? (labelMatch[1][0].toUpperCase()+labelMatch[1].slice(1).toLowerCase()) : "Neutral";
    const score = pMatch ? Number(pMatch[1]) : 0;
    parsed.push({ text: line.split("\n")[0].replace(/^"/,"").replace(/"$/,""), sentiment: label, score });

    // update quick badges
    const bPos = document.getElementById("badgePos");
    const bNeu = document.getElementById("badgeNeu");
    const bNeg = document.getElementById("badgeNeg");
    if (bPos && bNeu && bNeg){
      const pos = parsed.filter(r=>r.sentiment==="Positive").length;
      const neu = parsed.filter(r=>r.sentiment==="Neutral").length;
      const neg = parsed.filter(r=>r.sentiment==="Negative").length;
      bPos.textContent = `Positive: ${pos}`;
      bNeu.textContent = `Neutral: ${neu}`;
      bNeg.textContent = `Negative: ${neg}`;
      const insights = document.getElementById("quickInsights");
      if (insights) insights.textContent = `Total analyzed: ${parsed.length} — Pos ${pos}, Neu ${neu}, Neg ${neg}`;
    }
  }
  return parsed;
}

// ===== CSV UPLOAD HANDLER & MAIN FLOW =====
const uploadLabel = document.getElementById("uploadLabel") || document.querySelector(".upload-btn");
const fileInput = document.getElementById("fileInput");
fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (uploadLabel){
    uploadLabel.textContent = "Uploaded ✓";
    uploadLabel.classList.add("uploaded");
  }

  const awaitingText = document.getElementById("awaiting");
  const analyzingText = document.getElementById("analyzing");
  if (awaitingText) awaitingText.style.display = "none";
  if (analyzingText) analyzingText.style.display = "block";

  const reader = new FileReader();
  reader.onload = async function(evt){
    const raw = evt.target.result;
    const lines = raw.split("\n").filter(l=>l.trim());
    const header = (lines[0]||"").toLowerCase();
    if (!header.includes("sentence")){
      alert("CSV must have a 'Sentence' column in header.");
      if (analyzingText) analyzingText.style.display = "none";
      if (awaitingText) awaitingText.style.display = "block";
      return;
    }
    const posts = lines.slice(1, 1+CSV_ROW_LIMIT);

    ensureResultPopupStructure();
    resultPopup.classList.add("show");
    const typewriterDiv = resultPopup.querySelector("#typewriter");
    typewriterDiv.textContent = "Loading...";

    const results = [];
    for (const line of posts){
      if (!line.trim()) continue;
      const subs = line.match(/[^.!?]+[.!?]?/g) || [line];
      const sentiments = [];
      for (const sub of subs){
        const s = await analyzeSentiment(sub);
        if (s && s.sentiment) sentiments.push(s);
      }
      let finalLabel = "Neutral", finalScore = 0;
      if (sentiments.length>0){
        const top = sentiments.reduce((a,b)=> a.score>b.score? a:b);
        finalLabel = top.sentiment;
        finalScore = top.score;
      }
      const percentScore = Math.min(Math.round(finalScore*10), 100);
      results.push(`"${line.trim()}"\n → Sentiment: ${finalLabel} (${percentScore}%)`);
    }

    if (analyzingText) analyzingText.style.display = "none";
    if (awaitingText) awaitingText.style.display = "block";

    const downloadBtn = resultPopup.querySelector("#downloadCsv");
    const viewBtn = resultPopup.querySelector("#viewAnalysis");

    downloadBtn.onclick = () => {
      if (window._lastParsedRows && window._lastParsedRows.length){
        downloadCsvFromRows(window._lastParsedRows);
      } else {
        const rows = results.map(r=>{
          const txt = r.split("\n")[0].replace(/^"/,"").replace(/"$/,"");
          const lab = (r.match(/Sentiment:\s*(Positive|Neutral|Negative)/i)||[])[1]||"Neutral";
          const sc = (r.match(/\((\d{1,3})%\)/)||[])[1]||"";
          return { text: txt, sentiment: lab, score: sc };
        });
        downloadCsvFromRows(rows);
      }
    };

    viewBtn.onclick = async () => {
      if (window._lastParsedRows && window._lastParsedRows.length){
        await renderAnalysisCharts(window._lastParsedRows);
      } else {
        const parsed = await typeWriterWithEda(typewriterDiv, results, Math.max(6, Math.floor(TYPEWRITER_SPEED/3)));
        window._lastParsedRows = parsed;
        await renderAnalysisCharts(parsed);
      }
    };

    const parsedRows = await typeWriterWithEda(typewriterDiv, results, TYPEWRITER_SPEED);
    window._lastParsedRows = parsedRows.slice();

    const qi = resultPopup.querySelector("#quickInsights");
    if (qi) qi.textContent = `Analysis ready. Click 'View Analysis' to open in-depth charts.`;
  };
  reader.readAsText(file);
});

// ===== DOWNLOAD CSV UTILITY =====
function downloadCsvFromRows(rows){
  const header = ["Sentence","Sentiment","Score"];
  const csv = [header.join(",")].concat(rows.map(r=>{
    const safe = s => `"${String(s||"").replace(/"/g,'""')}"`;
    return [safe(r.text), safe(r.sentiment), safe(r.score)].join(",");
  })).join("\n");
  const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `marketpulse_results_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ===== LIVE TICKER =====
const tickerHeadlines = document.getElementById("ticker-headlines");
const symbols = ["AAPL","GOOGL","MSFT","AMZN","TSLA","META","NFLX","NVDA","BABA","DIS"];
async function fetchStock(symbol){
  try{
    const res = await fetch(`${BACKEND_BASE}/stock/${symbol}`);
    const data = await res.json();
    if (!data || data.price === null) return `<span class="stock-item">${symbol}: 🔴 N/A</span>`;
    const growthNum = Number(data.growth);
    const growthSign = growthNum > 0 ? "+" : "";
    const growthStr = `${growthSign}${Number(growthNum).toFixed(2)}%`;
    const priceStr = Number(data.price).toFixed(2);
    return `<span class="stock-item"><span class="stock-name">${symbol}</span>: <span class="stock-value">${growthNum > 0 ? "🟢" : growthNum < 0 ? "🔴" : "⚪"} ${growthStr} $${priceStr}</span></span>`;
  } catch(e){
    return `<span class="stock-item">${symbol}: 🔴 N/A</span>`;
  }
}
let tickerX=0, contentWidth=0, viewportWidth=0;
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
