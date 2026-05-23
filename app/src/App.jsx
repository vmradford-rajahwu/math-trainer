import { useState, useEffect, useRef, useCallback } from "react";

// ── Constants ──────────────────────────────────────────────────────────────
const INSTANT_THRESHOLD = 2000; // ms — faster than this = encoded
const SLOW_THRESHOLD = 4000;    // ms — slower than this = needs heavy drill
const FACTS = [];
for (let a = 1; a <= 12; a++)
  for (let b = a; b <= 12; b++)
    FACTS.push([a, b]);

// Weight calculation: higher = more drill needed
function calcWeight(record) {
  if (!record || record.attempts === 0) return 10; // unseen = highest priority
  const { attempts, slowCount, wrongCount } = record;
  return Math.max(1, slowCount * 3 + wrongCount * 4 + Math.max(0, 5 - attempts));
}

function pickWeightedFact(gapMap) {
  const weights = FACTS.map(([a, b]) => ({
    fact: [a, b],
    weight: calcWeight(gapMap[`${a}x${b}`]),
  }));
  const total = weights.reduce((s, w) => s + w.weight, 0);
  let rand = Math.random() * total;
  for (const { fact, weight } of weights) {
    rand -= weight;
    if (rand <= 0) return fact;
  }
  return FACTS[Math.floor(Math.random() * FACTS.length)];
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow+Condensed:wght@300;400;600;700&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #0a0a0a;
    color: #e8e0d0;
    font-family: 'Barlow Condensed', sans-serif;
  }

  .trainer {
    min-height: 100vh;
    background: #0a0a0a;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px 16px;
    position: relative;
    overflow: hidden;
  }

  .trainer::before {
    content: '';
    position: fixed;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(255,255,255,0.015) 2px,
      rgba(255,255,255,0.015) 4px
    );
    pointer-events: none;
    z-index: 0;
  }

  .header {
    width: 100%;
    max-width: 480px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 32px;
    position: relative;
    z-index: 1;
  }

  .title {
    font-family: 'Share Tech Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.2em;
    color: #666;
    text-transform: uppercase;
  }

  .title span {
    color: #c8a96e;
    display: block;
    font-size: 18px;
    letter-spacing: 0.05em;
  }

  .session-info {
    font-family: 'Share Tech Mono', monospace;
    font-size: 10px;
    color: #444;
    text-align: right;
    letter-spacing: 0.1em;
  }

  .session-info b {
    color: #c8a96e;
    font-size: 16px;
    display: block;
  }

  /* ── GAP MAP ── */
  .gap-map {
    width: 100%;
    max-width: 480px;
    margin-bottom: 28px;
    position: relative;
    z-index: 1;
  }

  .gap-map-label {
    font-family: 'Share Tech Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.2em;
    color: #555;
    margin-bottom: 8px;
    text-transform: uppercase;
  }

  .gap-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 2px;
  }

  .gap-cell {
    aspect-ratio: 1;
    border-radius: 2px;
    transition: background 0.4s;
    cursor: default;
    position: relative;
  }

  .gap-cell.unseen   { background: #1e1e1e; border: 1px solid #2a2a2a; }
  .gap-cell.danger   { background: #7a1f1f; }
  .gap-cell.warning  { background: #5a4200; }
  .gap-cell.good     { background: #1a4a2a; }
  .gap-cell.encoded  { background: #0d2e1a; border: 1px solid #1a4a2a; }

  /* ── ARENA ── */
  .arena {
    width: 100%;
    max-width: 480px;
    position: relative;
    z-index: 1;
  }

  .fact-display {
    background: #111;
    border: 1px solid #222;
    border-radius: 4px;
    padding: 40px 24px 32px;
    text-align: center;
    margin-bottom: 16px;
    position: relative;
    overflow: hidden;
  }

  .fact-display::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, #c8a96e40, transparent);
  }

  .fact-question {
    font-family: 'Share Tech Mono', monospace;
    font-size: 56px;
    color: #e8e0d0;
    letter-spacing: -0.02em;
    line-height: 1;
    margin-bottom: 8px;
  }

  .fact-question .op {
    color: #c8a96e;
  }

  .fact-question .eq {
    color: #444;
  }

  .timer-bar {
    height: 2px;
    background: #1a1a1a;
    border-radius: 1px;
    margin-top: 20px;
    overflow: hidden;
  }

  .timer-fill {
    height: 100%;
    border-radius: 1px;
    transition: width 0.1s linear, background 0.3s;
  }

  .feedback-line {
    font-family: 'Share Tech Mono', monospace;
    font-size: 12px;
    letter-spacing: 0.15em;
    height: 20px;
    text-align: center;
    margin-bottom: 12px;
  }

  .feedback-line.correct  { color: #4caf7d; }
  .feedback-line.wrong    { color: #cf4444; }
  .feedback-line.slow     { color: #c8a96e; }

  /* ── INPUT ── */
  .input-row {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .answer-input {
    flex: 1;
    background: #0d0d0d;
    border: 1px solid #333;
    border-radius: 3px;
    color: #e8e0d0;
    font-family: 'Share Tech Mono', monospace;
    font-size: 32px;
    text-align: center;
    padding: 12px;
    outline: none;
    transition: border-color 0.2s;
    -moz-appearance: textfield;
  }

  .answer-input::-webkit-outer-spin-button,
  .answer-input::-webkit-inner-spin-button { -webkit-appearance: none; }

  .answer-input:focus {
    border-color: #c8a96e;
    background: #111;
  }

  .submit-btn {
    background: #c8a96e;
    border: none;
    border-radius: 3px;
    color: #0a0a0a;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 0.15em;
    padding: 0 20px;
    cursor: pointer;
    text-transform: uppercase;
    transition: background 0.15s;
  }

  .submit-btn:hover { background: #dbbf85; }
  .submit-btn:active { background: #b8944f; }

  /* ── CONTROLS ── */
  .controls {
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
  }

  .ctrl-btn {
    flex: 1;
    background: transparent;
    border: 1px solid #2a2a2a;
    border-radius: 3px;
    color: #555;
    font-family: 'Share Tech Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.15em;
    padding: 8px;
    cursor: pointer;
    text-transform: uppercase;
    transition: all 0.15s;
  }

  .ctrl-btn:hover { border-color: #444; color: #888; }
  .ctrl-btn.active { border-color: #c8a96e; color: #c8a96e; }

  /* ── STATS ── */
  .stats-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 16px;
  }

  .stat-box {
    background: #0d0d0d;
    border: 1px solid #1a1a1a;
    border-radius: 3px;
    padding: 10px 8px;
    text-align: center;
  }

  .stat-val {
    font-family: 'Share Tech Mono', monospace;
    font-size: 22px;
    color: #c8a96e;
    display: block;
    line-height: 1;
  }

  .stat-label {
    font-size: 9px;
    letter-spacing: 0.2em;
    color: #444;
    text-transform: uppercase;
    margin-top: 4px;
    display: block;
  }

  /* ── LEGEND ── */
  .legend {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-top: 8px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 9px;
    letter-spacing: 0.1em;
    color: #444;
    text-transform: uppercase;
  }

  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 1px;
  }

  /* ── MODE SCREEN ── */
  .mode-screen {
    width: 100%;
    max-width: 480px;
    position: relative;
    z-index: 1;
    text-align: center;
    padding-top: 20px;
  }

  .mode-title {
    font-family: 'Share Tech Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.3em;
    color: #555;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .mode-subtitle {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: #e8e0d0;
    margin-bottom: 32px;
  }

  .mode-btn {
    display: block;
    width: 100%;
    background: #111;
    border: 1px solid #2a2a2a;
    border-radius: 4px;
    color: #e8e0d0;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.1em;
    padding: 18px 24px;
    cursor: pointer;
    text-align: left;
    margin-bottom: 8px;
    transition: all 0.15s;
    text-transform: uppercase;
    position: relative;
    overflow: hidden;
  }

  .mode-btn::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: #c8a96e;
    transform: scaleY(0);
    transition: transform 0.15s;
  }

  .mode-btn:hover {
    border-color: #3a3a3a;
    background: #161616;
  }

  .mode-btn:hover::before { transform: scaleY(1); }

  .mode-btn-sub {
    display: block;
    font-family: 'Share Tech Mono', monospace;
    font-size: 10px;
    font-weight: 400;
    color: #555;
    letter-spacing: 0.15em;
    margin-top: 4px;
    text-transform: none;
  }

  /* ── RESULTS ── */
  .results-screen {
    width: 100%;
    max-width: 480px;
    position: relative;
    z-index: 1;
  }

  .results-header {
    font-family: 'Share Tech Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.3em;
    color: #555;
    text-transform: uppercase;
    margin-bottom: 4px;
  }

  .results-score {
    font-size: 48px;
    font-weight: 700;
    color: #c8a96e;
    margin-bottom: 24px;
  }

  .gap-list {
    background: #0d0d0d;
    border: 1px solid #1a1a1a;
    border-radius: 4px;
    padding: 16px;
    margin-bottom: 16px;
  }

  .gap-list-title {
    font-family: 'Share Tech Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.2em;
    color: #555;
    text-transform: uppercase;
    margin-bottom: 12px;
  }

  .gap-fact-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid #1a1a1a;
    font-family: 'Share Tech Mono', monospace;
    font-size: 13px;
  }

  .gap-fact-row:last-child { border-bottom: none; }

  .gap-fact-eq  { color: #e8e0d0; }
  .gap-fact-bar { height: 4px; width: 60px; background: #1a1a1a; border-radius: 2px; overflow: hidden; }
  .gap-fact-fill { height: 100%; border-radius: 2px; background: #cf4444; }

  .restart-btn {
    width: 100%;
    background: #c8a96e;
    border: none;
    border-radius: 3px;
    color: #0a0a0a;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 16px;
    letter-spacing: 0.2em;
    padding: 16px;
    cursor: pointer;
    text-transform: uppercase;
    transition: background 0.15s;
  }

  .restart-btn:hover { background: #dbbf85; }

  @keyframes flash-correct {
    0%   { background: #0d2e1a; }
    50%  { background: #1a5a35; }
    100% { background: #0d0d0d; }
  }

  @keyframes flash-wrong {
    0%   { background: #1f0d0d; }
    50%  { background: #4a1515; }
    100% { background: #0d0d0d; }
  }

  .fact-display.flash-correct { animation: flash-correct 0.4s ease; }
  .fact-display.flash-wrong   { animation: flash-wrong 0.4s ease; }
`;

// ── Component ──────────────────────────────────────────────────────────────
export default function MathTrainer() {
  const [screen, setScreen] = useState("menu"); // menu | drill | results
  const [mode, setMode] = useState("weighted"); // weighted | diagnostic | tables
  const [tableFilter, setTableFilter] = useState(null);

  // Gap map: key = "AxB", value = { attempts, slowCount, wrongCount, lastMs }
  const [gapMap, setGapMap] = useState({});

  // Session state
  const [currentFact, setCurrentFact] = useState(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState({ msg: "", type: "" });
  const [flashClass, setFlashClass] = useState("");
  const [startTime, setStartTime] = useState(null);
  const [sessionStats, setSessionStats] = useState({ correct: 0, wrong: 0, slow: 0, total: 0 });
  const [timerPct, setTimerPct] = useState(100);
  const [drillCount, setDrillCount] = useState(0);
  const SESSION_LENGTH = 30; // facts per session

  const inputRef = useRef(null);
  const timerRef = useRef(null);

  // ── Gap map helpers ──
  const getKey = (a, b) => a <= b ? `${a}x${b}` : `${b}x${a}`;

  const updateGap = useCallback((a, b, correct, ms) => {
    const key = getKey(a, b);
    setGapMap(prev => {
      const rec = prev[key] || { attempts: 0, slowCount: 0, wrongCount: 0, lastMs: null };
      return {
        ...prev,
        [key]: {
          attempts: rec.attempts + 1,
          slowCount: rec.slowCount + (!correct ? 0 : ms > INSTANT_THRESHOLD ? 1 : 0),
          wrongCount: rec.wrongCount + (correct ? 0 : 1),
          lastMs: ms,
        }
      };
    });
  }, []);

  const getCellClass = (a, b) => {
    const key = getKey(a, b);
    const rec = gapMap[key];
    if (!rec || rec.attempts === 0) return "unseen";
    const weight = calcWeight(rec);
    if (weight >= 8) return "danger";
    if (weight >= 4) return "warning";
    if (weight >= 2) return "good";
    return "encoded";
  };

  // ── Drill logic ──
  const nextFact = useCallback(() => {
    let fact;
    if (mode === "tables" && tableFilter) {
      const opts = FACTS.filter(([a, b]) => a === tableFilter || b === tableFilter);
      fact = opts[Math.floor(Math.random() * opts.length)];
    } else if (mode === "diagnostic") {
      // Cycle through unseen facts first
      const unseen = FACTS.filter(([a, b]) => !gapMap[getKey(a, b)] || gapMap[getKey(a, b)].attempts === 0);
      fact = unseen.length > 0
        ? unseen[Math.floor(Math.random() * unseen.length)]
        : pickWeightedFact(gapMap);
    } else {
      fact = pickWeightedFact(gapMap);
    }
    setCurrentFact(fact);
    setAnswer("");
    setFeedback({ msg: "", type: "" });
    setStartTime(Date.now());
    setTimerPct(100);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [mode, tableFilter, gapMap]);

  // Timer bar
  useEffect(() => {
    if (screen !== "drill" || !startTime) return;
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.max(0, 100 - (elapsed / SLOW_THRESHOLD) * 100);
      setTimerPct(pct);
    }, 80);
    return () => clearInterval(timerRef.current);
  }, [screen, startTime]);

  const submitAnswer = useCallback(() => {
    if (!currentFact || answer === "") return;
    const [a, b] = currentFact;
    const correct = parseInt(answer) === a * b;
    const ms = Date.now() - startTime;
    const slow = correct && ms > INSTANT_THRESHOLD;

    updateGap(a, b, correct, ms);
    clearInterval(timerRef.current);

    const newTotal = drillCount + 1;
    setDrillCount(newTotal);
    setSessionStats(prev => ({
      correct: prev.correct + (correct ? 1 : 0),
      wrong: prev.wrong + (correct ? 0 : 1),
      slow: prev.slow + (slow ? 1 : 0),
      total: prev.total + 1,
    }));

    if (correct && !slow) {
      setFeedback({ msg: `${ms}ms ✓`, type: "correct" });
      setFlashClass("flash-correct");
    } else if (slow) {
      setFeedback({ msg: `${(ms/1000).toFixed(1)}s — DRILL THIS`, type: "slow" });
      setFlashClass("flash-correct");
    } else {
      setFeedback({ msg: `✗  answer: ${a * b}`, type: "wrong" });
      setFlashClass("flash-wrong");
    }

    setTimeout(() => setFlashClass(""), 400);

    if (newTotal >= SESSION_LENGTH) {
      setTimeout(() => setScreen("results"), 700);
    } else {
      setTimeout(() => nextFact(), 700);
    }
  }, [currentFact, answer, startTime, drillCount, updateGap, nextFact]);

  const handleKey = (e) => {
    if (e.key === "Enter") submitAnswer();
  };

  const startSession = (m, tbl = null) => {
    setMode(m);
    setTableFilter(tbl);
    setSessionStats({ correct: 0, wrong: 0, slow: 0, total: 0 });
    setDrillCount(0);
    setScreen("drill");
    setTimeout(() => nextFact(), 100);
  };

  const timerColor = timerPct > 60 ? "#4caf7d" : timerPct > 30 ? "#c8a96e" : "#cf4444";

  // ── Gap map grid ──
  const GapGrid = () => (
    <div className="gap-map">
      <div className="gap-map-label">fact map — 2×2 through 12×12</div>
      <div className="gap-grid">
        {FACTS.map(([a, b]) => (
          <div
            key={`${a}-${b}`}
            className={`gap-cell ${getCellClass(a, b)}`}
            title={`${a}×${b}=${a*b}`}
          />
        ))}
      </div>
      <div className="legend">
        {[["unseen","#1e1e1e","unseen"],["danger","#7a1f1f","needs drill"],["warning","#5a4200","shaky"],["good","#1a4a2a","learning"],["encoded","#0d2e1a","encoded"]].map(([cls, bg, label]) => (
          <div className="legend-item" key={cls}>
            <div className="legend-dot" style={{ background: bg, border: cls === "unseen" ? "1px solid #2a2a2a" : "none" }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );

  // ── Gap list for results ──
  const topGaps = FACTS
    .map(([a, b]) => ({ a, b, weight: calcWeight(gapMap[getKey(a, b)]) }))
    .filter(x => x.weight > 3)
    .sort((x, y) => y.weight - x.weight)
    .slice(0, 8);

  return (
    <>
      <style>{styles}</style>
      <div className="trainer">
        <div className="header">
          <div className="title">
            Radiant Systems
            <span>MATH TRAINER</span>
          </div>
          <div className="session-info">
            facts seen
            <b>{Object.keys(gapMap).length}<span style={{fontSize:11,color:'#444'}}>/78</span></b>
          </div>
        </div>

        <GapGrid />

        {/* ── MENU ── */}
        {screen === "menu" && (
          <div className="mode-screen">
            <div className="mode-title">select mode</div>
            <div className="mode-subtitle">DEPLOY SESSION</div>
            <button className="mode-btn" onClick={() => startSession("weighted")}>
              Weighted Drill
              <span className="mode-btn-sub">gap facts appear more — adapts to your map</span>
            </button>
            <button className="mode-btn" onClick={() => startSession("diagnostic")}>
              Diagnostic Run
              <span className="mode-btn-sub">clear unseen facts first — builds full map</span>
            </button>
            {[2,3,4,5,6,7,8,9,10,11,12].map(n => (
              <button key={n} className="mode-btn" onClick={() => startSession("tables", n)}
                style={{ padding: "12px 24px", fontSize: 15 }}>
                {n}× Table Only
                <span className="mode-btn-sub">{n}×2 through {n}×12 — isolation drill</span>
              </button>
            ))}
          </div>
        )}

        {/* ── DRILL ── */}
        {screen === "drill" && currentFact && (
          <div className="arena">
            <div className="stats-row">
              <div className="stat-box">
                <span className="stat-val">{sessionStats.correct}</span>
                <span className="stat-label">instant</span>
              </div>
              <div className="stat-box">
                <span className="stat-val" style={{color: sessionStats.slow > 0 ? "#c8a96e" : "#c8a96e"}}>{sessionStats.slow}</span>
                <span className="stat-label">slow</span>
              </div>
              <div className="stat-box">
                <span className="stat-val" style={{color: sessionStats.wrong > 0 ? "#cf4444" : "#c8a96e"}}>{sessionStats.wrong}</span>
                <span className="stat-label">wrong</span>
              </div>
            </div>

            <div className={`fact-display ${flashClass}`}>
              <div className="fact-question">
                {currentFact[0]}
                <span className="op"> × </span>
                {currentFact[1]}
                <span className="eq"> = ?</span>
              </div>
              <div className="timer-bar">
                <div className="timer-fill" style={{ width: `${timerPct}%`, background: timerColor }} />
              </div>
            </div>

            <div className={`feedback-line ${feedback.type}`}>
              {feedback.msg || `fact ${drillCount + 1} of ${SESSION_LENGTH}`}
            </div>

            <div className="input-row">
              <input
                ref={inputRef}
                className="answer-input"
                type="number"
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                onKeyDown={handleKey}
                placeholder="—"
                min="1" max="144"
                autoFocus
              />
              <button className="submit-btn" onClick={submitAnswer}>GO</button>
            </div>

            <div className="controls">
              <button className="ctrl-btn" onClick={() => setScreen("menu")}>← menu</button>
              <button className="ctrl-btn" onClick={nextFact}>skip →</button>
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {screen === "results" && (
          <div className="results-screen">
            <div className="results-header">session complete</div>
            <div className="results-score">
              {Math.round((sessionStats.correct / SESSION_LENGTH) * 100)}%
              <span style={{fontSize:16, color:"#555", marginLeft:8, fontFamily:"'Share Tech Mono', monospace"}}>
                instant
              </span>
            </div>

            <div className="stats-row">
              <div className="stat-box">
                <span className="stat-val">{sessionStats.correct}</span>
                <span className="stat-label">encoded</span>
              </div>
              <div className="stat-box">
                <span className="stat-val" style={{color:"#c8a96e"}}>{sessionStats.slow}</span>
                <span className="stat-label">slow</span>
              </div>
              <div className="stat-box">
                <span className="stat-val" style={{color:"#cf4444"}}>{sessionStats.wrong}</span>
                <span className="stat-label">wrong</span>
              </div>
            </div>

            {topGaps.length > 0 && (
              <div className="gap-list">
                <div className="gap-list-title">priority drill list</div>
                {topGaps.map(({ a, b, weight }) => (
                  <div className="gap-fact-row" key={`${a}-${b}`}>
                    <span className="gap-fact-eq">{a} × {b} = {a*b}</span>
                    <div className="gap-fact-bar">
                      <div className="gap-fact-fill" style={{ width: `${Math.min(100, (weight / 15) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button className="restart-btn" onClick={() => setScreen("menu")}>
              new session
            </button>
          </div>
        )}
      </div>
    </>
  );
}