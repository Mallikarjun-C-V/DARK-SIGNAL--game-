import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, VolumeX, Activity, Battery, Skull, Zap, Trophy, Target, Timer, Shield } from 'lucide-react';
import confetti from 'canvas-confetti';

// ==========================================
// 1. GAME CONSTANTS & CONFIGURATION
// ==========================================
const GRID_SIZE = 10;
const INITIAL_CHARGES = 2;
const RECHARGE_TIME = 5000;
const API_URL = 'http://localhost:5000/api';

// ==========================================
// 2. AUDIO FREQUENCIES
// ==========================================
const AUDIO_FREQS = {
  ping: [880, 440],
  step: [100, 50],
  win: [523, 659, 784, 1046],
  die: [300, 200, 100, 50],
};

export default function App() {
  // ==========================================
  // 3. GAME STATE MANAGEMENT
  // ==========================================
  const [gameState, setGameState] = useState('START');
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [playerName, setPlayerName] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);

  const [grid, setGrid] = useState([]);
  const [playerPos, setPlayerPos] = useState({ row: 1, col: 1 });
  const [monsterPos, setMonsterPos] = useState({ row: 8, col: 8 });
  const [exitPos, setExitPos] = useState({ row: 8, col: 1 });

  const [sonarActive, setSonarActive] = useState(false);
  const [sonarCharges, setSonarCharges] = useState(INITIAL_CHARGES);
  const [timeSurvived, setTimeSurvived] = useState(0);

  const [muted, setMuted] = useState(false);
  const audioCtx = useRef(null);
  const bgOscillator = useRef(null);

  // ==========================================
  // REFS TO PREVENT STALE CLOSURES
  // ==========================================
  const gridRef = useRef(grid);
  const playerPosRef = useRef(playerPos);
  const monsterPosRef = useRef(monsterPos);
  const exitPosRef = useRef(exitPos);
  const gameStateRef = useRef(gameState);
  const sonarChargesRef = useRef(sonarCharges);
  const timeSurvivedRef = useRef(timeSurvived);
  const gameEndedRef = useRef(false);

  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { playerPosRef.current = playerPos; }, [playerPos]);
  useEffect(() => { monsterPosRef.current = monsterPos; }, [monsterPos]);
  useEffect(() => { exitPosRef.current = exitPos; }, [exitPos]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { sonarChargesRef.current = sonarCharges; }, [sonarCharges]);
  useEffect(() => { timeSurvivedRef.current = timeSurvived; }, [timeSurvived]);

  // ==========================================
  // 4. BACKEND CONNECTION
  // ==========================================

  // ✅ UPDATED: saveScore now accepts isWin and sends it
  const saveScore = useCallback(async (finalTime, isWin) => {
    try {
      await fetch(`${API_URL}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player: playerName || "UNKNOWN_DROID",
          time: finalTime,
          difficulty: difficulty,
          won: isWin   // <--- NEW field
        })
      });
      fetchLeaderboard();
    } catch (error) {
      console.error("FAILED TO SAVE SCORE:", error);
    }
  }, [playerName, difficulty]);


  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/leaderboard`);
      const data = await res.json();
      setLeaderboard(data);
    } catch (error) {
      console.error("FAILED TO FETCH LEADERBOARD:", error);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // ==========================================
  // 5. AUDIO ENGINE
  // ==========================================
  const initAudio = useCallback(() => {
    if (!audioCtx.current) {
      audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.current.state === 'suspended') {
      audioCtx.current.resume();
    }
  }, []);

  const playSound = useCallback((type) => {
    if (muted || !audioCtx.current) return;

    const ctx = audioCtx.current;
    const now = ctx.currentTime;

    if (type === 'ping') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.5);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    }
    else if (type === 'step') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(100, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    }
    else if (type === 'die') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(50, now + 0.5);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    }
    else if (type === 'win') {
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'square';
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = freq;
        gain2.gain.setValueAtTime(0.1, now + i * 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.5);
        osc2.start(now + i * 0.1);
        osc2.stop(now + i * 0.1 + 0.5);
      });
    }
  }, [muted]);

  const toggleDrone = useCallback((play) => {
    if (!audioCtx.current) return;

    if (play && !bgOscillator.current && !muted) {
      const osc = audioCtx.current.createOscillator();
      const gain = audioCtx.current.createGain();

      osc.type = 'sawtooth';
      osc.frequency.value = 50;

      const filter = audioCtx.current.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 200;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.current.destination);

      gain.gain.value = 0.05;
      osc.start();
      bgOscillator.current = osc;
    }
    else if (!play && bgOscillator.current) {
      bgOscillator.current.stop();
      bgOscillator.current = null;
    }
  }, [muted]);

  // ==========================================
  // 6. LEVEL GENERATION
  // ==========================================
  const generateLevel = useCallback(() => {
    let newGrid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0));

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (Math.random() < 0.2) newGrid[row][col] = 1;
      }
    }

    newGrid[1][1] = 0;
    newGrid[1][2] = 0;
    newGrid[2][1] = 0;
    newGrid[0][1] = 0;
    newGrid[1][0] = 0;

    newGrid[8][8] = 0;
    newGrid[7][8] = 0;
    newGrid[8][7] = 0;

    const exitRow = Math.floor(Math.random() * 3) + 7;
    const exitCol = Math.floor(Math.random() * 3) + 7;
    newGrid[exitRow][exitCol] = 3;

    if (exitRow > 0) newGrid[exitRow - 1][exitCol] = 0;
    if (exitCol > 0) newGrid[exitRow][exitCol - 1] = 0;

    setExitPos({ row: exitRow, col: exitCol });
    setGrid(newGrid);
    setPlayerPos({ row: 1, col: 1 });
    setMonsterPos({ row: 8, col: 8 });
    setSonarCharges(INITIAL_CHARGES);
    setTimeSurvived(0);
    gameEndedRef.current = false;
  }, []);

  // ==========================================
  // 9. EVENT HANDLERS
  // ==========================================

  // ✅ UPDATED: send false to saveScore
  const handleGameOver = useCallback(() => {
    if (gameEndedRef.current) return;
    gameEndedRef.current = true;

    playSound('die');
    toggleDrone(false);
    saveScore(timeSurvivedRef.current, false);   // <-- UPDATED
    setGameState('GAME_OVER');
  }, [playSound, toggleDrone, saveScore]);

  // ✅ UPDATED: send true to saveScore
  const handleWin = useCallback(() => {
    if (gameEndedRef.current) return;
    gameEndedRef.current = true;

    playSound('win');
    toggleDrone(false);
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    saveScore(timeSurvivedRef.current, true);   // <-- UPDATED
    setGameState('WON');
  }, [playSound, toggleDrone, saveScore]);

  const fireSonar = useCallback(() => {
    if (sonarChargesRef.current > 0) {
      playSound('ping');
      setSonarCharges(c => c - 1);
      setSonarActive(true);
      setTimeout(() => setSonarActive(false), 1500);
    }
  }, [playSound]);

  const startGame = useCallback(() => {
    if (!playerName) return alert("Please enter your name!");
    initAudio();
    generateLevel();
    setGameState('PLAYING');
    setTimeout(() => toggleDrone(true), 100);
  }, [playerName, initAudio, generateLevel, toggleDrone]);

  // ==========================================
  // 7. GAME LOOP & AI
  // ==========================================
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const speeds = { EASY: 1200, MEDIUM: 900, HARD: 500 };
    const speed = speeds[difficulty];

    const monsterInterval = setInterval(() => {
      const currentGrid = gridRef.current;
      const currentPlayerPos = playerPosRef.current;

      if (!currentGrid || currentGrid.length === 0) return;

      setMonsterPos(prev => {
        const dRow = currentPlayerPos.row - prev.row;
        const dCol = currentPlayerPos.col - prev.col;

        let newRow = prev.row;
        let newCol = prev.col;

        if (Math.abs(dRow) > Math.abs(dCol)) {
          const tryRow = prev.row + (dRow > 0 ? 1 : -1);
          if (tryRow >= 0 && tryRow < GRID_SIZE &&
            currentGrid[tryRow] && currentGrid[tryRow][prev.col] !== 1) {
            newRow = tryRow;
          } else if (dCol !== 0) {
            const tryCol = prev.col + (dCol > 0 ? 1 : -1);
            if (tryCol >= 0 && tryCol < GRID_SIZE &&
              currentGrid[prev.row] && currentGrid[prev.row][tryCol] !== 1) {
              newCol = tryCol;
            }
          }
        } else if (dCol !== 0) {
          const tryCol = prev.col + (dCol > 0 ? 1 : -1);
          if (tryCol >= 0 && tryCol < GRID_SIZE &&
            currentGrid[prev.row] && currentGrid[prev.row][tryCol] !== 1) {
            newCol = tryCol;
          } else if (dRow !== 0) {
            const tryRow = prev.row + (dRow > 0 ? 1 : -1);
            if (tryRow >= 0 && tryRow < GRID_SIZE &&
              currentGrid[tryRow] && currentGrid[tryRow][prev.col] !== 1) {
              newRow = tryRow;
            }
          }
        }

        return { row: newRow, col: newCol };
      });
    }, speed);

    const timerInterval = setInterval(() => {
      setTimeSurvived(t => t + 1);
    }, 1000);

    const chargeInterval = setInterval(() => {
      setSonarCharges(prev => Math.min(prev + 1, INITIAL_CHARGES));
    }, RECHARGE_TIME);

    return () => {
      clearInterval(monsterInterval);
      clearInterval(timerInterval);
      clearInterval(chargeInterval);
    };
  }, [gameState, difficulty]);

  // ==========================================
  // 7.5 COLLISION DETECTION
  // ==========================================
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    if (playerPos.row === monsterPos.row && playerPos.col === monsterPos.col) {
      handleGameOver();
    }
  }, [playerPos, monsterPos, gameState, handleGameOver]);

  // ==========================================
  // 8. INPUT HANDLING
  // ==========================================
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameStateRef.current !== 'PLAYING') return;

      const currentGrid = gridRef.current;
      if (!currentGrid || currentGrid.length === 0) return;

      const currentPos = playerPosRef.current;
      const currentExitPos = exitPosRef.current;

      let newRow = currentPos.row;
      let newCol = currentPos.col;
      let moved = false;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          newRow = currentPos.row - 1;
          moved = true;
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          newRow = currentPos.row + 1;
          moved = true;
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          newCol = currentPos.col - 1;
          moved = true;
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          newCol = currentPos.col + 1;
          moved = true;
          break;
        case ' ':
          e.preventDefault();
          fireSonar();
          return;
        default:
          return;
      }

      if (!moved) return;
      e.preventDefault();

      if (newRow < 0 || newRow >= GRID_SIZE || newCol < 0 || newCol >= GRID_SIZE) {
        return;
      }

      if (!currentGrid[newRow]) {
        return;
      }

      if (currentGrid[newRow][newCol] === 1) {
        return;
      }

      setPlayerPos({ row: newRow, col: newCol });
      playSound('step');

      if (newRow === currentExitPos.row && newCol === currentExitPos.col) {
        handleWin();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fireSonar, playSound, handleWin]);


  // ==========================================
  // 10. VISIBILITY LOGIC
  // ==========================================
  const getCellClass = useCallback((row, col) => {
    if (!grid[row] || grid[row][col] === undefined) return "cell hidden-cell";

    const dist = Math.abs(row - playerPos.row) + Math.abs(col - playerPos.col);
    const content = grid[row][col];

    const isPlayer = row === playerPos.row && col === playerPos.col;
    const isMonster = row === monsterPos.row && col === monsterPos.col;

    let classes = "cell ";

    if (isPlayer) return classes + "floor player-here";

    if (isMonster && (sonarActive || dist < 2)) return classes + "monster-cube";

    if (content === 1) {
      if (sonarActive || dist < 2) return classes + "wall-cube visible";
      return classes + "hidden-cell";
    }
    else if (content === 3) {
      if (sonarActive || dist < 4) return classes + "exit-portal";
      return classes + "hidden-cell";
    }
    else {
      if (dist === 0) return classes + "floor";
      if (dist < 3) return classes + "dim-cell";
      if (sonarActive && dist < 6) return classes + "revealed-cell floor";
      return classes + "hidden-cell";
    }
  }, [grid, playerPos, monsterPos, sonarActive]);

  // ==========================================
  // 11. RENDER
  // ==========================================
  return (
    <div className="game-container">
      {/* Animated Background Particles */}
      <div className="particles">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="particle" />
        ))}
      </div>

      {/* Scanlines Effect */}
      <div className="scanlines" />

      {/* ========== START MENU ========== */}
      {gameState === 'START' && (
        <div className="start-menu glass-card">
          <h1 className="game-title">DARK SIGNAL</h1>
          <p className="game-subtitle">Navigate the darkness</p>

          {/* Name Input */}
          <div className="input-group">
            <label className="input-label">Callsign</label>
            <input
              type="text"
              placeholder="Enter your name"
              value={playerName}
              className="input-field"
              onChange={e => setPlayerName(e.target.value)}
            />
          </div>

          {/* Difficulty Selection */}
          <div className="difficulty-group">
            <label className="input-label">Difficulty</label>
            <div className="difficulty-buttons">
              {['EASY', 'MEDIUM', 'HARD'].map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`difficulty-btn ${difficulty === d ? `active ${d.toLowerCase()}` : ''}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Start Button */}
          <button onClick={startGame} className="btn-primary">
            Begin Mission
          </button>

          {/* Controls */}
          <div className="controls-help">
            <p className="controls-title">Controls</p>
            <div className="controls-grid">
              <div className="control-item">
                <span className="control-key">W A S D</span>
                <span className="control-desc">Move</span>
              </div>
              <div className="control-item">
                <span className="control-key">SPACE</span>
                <span className="control-desc">Sonar</span>
              </div>
            </div>
          </div>

          {/* Leaderboard - Fastest Winners */}
          {leaderboard.length > 0 && (
            <div className="leaderboard">
              <h3 className="leaderboard-title">
                <Trophy size={14} /> Fastest Escapes
              </h3>
              {leaderboard.slice(0, 5).map((score, i) => (
                <div key={i} className="leaderboard-item">
                  <span className="leaderboard-rank">{i + 1}</span>
                  <span className="leaderboard-name">{score.player}</span>
                  <span className="leaderboard-score">{score.time}s</span>
                  <span className="leaderboard-difficulty">{score.difficulty}</span>
                  <span className="leaderboard-badge">🏆</span>
                </div>
              ))}
            </div>
          )}

          {/* Show message if no winners yet */}
          {leaderboard.length === 0 && (
            <div className="leaderboard">
              <h3 className="leaderboard-title">
                <Trophy size={14} /> Fastest Escapes
              </h3>
              <p className="leaderboard-empty">No survivors yet. Be the first!</p>
            </div>
          )}


          {/* Leaderboard */}
          {leaderboard.length > 0 && (
            <div className="leaderboard">
              <h3 className="leaderboard-title">
                <Trophy size={14} /> Top Survivors
              </h3>
              {leaderboard.slice(0, 5).map((score, i) => (
                <div key={i} className="leaderboard-item">
                  <span className="leaderboard-rank">{i + 1}</span>
                  <span className="leaderboard-name">{score.player}</span>
                  <span className="leaderboard-score">{score.time}s</span>
                  <span className="leaderboard-difficulty">{score.difficulty}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========== HUD ========== */}
      {gameState === 'PLAYING' && (
        <div className="hud">
          {/* Left Panel - Timer */}
          <div className="hud-panel">
            <div className="hud-stat">
              <div className="hud-icon">
                <Timer size={20} />
              </div>
              <div>
                <div className="hud-value">{timeSurvived}s</div>
                <div className="hud-label">Survival Time</div>
              </div>
            </div>
          </div>

          {/* Right Panel - Sonar */}
          <div className="hud-panel hud-right">
            <div className="hud-stat">
              <div>
                <div className="hud-value">Sonar</div>
                <div className="hud-label">{sonarCharges < 2 ? 'Recharging...' : 'Ready'}</div>
              </div>
              <div className={`hud-icon ${sonarCharges === 0 ? 'warning' : ''}`}>
                <Zap size={20} />
              </div>
            </div>
            <div className="sonar-bar">
              {[...Array(INITIAL_CHARGES)].map((_, i) => (
                <div
                  key={i}
                  className={`sonar-charge ${i < sonarCharges ? 'active' :
                      i === sonarCharges ? 'charging' : ''
                    }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========== GAME WORLD ========== */}
      {gameState === 'PLAYING' && grid.length > 0 && (
        <div className="game-world">
          <div className="iso-grid">
            {/* Sonar Wave Effect */}
            {sonarActive && <div className="sonar-overlay" />}

            {/* Grid Cells */}
            {grid.map((row, rowIndex) =>
              row.map((cellValue, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={getCellClass(rowIndex, colIndex)}
                  style={{
                    top: rowIndex * 50,
                    left: colIndex * 50,
                  }}
                >
                  {/* Wall Faces */}
                  {cellValue === 1 && (sonarActive || (Math.abs(rowIndex - playerPos.row) + Math.abs(colIndex - playerPos.col)) < 2) && (
                    <>
                      <div className="face top"></div>
                      <div className="face front"></div>
                      <div className="face right"></div>
                      <div className="face left"></div>
                      <div className="face back"></div>
                    </>
                  )}
                </div>
              ))
            )}

            {/* Player */}
            <div
              className="player-model"
              style={{
                position: 'absolute',
                top: playerPos.row * 50 + 10,
                left: playerPos.col * 50 + 10,
                width: 28,
                height: 28,
                transition: 'all 0.15s ease-out',
                zIndex: 50,
              }}
            >
              <div className="player-eye"></div>
            </div>

            {/* Monster */}
            {(sonarActive || (Math.abs(monsterPos.row - playerPos.row) + Math.abs(monsterPos.col - playerPos.col)) < 2) && (
              <div
                className="monster-indicator"
                style={{
                  position: 'absolute',
                  top: monsterPos.row * 50 + 5,
                  left: monsterPos.col * 50 + 5,
                  width: 40,
                  height: 40,
                  transition: 'all 0.3s ease',
                  zIndex: 40,
                }}
              >
                <Skull className="w-full h-full text-red-500" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== END SCREEN ========== */}
      {(gameState === 'GAME_OVER' || gameState === 'WON') && (
        <div className="end-screen glass-card">
          <h2 className={`end-title ${gameState === 'WON' ? 'win' : 'lose'}`}>
            {gameState === 'WON' ? 'SIGNAL ACQUIRED' : 'SIGNAL LOST'}
          </h2>
          <p className="end-subtitle">
            {gameState === 'WON' ? 'You escaped the darkness' : 'The hunter found you'}
          </p>

          <div className="end-stats">
            <div className="end-stat">
              <div className="end-stat-value">{timeSurvived}</div>
              <div className="end-stat-label">Seconds</div>
            </div>
            <div className="end-stat">
              <div className="end-stat-value">{difficulty}</div>
              <div className="end-stat-label">Difficulty</div>
            </div>
          </div>

          

                    {/* Leaderboard - Fastest Winners */}
          {leaderboard.length > 0 && (
            <div className="leaderboard1">
              <h3 className="leaderboard-title">
                <Trophy size={14} /> Fastest Escapes
              </h3>
              {leaderboard.slice(0, 5).map((score, i) => (
                <div key={i} className="leaderboard-item">
                  <span className="leaderboard-rank">{i + 1}</span>
                  <span className="leaderboard-name">{score.player}</span>
                  <span className="leaderboard-score">{score.time}s</span>
                  <span className="leaderboard-difficulty">{score.difficulty}</span>
                  <span className="leaderboard-badge">🏆</span>
                </div>
              ))}
            </div>
          )}

          {/* Show message if no winners yet */}
          {leaderboard.length === 0 && (
            <div className="leaderboard">
              <h3 className="leaderboard-title">
                <Trophy size={14} /> Fastest Escapes
              </h3>
              <p className="leaderboard-empty">No survivors yet. Be the first!</p>
            </div>
          )}

          <button
            onClick={() => setGameState('START')}
            className="btn-restart"
          >
            Play Again
          </button>
        </div>
      )}

      {/* ========== MUTE BUTTON ========== */}
      <button
        onClick={() => setMuted(!muted)}
        className="mute-btn"
      >
        {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>
    </div>
  );
}
