require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// DATABASE CONNECTION
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/darksignal';

mongoose.connect(mongoURI)
  .then(() => console.log('>> DATABASE LINKED: SYSTEM ONLINE'))
  .catch(err => console.error('>> DATABASE ERROR:', err));

// ===============================
// SCHEMA
// ===============================
const ScoreSchema = new mongoose.Schema({
  player: String,
  time: Number,
  difficulty: String,
  won: Boolean,
  date: { type: Date, default: Date.now }
});

const Score = mongoose.model('Score', ScoreSchema);

// ===============================
// SAVE SCORE
// ===============================
app.post('/api/score', async (req, res) => {
  try {
    const { player, time, difficulty, won } = req.body;

    const newScore = new Score({ player, time, difficulty, won });
    await newScore.save();

    console.log(`>> NEW RECORD: ${player} - ${time}s - won: ${won}`);
    res.status(201).json({ message: "Score Saved" });
  } catch (error) {
    res.status(500).json({ error: "Failed to save score" });
  }
});

// ===============================
// GET LEADERBOARD - WINNERS ONLY (Fastest First)
// ===============================
app.get('/api/leaderboard', async (req, res) => {
  try {
    const scores = await Score.find({ won: true })
      .sort({ time: 1 })  // Ascending = fastest first
      .limit(10);
    res.json(scores);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// ===============================
// OPTIONAL: Get all scores (for debugging)
// ===============================
app.get('/api/scores/all', async (req, res) => {
  try {
    const scores = await Score.find().sort({ date: -1 }).limit(50);
    res.json(scores);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch scores" });
  }
});

// START SERVER
app.listen(PORT, () => {
  console.log(`>> SERVER RUNNING ON PORT ${PORT}`);
});