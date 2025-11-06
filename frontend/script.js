// ===== MATRIX ANIMATION =====
const canvas = document.getElementById("matrix");
const ctx = canvas.getContext("2d");
canvas.height = window.innerHeight;
canvas.width = window.innerWidth;

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789@#$%^&*()*&^%";
const fontSize = 14;
const columns = canvas.width / fontSize;
const drops = Array(Math.floor(columns)).fill(1);

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
  const response = await fetch("http://localhost:5000/analyze-text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
  const result = await response.json();
  return result;
}

async function typeWriter(container, lines, speed = 30) {
  container.textContent = "";
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      container.textContent += line[i];
      await new Promise(r => setTimeout(r, speed));
    }
    container.textContent += "\n\n";
    await new Promise(r => setTimeout(r, speed));
  }
}

const awaitingText = document.getElementById("awaiting");
const analyzingText = document.getElementById("analyzing");
const resultPopup = document.getElementById("resultPopup");
const typewriterDiv = document.getElementById("typewriter");

document.getElementById("fileInput").addEventListener("change", async function (e) {
  const file = e.target.files[0];
  const reader = new FileReader();

  awaitingText.style.display = "none";
  analyzingText.style.display = "block";

  reader.onload = async function (event) {
    const lines = event.target.result.split("\n");
    const header = lines[0].toLowerCase();
    if (!header.includes("sentence")) {
      alert("CSV must have a 'Sentence' column.");
      analyzingText.style.display = "none";
      awaitingText.style.display = "block";
      return;
    }

    const posts = lines.slice(1, 21);
    const results = [];

    for (const line of posts) {
      if (line.trim() === "") continue;

      const subSentences = line.match(/[^.!?]+[.!?]?/g) || [line];
      const sentiments = [];
      for (const sub of subSentences) {
        const sentiment = await analyzeSentiment(sub);
        if (sentiment && sentiment.sentiment) sentiments.push(sentiment);
      }

      let finalLabel = "Neutral", finalScore = 0;
      if (sentiments.length > 0) {
        const top = sentiments.reduce((a, b) => (a.score > b.score ? a : b));
        finalLabel = top.sentiment;
        finalScore = top.score;
      }

      // Convert score to percentage
      const percentScore = Math.min(Math.round(finalScore * 10), 100);

      results.push(`"${line.trim()}"\n → Sentiment: ${finalLabel} (${percentScore}%)`);
    }

    analyzingText.style.display = "none";
    awaitingText.style.display = "block";

    resultPopup.classList.add("show");
    await typeWriter(typewriterDiv, results, 50);
  };

  reader.readAsText(file);
});

// ===== LIVE STOCK TICKER =====
const tickerHeadlines = document.getElementById("ticker-headlines");
const symbols = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "META", "NFLX", "NVDA", "BABA", "DIS"];

// Fetch only price and growth, remove sentiment
async function fetchStock(symbol) {
  try {
    const res = await fetch(`http://localhost:5000/stock/${symbol}`);
    const data = await res.json();

    if (!data || data.price === null) 
      return `<span class="stock-item">${symbol}: 🔴 N/A</span>`;

    return `<span class="stock-item">
      <span class="stock-name">${symbol}</span>: 
      <span class="stock-value">
        ${data.growth > 0 ? "🟢 +" : "🔴 "}${data.growth}% 
        $${data.price}
      </span>
    </span>`;
  } catch (err) {
    return `<span class="stock-item">${symbol}: 🔴 N/A</span>`;
  }
}

// Smooth scrolling ticker using translateX
let tickerX = tickerHeadlines.offsetWidth;
const tickerSpeed = 2; // pixels per frame

async function updateTicker() {
  const headlines = await Promise.all(symbols.map(fetchStock));
  tickerHeadlines.innerHTML = headlines.join(" ");
  tickerX = tickerHeadlines.offsetWidth; // reset position
}

function animateTicker() {
  tickerX -= tickerSpeed;
  if (tickerX <= -tickerHeadlines.offsetWidth) tickerX = tickerHeadlines.offsetWidth;
  tickerHeadlines.style.transform = `translateX(${tickerX}px)`;
  requestAnimationFrame(animateTicker);
}

updateTicker().then(() => requestAnimationFrame(animateTicker));
setInterval(updateTicker, 15000); // refresh every 15s
