// ===== CONFIG =====
const BACKEND_BASE = "https://marketpulse-ai-kir2.onrender.com"; // Render backend
const CSV_ROW_LIMIT = 20;
const TYPEWRITER_SPEED = 8;   // small to speed typing (you can increase for slower)
const TICKER_SPEED = 3;

// ===== MATRIX ANIMATION =====
const canvas = document.getElementById("matrix");
const ctx = canvas.getContext("2d");
function fitCanvas(){ canvas.height = window.innerHeight; canvas.width = window.innerWidth; }
fitCanvas();
let fontSize = 14;
let letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789@#$%^&*()*&^%";
let columns = Math.floor(canvas.width / fontSize);
let drops = Array(columns).fill(1);
window.addEventListener("resize", () => { fitCanvas(); columns = Math.floor(canvas.width / fontSize); drops = Array(columns).fill(1); });

function drawMatrix(){
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = "#00fff7";
  ctx.font = `${fontSize}px 'Ndot 57 Aligned'`;
  for(let i=0;i<drops.length;i++){
    const char = letters.charAt(Math.floor(Math.random()*letters.length));
    ctx.fillText(char, i*fontSize, drops[i]*fontSize);
    if(drops[i]*fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
    drops[i]++;
  }
}
setInterval(drawMatrix, 33);

// ===== HELPERS: DOM refs =====
const uploadInput = document.getElementById("fileInput");
const uploadLabel = document.getElementById("uploadLabel");
const awaitingText = document.getElementById("awaiting");
const analyzingText = document.getElementById("analyzing");

const resultPopup = document.getElementById("resultPopup");
const typeArea = document.getElementById("typeArea");
const typewriterDiv = document.getElementById("typewriter");
const badgePos = document.getElementById("badgePos");
const badgeNeu = document.getElementById("badgeNeu");
const badgeNeg = document.getElementById("badgeNeg");

const downloadBtn = document.getElementById("downloadCsv");
const viewAnalysisBtn = document.getElementById("viewAnalysis");
const closeResultsBtn = document.getElementById("closeResults");

const analysisPopup = document.getElementById("analysisPopup");
const closeAnalysisBtn = document.getElementById("closeAnalysis");
const analysisSummary = document.getElementById("analysisSummary");
const statPos = document.getElementById("statPos");
const statNeu = document.getElementById("statNeu");
const statNeg = document.getElementById("statNeg");

// ticker
const tickerHeadlines = document.getElementById("ticker-headlines");
const symbols = ["AAPL","GOOGL","MSFT","AMZN","TSLA","META","NFLX","NVDA","BABA","DIS"];

// ===== NETWORK: call backend sentiment api =====
async function analyzeSentiment(text){
  try{
    const res = await fetch(`${BACKEND_BASE}/analyze-text`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ text })
    });
    if(!res.ok) return null;
    return await res.json();
  }catch(e){
    console.error("Sentiment call failed:", e);
    return null;
  }
}

// ===== CSV Upload flow =====
let lastParsedRows = [];         // [{text,sentiment,score}] for download + EDA
let edaCounts = { Positive:0, Neutral:0, Negative:0 };

uploadInput.addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if(!f) return;
  uploadLabel.classList.add("uploaded");
  uploadLabel.textContent = "📤 Uploaded";
  awaitingText.style.display = "none";
  analyzingText.style.display = "block";

  const text = await f.text();
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if(lines.length < 2){
    alert("CSV looks empty or invalid.");
    analyzingText.style.display = "none";
    awaitingText.style.display = "block";
    return;
  }
  const header = lines[0].toLowerCase();
  if(!header.includes("sentence")){
    alert("CSV must have a 'Sentence' column.");
    analyzingText.style.display = "none";
    awaitingText.style.display = "block";
    return;
  }

  // limit rows
  const posts = lines.slice(1, 1 + CSV_ROW_LIMIT);
  lastParsedRows = [];
  edaCounts = { Positive:0, Neutral:0, Negative:0 };

  // Run fast background analysis (do all calls) but don't auto open popup — prepare results strings
  const results = [];
  for(const line of posts){
    if(!line.trim()) continue;
    const subSentences = line.match(/[^.!?]+[.!?]?/g) || [line];
    const sentiments = [];
    for(const sub of subSentences){
      const s = await analyzeSentiment(sub);
      if(s && s.sentiment) sentiments.push(s);
    }
    let finalLabel = "Neutral", finalScore = 0;
    if(sentiments.length){
      const top = sentiments.reduce((a,b)=> a.score > b.score ? a : b);
      finalLabel = top.sentiment;
      finalScore = top.score;
    }
    const percentScore = Math.min(Math.round(finalScore * 10),100);
    results.push(`"${line.trim()}"\n → Sentiment: ${finalLabel} (${percentScore}%)`);
    // store row
    lastParsedRows.push({ text: line.trim().replace(/^"|"$/g,""), sentiment: finalLabel, score: percentScore });
    edaCounts[finalLabel] = (edaCounts[finalLabel]||0) + 1;
  }

  analyzingText.style.display = "none";
  awaitingText.style.display = "block";

  // prepare and open compact results popup (typewriter)
  openResultsPopup();
  // update summary badges initial (0 will be updated live while typing)
  updateBadges(edaCounts);

  // typewriter that updates badges live as lines are typed
  await typeWriterWithLiveEda(typewriterDiv, results);
});

// ===== Typewriter that updates EDA badges live (but does NOT open analysis popup) =====
async function typeWriterWithLiveEda(container, lines){
  container.textContent = "";
  // reset counts shown to zero, then increment as lines typed (so user sees live change)
  const running = { Positive:0, Neutral:0, Negative:0 };
  for(const line of lines){
    for(let i=0;i<line.length;i++){
      container.textContent += line[i];
      await new Promise(r => setTimeout(r, TYPEWRITER_SPEED));
    }
    container.textContent += "\n\n";
    // parse label
    const m = line.match(/Sentiment:\s*(Positive|Neutral|Negative)/i);
    const label = m ? (m[1][0].toUpperCase()+m[1].slice(1).toLowerCase()) : "Neutral";
    running[label] = (running[label]||0) + 1;
    updateBadges(running);
    await new Promise(r => setTimeout(r, Math.max(40, TYPEWRITER_SPEED)));
  }
  // final: set badges to real edaCounts (in case of tiny mismatch)
  updateBadges(edaCounts);
}

// ===== open/close UI helpers =====
function openResultsPopup(){
  resultPopup.setAttribute("aria-hidden","false");
  // scroll top of type-area
  typeArea.scrollTop = 0;
}
function closeResultsPopup(){
  resultPopup.setAttribute("aria-hidden","true");
}
function openAnalysisPopup(){
  // populate charts with lastParsedRows / edaCounts
  populateEdaCharts(lastParsedRows, edaCounts);
  analysisPopup.setAttribute("aria-hidden","false");
}
function closeAnalysisPopup(){
  analysisPopup.setAttribute("aria-hidden","true");
}

// wire buttons
closeResultsBtn.addEventListener("click", closeResultsPopup);
viewAnalysisBtn.addEventListener("click", openAnalysisPopup);
closeAnalysisBtn.addEventListener("click", closeAnalysisPopup);

// download CSV
downloadBtn.addEventListener("click", () => {
  if(!lastParsedRows || !lastParsedRows.length) return;
  downloadCsvFromRows(lastParsedRows);
});

function updateBadges(counts){
  badgePos.textContent = `Positive: ${counts.Positive||0}`;
  badgeNeu.textContent = `Neutral: ${counts.Neutral||0}`;
  badgeNeg.textContent = `Negative: ${counts.Negative||0}`;
  // also update summary inside analysis popup
  if(analysisSummary) analysisSummary.textContent = `ANALYZED ${ (counts.Positive||0) + (counts.Neutral||0) + (counts.Negative||0) } ROWS.`;
  statPos.textContent = `POSITIVE ${counts.Positive||0}`;
  statNeu.textContent = `NEUTRAL ${counts.Neutral||0}`;
  statNeg.textContent = `NEGATIVE ${counts.Negative||0}`;
}

// download util
function downloadCsvFromRows(rows){
  const header = ["Sentence","Sentiment","Score"];
  const csv = [header.join(",")].concat(rows.map(r => {
    const esc = s => `"${String(s||"").replace(/"/g,'""')}"`;
    return [esc(r.text), esc(r.sentiment), esc(r.score)].join(",");
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

// ===== EDA: Chart.js creation =====
let donutChart=null, barChart=null, lineChart=null;

function resetCharts(){
  if(donutChart){ donutChart.destroy(); donutChart = null; }
  if(barChart){ barChart.destroy(); barChart = null; }
  if(lineChart){ lineChart.destroy(); lineChart = null; }
}

function populateEdaCharts(rows, counts){
  // rows: [{text,sentiment,score}], counts: {Positive,Neutral,Negative}
  resetCharts();

  // donut
  const dCtx = document.getElementById("chartDonut").getContext("2d");
  donutChart = new Chart(dCtx, {
    type:'doughnut',
    data:{
      labels:['Positive','Neutral','Negative'],
      datasets:[{
        data: [counts.Positive||0, counts.Neutral||0, counts.Negative||0],
        backgroundColor: ['#33cc66','#bfc9cc','#ff6b6b'],
        borderColor: 'rgba(0,0,0,0.2)',
        borderWidth:2
      }]
    },
    options:{
      responsive:true,
      plugins:{ legend:{ position:'bottom', labels:{ color:'#bfeef7' } } },
      cutout: '62%'
    }
  });

  // bar
  const bCtx = document.getElementById("chartBar").getContext("2d");
  barChart = new Chart(bCtx, {
    type:'bar',
    data:{
      labels:['Positive','Neutral','Negative'],
      datasets:[{
        label:'Count',
        data: [counts.Positive||0, counts.Neutral||0, counts.Negative||0],
        backgroundColor:['#33cc66','#bfc9cc','#ff6b6b']
      }]
    },
    options:{
      responsive:true,
      plugins:{ legend:{ display:false } },
      scales:{ x:{ ticks:{ color:'#bfeef7' } }, y:{ ticks:{ color:'#bfeef7' }, beginAtZero:true } }
    }
  });

  // line: show per-row (R1..Rk) a small binary mapping per sentiment so user sees distribution
  const lineLabels = rows.map((r,i)=> `R${i+1}`);
  const posSeries = rows.map(r => r.sentiment === 'Positive' ? 1 : 0);
  const neuSeries = rows.map(r => r.sentiment === 'Neutral' ? 1 : 0);
  const negSeries = rows.map(r => r.sentiment === 'Negative' ? 1 : 0);

  const lCtx = document.getElementById("chartLine").getContext("2d");
  lineChart = new Chart(lCtx, {
    type:'line',
    data:{
      labels: lineLabels,
      datasets:[
        { label:'Positive', data: posSeries, borderColor:'#33cc66', backgroundColor:'rgba(51,204,102,0.08)', fill:false, tension:0.2, pointRadius:4 },
        { label:'Neutral', data: neuSeries, borderColor:'#bfc9cc', backgroundColor:'rgba(191,201,204,0.06)', fill:false, tension:0.2, pointRadius:4 },
        { label:'Negative', data: negSeries, borderColor:'#ff6b6b', backgroundColor:'rgba(255,107,107,0.06)', fill:false, tension:0.2, pointRadius:4 }
      ]
    },
    options:{
      responsive:true,
      plugins:{ legend:{ labels:{ color:'#bfeef7' } } },
      scales:{ x:{ ticks:{ color:'#bfeef7' } }, y:{ ticks:{ color:'#bfeef7' }, min:0, max:1 } }
    }
  });

  // update analysis summary text
  const total = (counts.Positive||0)+(counts.Neutral||0)+(counts.Negative||0);
  document.getElementById("analysisSummary").textContent = `ANALYZED ${total} ROWS.`;

  // ensure panel scroll in view
  setTimeout(()=> {
    const panel = document.querySelector("#analysisPopup .panel");
    if(panel) panel.scrollTop = 0;
  }, 50);
}

// ===== LIVE STOCK TICKER (calls backend) =====
async function fetchStock(symbol){
  try{
    const res = await fetch(`${BACKEND_BASE}/stock/${symbol}`);
    if(!res.ok) return `${symbol}: 🔴 N/A`;
    const data = await res.json();
    if(!data || data.price === null) return `<span class="stock-item">${symbol}: 🔴 N/A</span>`;
    const growthNum = Number(data.growth);
    const growthSign = growthNum > 0 ? '+' : '';
    const growthStr = `${growthSign}${Number(growthNum).toFixed(2)}%`;
    const priceStr = Number(data.price).toFixed(2);
    return `<span class="stock-item"><span class="stock-name">${symbol}</span>: <span class="stock-value">${growthNum>0?'🟢':'🔴'} ${growthStr} $${priceStr}</span></span>`;
  }catch(e){
    return `<span class="stock-item">${symbol}: 🔴 N/A</span>`;
  }
}
let tickerX = 0, contentWidth = 0, viewportWidth = 0;
async function updateTicker(){
  const items = await Promise.all(symbols.map(fetchStock));
  tickerHeadlines.innerHTML = items.join(" ");
  contentWidth = tickerHeadlines.offsetWidth || 1000;
  viewportWidth = tickerHeadlines.parentElement.offsetWidth || window.innerWidth;
  tickerX = viewportWidth;
}
function animateTicker(){
  tickerX -= TICKER_SPEED;
  if(tickerX <= -contentWidth) tickerX = viewportWidth;
  tickerHeadlines.style.transform = `translateX(${tickerX}px)`;
  requestAnimationFrame(animateTicker);
}
updateTicker().then(()=> requestAnimationFrame(animateTicker));
setInterval(updateTicker, 15000);

// ===== initial wiring =====
document.addEventListener("DOMContentLoaded", ()=> {
  // Ensure popups are hidden
  resultPopup.setAttribute("aria-hidden","true");
  analysisPopup.setAttribute("aria-hidden","true");
});
