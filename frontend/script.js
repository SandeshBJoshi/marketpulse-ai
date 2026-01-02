// ===== CONFIG =====
const BACKEND_BASE = "https://marketpulse-ai-kir2.onrender.com";
const CSV_ROW_LIMIT = 20;
const TYPEWRITER_SPEED = 20;
const TICKER_SPEED = 3;

// ===== MATRIX =====
const canvas = document.getElementById("matrix");
const ctx = canvas.getContext("2d");

function resizeMatrix() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeMatrix();
window.addEventListener("resize", resizeMatrix);

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789@#$%^&*()*&^%";
const fontSize = 14;
let drops = Array(Math.floor(canvas.width / fontSize)).fill(1);

function drawMatrix() {
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#00fff7";
  ctx.font = fontSize + "px 'Ndot 57 Aligned'";
  drops.forEach((y, i) => {
    ctx.fillText(
      letters[Math.floor(Math.random() * letters.length)],
      i * fontSize,
      y * fontSize
    );
    drops[i] = y * fontSize > canvas.height && Math.random() > 0.975 ? 0 : y + 1;
  });
}
setInterval(drawMatrix, 33);

// ===== UI REFS =====
const uploadLabel = document.getElementById("uploadLabel");
const fileInput = document.getElementById("fileInput");
const awaitingText = document.getElementById("awaiting");
const analyzingText = document.getElementById("analyzing");

const actionPanel = document.getElementById("actionPanel");
const openSentimentBtn = document.getElementById("openSentiment");
const openEDABtn = document.getElementById("openEDA");

const resultPopup = document.getElementById("resultPopup");
const analysisPopup = document.getElementById("analysisPopup");

const closeResults = document.getElementById("closeResults");
const closeBtn = document.getElementById("closeBtn");
const closeAnal = document.getElementById("closeAnal");

const typewriterDiv = document.getElementById("typewriter");
const downloadBtn = document.getElementById("downloadCsv");

const statPos = document.getElementById("statPos");
const statNeu = document.getElementById("statNeu");
const statNeg = document.getElementById("statNeg");
const summaryText = document.getElementById("summaryText");

// ===== GLOBAL DATA =====
let parsedRows = [];
let charts = [];

// ===== SENTIMENT API =====
async function analyzeSentiment(text) {
  const res = await fetch(`${BACKEND_BASE}/analyze-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
  return res.ok ? res.json() : null;
}

// ===== TYPEWRITER =====
async function typeWriter(lines) {
  typewriterDiv.textContent = "";
  for (const line of lines) {
    for (let ch of line) {
      typewriterDiv.textContent += ch;
      await new Promise(r => setTimeout(r, TYPEWRITER_SPEED));
    }
    typewriterDiv.textContent += "\n\n";
  }
}

// ===== CSV UPLOAD =====
fileInput.addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;

  uploadLabel.textContent = "📤 Uploaded";
  uploadLabel.classList.add("uploaded");
  awaitingText.style.display = "none";
  analyzingText.style.display = "block";

  const reader = new FileReader();
  reader.onload = async evt => {
    const lines = evt.target.result.split("\n").filter(l => l.trim());
    const dataLines = lines.slice(1, CSV_ROW_LIMIT + 1);

    parsedRows = [];
    const displayLines = [];

    for (const line of dataLines) {
      const res = await analyzeSentiment(line);
      if (!res) continue;
      parsedRows.push({ text: line, sentiment: res.sentiment });
      displayLines.push(`"${line}"\n → Sentiment: ${res.sentiment}`);
    }

    analyzingText.style.display = "none";
    awaitingText.style.display = "block";

    // ENABLE NEXT ACTIONS
    actionPanel.style.display = "flex";
    openSentimentBtn.disabled = false;
    openEDABtn.disabled = false;
    downloadBtn.disabled = false;

    // PREPARE TYPEWRITER CONTENT
    openSentimentBtn.onclick = async () => {
      resultPopup.classList.add("show");
      await typeWriter(displayLines);
    };
  };
  reader.readAsText(file);
});

// ===== CLOSE BUTTONS =====
closeResults.onclick = closeBtn.onclick = () =>
  resultPopup.classList.remove("show");

closeAnal.onclick = () =>
  analysisPopup.style.display = "none";

// ===== LOAD CHART.JS =====
function loadChartJs() {
  if (window.Chart) return Promise.resolve();
  return new Promise(resolve => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js";
    s.onload = resolve;
    document.head.appendChild(s);
  });
}

// ===== EDA =====
openEDABtn.onclick = async () => {
  analysisPopup.style.display = "flex";
  await loadChartJs();

  const counts = { Positive: 0, Neutral: 0, Negative: 0 };
  parsedRows.forEach(r => counts[r.sentiment]++);

  statPos.textContent = `Positive ${counts.Positive}`;
  statNeu.textContent = `Neutral ${counts.Neutral}`;
  statNeg.textContent = `Negative ${counts.Negative}`;
  summaryText.textContent = `ANALYZED ${parsedRows.length} ROWS`;

  charts.forEach(c => c.destroy());
  charts = [];

  charts.push(new Chart(chart1, {
    type: "doughnut",
    data: {
      labels: Object.keys(counts),
      datasets: [{ data: Object.values(counts) }]
    }
  }));

  charts.push(new Chart(chart2, {
    type: "bar",
    data: {
      labels: Object.keys(counts),
      datasets: [{ data: Object.values(counts) }]
    }
  }));

  charts.push(new Chart(chart3, {
    type: "line",
    data: {
      labels: parsedRows.map((_, i) => `Row ${i + 1}`),
      datasets: [{
        label: "Sentiment Trend",
        data: parsedRows.map(r =>
          r.sentiment === "Positive" ? 1 : r.sentiment === "Negative" ? -1 : 0
        )
      }]
    }
  }));
};
