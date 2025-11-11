// ===== CONFIG =====
const BACKEND_BASE = "https://marketpulse-ai-kir2.onrender.com"; // Render backend
const CSV_ROW_LIMIT = 20;           // how many CSV rows to analyze at once
const TYPEWRITER_SPEED = 10;        // ms per character (smaller => faster)
const TICKER_SPEED = 3;             // pixels per frame (increase to speed up ticker)

// ===== MATRIX =====
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

// ===== UTIL: Chart.js loader =====
function loadChartJS() {
  return new Promise((resolve, reject) => {
    if (window.Chart) return resolve(window.Chart);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    s.onload = () => resolve(window.Chart);
    s.onerror = () => reject(new Error('Chart.js failed to load'));
    document.head.appendChild(s);
  });
}

// ===== SENTIMENT CALL =====
async function analyzeSentiment(text) {
  try {
    const res = await fetch(`${BACKEND_BASE}/analyze-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    return await res.json();
  } catch (err) {
    console.error("Sentiment call failed:", err);
    return null;
  }
}

// ===== UI REFS =====
const uploadLabel = document.getElementById('uploadLabel');
const fileInput = document.getElementById('fileInput');
const awaitingText = document.getElementById('awaiting');
const analyzingText = document.getElementById('analyzing');

const resultPopup = document.getElementById('resultPopup');
const closeResult = document.getElementById('closeResult');
const closeResult2 = document.getElementById('closeResult2');
const typewriterDiv = document.getElementById('typewriter');

const miniPos = document.getElementById('miniPos');
const miniNeu = document.getElementById('miniNeu');
const miniNeg = document.getElementById('miniNeg');
const downloadResultsBtn = document.getElementById('downloadResults');
const viewAnalysisBtn = document.getElementById('viewAnalysis');

const analysisPopup = document.getElementById('analysisPopup');
const closeAnalysis = document.getElementById('closeAnalysis');

// EDA data container
let edaCounts = { Positive: 0, Neutral: 0, Negative: 0 };
let parsedRowsGlobal = [];
let charts = {};

// ===== CSV Upload handler =====
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // UI: mark uploaded, show analyzing
  uploadLabel.classList.add('uploaded');
  uploadLabel.textContent = '📤 Uploaded';
  awaitingText.style.display = 'none';
  analyzingText.style.display = 'block';

  const reader = new FileReader();
  reader.onload = async function(event) {
    const lines = event.target.result.split('\n').map(l=>l.trim()).filter(Boolean);
    if (lines.length < 2) {
      alert('CSV looks empty or invalid.');
      resetStatus();
      return;
    }
    const header = lines[0].toLowerCase();
    if (!header.includes('sentence')) {
      alert("CSV must have a 'Sentence' column in the header.");
      resetStatus();
      return;
    }

    // prepare rows
    const posts = lines.slice(1, 1 + CSV_ROW_LIMIT);
    parsedRowsGlobal = [];
    edaCounts = { Positive: 0, Neutral: 0, Negative: 0 };
    typewriterDiv.textContent = '';

    // analyze rows (this may take some time)
    const results = [];
    for (const line of posts) {
      if (!line) continue;
      const subs = line.match(/[^.!?]+[.!?]?/g) || [line];
      const sentiments = [];
      for (const s of subs) {
        const res = await analyzeSentiment(s);
        if (res && res.sentiment) sentiments.push(res);
      }
      let finalLabel = 'Neutral', finalScore = 0;
      if (sentiments.length>0) {
        const top = sentiments.reduce((a,b)=> a.score > b.score ? a : b);
        finalLabel = top.sentiment;
        finalScore = top.score;
      }
      const percent = Math.min(Math.round(finalScore * 10), 100);
      results.push(`"${line}"\n → Sentiment: ${finalLabel} (${percent}%)`);
    }

    // Analysis prepared; hide analyzing text and show popup then type
    analyzingText.style.display = 'none';
    awaitingText.style.display = 'block';

    // open popup only now
    openResultsPopup();

    // type results while updating EDA
    parsedRowsGlobal = await typeWriterAndUpdateEDA(typewriterDiv, results, TYPEWRITER_SPEED);

    // ensure badges updated
    updateMiniBadges();
  };

  reader.readAsText(file);
});

function resetStatus() {
  uploadLabel.classList.remove('uploaded');
  uploadLabel.textContent = '📤 Upload CSV File';
  analyzingText.style.display = 'none';
  awaitingText.style.display = 'block';
}

function openResultsPopup(){
  resultPopup.classList.add('show');
  resultPopup.setAttribute('aria-hidden','false');
  // scroll top to start
  const area = document.querySelector('.typewriter-area');
  if (area) area.scrollTop = 0;
}
function closeResultsPopup(){
  resultPopup.classList.remove('show');
  resultPopup.setAttribute('aria-hidden','true');
}

// close handlers
closeResult.addEventListener('click', closeResultsPopup);
closeResult2.addEventListener('click', closeResultsPopup);

// Download button
downloadResultsBtn.addEventListener('click', ()=>{
  if (!parsedRowsGlobal || parsedRowsGlobal.length===0) return alert('No results available yet.');
  downloadCsvFromRows(parsedRowsGlobal);
});

// View Analysis
viewAnalysisBtn.addEventListener('click', async ()=>{
  analysisPopup.classList.add('show');
  analysisPopup.setAttribute('aria-hidden','false');
  await showAnalysisCharts();
});

// close analysis
closeAnalysis.addEventListener('click', ()=>{
  analysisPopup.classList.remove('show');
  analysisPopup.setAttribute('aria-hidden','true');
});

// ===== Typewriter + live EDA update (fast) =====
async function typeWriterAndUpdateEDA(container, lines, speed=10) {
  container.textContent = '';
  const parsedRows = [];
  for (const line of lines) {
    for (let i=0;i<line.length;i++){
      container.textContent += line[i];
      await new Promise(r=>setTimeout(r, speed));
    }
    container.textContent += '\n\n';

    const m = line.match(/Sentiment:\s*(Positive|Neutral|Negative)/i);
    const p = line.match(/\((\d{1,3})%\)/);
    const label = m ? (m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()) : 'Neutral';
    const score = p ? Number(p[1]) : '';

    edaCounts[label] = (edaCounts[label] || 0) + 1;
    parsedRows.push({ text: line.split('\n')[0].replace(/^"/,'').replace(/"$/,''), sentiment: label, score });

    updateMiniBadges();

    // auto-scroll as content grows
    container.scrollTop = container.scrollHeight;
    await new Promise(r=>setTimeout(r, Math.max(6, speed)));
  }
  return parsedRows;
}

function updateMiniBadges() {
  miniPos.textContent = `Positive: ${edaCounts.Positive||0}`;
  miniNeu.textContent = `Neutral: ${edaCounts.Neutral||0}`;
  miniNeg.textContent = `Negative: ${edaCounts.Negative||0}`;

  const sp = document.getElementById('statPos'), sn = document.getElementById('statNeu'), sg = document.getElementById('statNeg');
  if (sp) sp.textContent = `POSITIVE ${edaCounts.Positive||0}`;
  if (sn) sn.textContent = `NEUTRAL ${edaCounts.Neutral||0}`;
  if (sg) sg.textContent = `NEGATIVE ${edaCounts.Negative||0}`;
}

// ===== Download CSV util =====
function downloadCsvFromRows(rows){
  const header = ['Sentence','Sentiment','Score'];
  const csv = [header.join(',')].concat(rows.map(r=>{
    const safe = s=>`"${String(s||'').replace(/"/g,'""')}"`;
    return [safe(r.text), safe(r.sentiment), safe(r.score)].join(',');
  })).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `marketpulse_results_${Date.now()}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// ===== Analysis charts =====
async function showAnalysisCharts(){
  try {
    await loadChartJS();
  } catch (err) {
    console.error('Chart.js failed', err);
    return;
  }
  const pos = edaCounts.Positive || 0;
  const neu = edaCounts.Neutral  || 0;
  const neg = edaCounts.Negative || 0;
  const total = pos + neu + neg || 1;

  const summary = document.getElementById('summaryText');
  if (summary) summary.textContent = `Analyzed ${pos+neu+neg} rows. Positive ${(pos/total*100).toFixed(1)}%, Neutral ${(neu/total*100).toFixed(1)}%, Negative ${(neg/total*100).toFixed(1)}%.`;

  // BAR
  const ctxBar = document.getElementById('chartBar').getContext('2d');
  if (charts.bar) { charts.bar.data.datasets[0].data = [pos, neu, neg]; charts.bar.update(); }
  else {
    charts.bar = new Chart(ctxBar, {
      type: 'bar',
      data: { labels: ['Positive','Neutral','Negative'], datasets:[{ label:'Counts', data:[pos,neu,neg], backgroundColor:['#4CAF50','#9E9E9E','#F44336'] }]},
      options: { responsive:true, plugins:{legend:{display:false}}}
    });
  }

  // DOUGHNUT
  const ctxD = document.getElementById('chartDoughnut').getContext('2d');
  if (charts.doughnut) { charts.doughnut.data.datasets[0].data = [pos,neu,neg]; charts.doughnut.update(); }
  else {
    charts.doughnut = new Chart(ctxD, {
      type: 'doughnut',
      data: { labels:['Positive','Neutral','Negative'], datasets:[{ data:[pos,neu,neg], backgroundColor:['#4CAF50','#9E9E9E','#F44336'] }]},
      options: { responsive:true, plugins:{legend:{position:'bottom'}}}
    });
  }

  // LINE (cumulative)
  const ctxL = document.getElementById('chartLine').getContext('2d');
  const cumulative = [];
  let cPos=0,cNeu=0,cNeg=0;
  const labels = [];
  for (let i=0;i<parsedRowsGlobal.length;i++){
    const r = parsedRowsGlobal[i];
    if (!r) continue;
    if (r.sentiment==='Positive') cPos++;
    else if (r.sentiment==='Neutral') cNeu++;
    else if (r.sentiment==='Negative') cNeg++;
    labels.push(i+1);
    cumulative.push({ pos:cPos, neu:cNeu, neg:cNeg });
  }
  const dsPos = cumulative.map(x=>x.pos);
  const dsNeu = cumulative.map(x=>x.neu);
  const dsNeg = cumulative.map(x=>x.neg);

  if (charts.line) {
    charts.line.data.labels = labels;
    charts.line.data.datasets[0].data = dsPos;
    charts.line.data.datasets[1].data = dsNeu;
    charts.line.data.datasets[2].data = dsNeg;
    charts.line.update();
  } else {
    charts.line = new Chart(ctxL, {
      type: 'line',
      data: {
        labels,
        datasets:[
          { label:'Positive', data:dsPos, borderColor:'#4CAF50', fill:false, tension:0.2 },
          { label:'Neutral', data:dsNeu, borderColor:'#9E9E9E', fill:false, tension:0.2 },
          { label:'Negative', data:dsNeg, borderColor:'#F44336', fill:false, tension:0.2 }
        ]
      },
      options: { responsive:true, plugins:{legend:{position:'bottom'}} }
    });
  }

  updateMiniBadges();
}

// ===== LIVE STOCK TICKER (unchanged behavior) =====
const tickerHeadlines = document.getElementById('ticker-headlines');
const symbols = ["AAPL","GOOGL","MSFT","AMZN","TSLA","META","NFLX","NVDA","BABA","DIS"];

async function fetchStock(symbol) {
  try {
    const res = await fetch(`${BACKEND_BASE}/stock/${symbol}`);
    const data = await res.json();
    if (!data || data.price === null) {
      return `<span class="stock-item">${symbol}: 🔴 N/A</span>`;
    }
    const growthNum = Number(data.growth) || 0;
    const growthSign = growthNum > 0 ? "+" : "";
    const growthStr = `${growthSign}${Number(growthNum).toFixed(2)}%`;
    const priceStr = Number(data.price).toFixed(2);
    return `<span class="stock-item"><span class="stock-name">${symbol}</span>: <span class="stock-value">${growthNum>0?"🟢":growthNum<0?"🔴":"⚪"} ${growthStr} $${priceStr}</span></span>`;
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
