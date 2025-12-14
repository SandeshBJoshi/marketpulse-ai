📊 MarketPulse AI

AI-Powered Stock Market Sentiment Analyzer

MarketPulse AI is a full-stack web application that analyzes the sentiment of stock-related textual data and visualizes the emotional pulse of the market. By combining Natural Language Processing (NLP) with interactive EDA (Exploratory Data Analysis) and live stock prices, the project helps users understand how public sentiment aligns with market movements.

This project is currently a working prototype, designed for academic demonstration and further enhancement.

🚀 Features

📁 Upload large CSV files containing stock-related sentences

🧠 NLP-based sentiment classification:

Positive

Negative

Neutral

✍️ Real-time typewriter visualization of sentiment results

📊 Dedicated EDA Analysis Panel with:

Sentiment distribution charts

Comparative visual analytics

Summary statistics

📈 Live stock price ticker (real-time market data)

⬇️ Download analyzed sentiment results as CSV

🌐 Fully deployed (Frontend + Backend)

🧠 Domain & Algorithm Used

Domain:

Artificial Intelligence

Natural Language Processing (NLP)

FinTech Analytics

Algorithm / Technique:

Rule-based Sentiment Analysis using NLP lexicon scoring

Exploratory Data Analysis (EDA) for sentiment distribution

⚠️ Note: This project does not use supervised ML models like Logistic Regression or KNN.
Sentiment is computed using NLP polarity scoring, making it lightweight and fast for real-time usage.

🏗️ System Architecture

Frontend (Vercel)
⬇ communicates via REST API
Backend (Render)
⬇ processes text & market data
APIs & NLP Engine

🛠️ Tech Stack
Frontend

HTML5

CSS3 (Glassmorphism UI)

JavaScript (Vanilla JS)

Chart.js (for EDA visualization)

Backend

Node.js

Express.js

NLP Sentiment Library

APIs

Finnhub API (Live Stock Market Data)

Deployment

Frontend: Vercel

Backend: Render

📂 Dataset

Source: Kaggle

Type: Stock-related textual sentiment data

Format: CSV

Characteristics:

Clean dataset

No missing values

Pre-structured sentences for sentiment analysis

Clean data was intentionally chosen to ensure consistent NLP polarity scoring and stable results.

📊 Model Accuracy (Important Clarification)

This project does not train a predictive ML model, so traditional accuracy metrics (like 95% accuracy) do not apply.

Instead:

Sentiment is derived using lexicon-based NLP polarity scoring

Results are deterministic and explainable

Accuracy depends on:

Text quality

Linguistic polarity

Dataset relevance

For academic purposes, correctness is validated through EDA distribution patterns rather than classification accuracy.

💡 Real-World Use Cases

Investors monitoring public sentiment before market movements

Financial analysts studying sentiment trends

Researchers analyzing text-based market psychology

Educational demos for NLP + FinTech integration

MarketPulse AI helps users understand why markets move — not just how.

🧪 How to Use

Open the deployed project

Upload a CSV file containing a “Sentence” column

Wait for sentiment analysis to complete

View results via typewriter output

Click “View Analysis” to explore EDA charts

Download processed results if needed

⏳ Note: Backend may take ~10 seconds to wake up (Render free tier).

🌐 Live Demo

Project URL:
👉 https://marketpulse-ai-two.vercel.app/

Sample Dataset:
👉 (Link provided separately / Google Drive)

🔮 Future Enhancements

Advanced transformer-based NLP models (BERT, RoBERTa)

Live Twitter / news sentiment integration

Correlation analysis between sentiment & stock price

Confidence scoring and trend prediction

User authentication and saved dashboards

👨‍💻 Author

Sandesh Joshi
AI/ML Undergraduate | Full-Stack AI Enthusiast
