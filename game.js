// --- TETRIS GAME ENGINE ---

// Board parameters
const COLS = 10;
const ROWS = 20;
const CELL_SIZE = 21.6; // pixels per cell

// Audio synthesizer
const SoundSynth = {
  ctx: null,
  init() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  play(type) {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    try {
      if (type === 'move') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.setValueAtTime(100, t + 0.04);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(t + 0.04);
      } else if (type === 'rotate') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(250, t);
        osc.frequency.setValueAtTime(350, t + 0.06);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(t + 0.06);
      } else if (type === 'drop') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, t);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(t + 0.08);
      } else if (type === 'clear') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.linearRampToValueAtTime(800, t + 0.25);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(t + 0.25);
      } else if (type === 'garbage') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.linearRampToValueAtTime(300, t + 0.3);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(t + 0.3);
      } else if (type === 'gameover') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.linearRampToValueAtTime(50, t + 0.6);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(t + 0.6);
      }
    } catch (e) {}
  }
};

// Tetromino Shapes config
const SHAPES = {
  I: [[0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]],
  O: [[1,1], [1,1]],
  T: [[0,1,0], [1,1,1], [0,0,0]],
  S: [[0,1,1], [1,1,0], [0,0,0]],
  Z: [[1,1,0], [0,1,1], [0,0,0]],
  J: [[1,0,0], [1,1,1], [0,0,0]],
  L: [[0,0,1], [1,1,1], [0,0,0]]
};

const COLORS = {
  I: '#00f0ff', // cyan
  O: '#ffea00', // yellow
  T: '#b026ff', // purple
  S: '#39ff14', // green
  Z: '#ff007f', // red/magenta
  J: '#0077ff', // blue
  L: '#ff9100'  // orange
};

// Seeding randomizer
let rSeed = Date.now();
function seededRandom() {
  let x = Math.sin(rSeed++) * 10000;
  return x - Math.floor(x);
}

function getRandomShape() {
  const keys = Object.keys(SHAPES);
  const idx = Math.floor(seededRandom() * keys.length);
  return keys[idx];
}

// Simple deterministic generator
class PieceBag {
  constructor() {
    this.bag = [];
  }
  next() {
    if (this.bag.length === 0) {
      this.bag = Object.keys(SHAPES).sort(() => seededRandom() - 0.5);
    }
    return this.bag.pop();
  }
}

// Tetris Game Instance Class
class TetrisBoard {
  constructor(canvasId, holdCanvasId, nextCanvasId, isCpu = false) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.holdCanvas = holdCanvasId ? document.getElementById(holdCanvasId) : null;
    this.nextCanvas = nextCanvasId ? document.getElementById(nextCanvasId) : null;
    this.isCpu = isCpu;

    // Resize canvases to scale to 90%
    this.canvas.width = COLS * CELL_SIZE;
    this.canvas.height = ROWS * CELL_SIZE;
    if (this.holdCanvas) {
      this.holdCanvas.width = 72;
      this.holdCanvas.height = 72;
    }
    if (this.nextCanvas) {
      this.nextCanvas.width = 72;
      this.nextCanvas.height = 72;
    }

    this.grid = Array(ROWS).fill().map(() => Array(COLS).fill(0));
    this.bag = new PieceBag();
    
    this.currentPiece = null; // { type, matrix, x, y }
    this.nextPieceType = this.bag.next();
    this.holdPieceType = null;
    this.canHold = true;

    this.score = 0;
    this.linesCleared = 0;
    this.gameOver = false;

    // vs CPU target placements
    this.aiTargetX = 0;
    this.aiTargetRot = 0;
    this.aiMoving = false;
  }

  reset() {
    this.grid = Array(ROWS).fill().map(() => Array(COLS).fill(0));
    this.currentPiece = null;
    this.nextPieceType = this.bag.next();
    this.holdPieceType = null;
    this.canHold = true;
    this.score = 0;
    this.linesCleared = 0;
    this.gameOver = false;
    this.spawnPiece();
  }

  spawnPiece() {
    const type = this.nextPieceType;
    this.nextPieceType = this.bag.next();
    this.currentPiece = {
      type: type,
      matrix: SHAPES[type].map(row => [...row]),
      x: Math.floor((COLS - SHAPES[type][0].length) / 2),
      y: type === 'I' ? -1 : 0
    };

    this.canHold = true;

    // Check collision on spawn
    if (this.checkCollision(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y)) {
      this.gameOver = true;
      SoundSynth.play('gameover');
    }

    // Trigger AI solver if CPU
    if (this.isCpu && !this.gameOver) {
      this.runCpuAI();
    }

    this.drawPreviews();
  }

  checkCollision(matrix, px, py) {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const nextX = px + c;
          const nextY = py + r;

          if (nextX < 0 || nextX >= COLS || nextY >= ROWS) {
            return true;
          }
          if (nextY >= 0 && this.grid[nextY][nextX] !== 0) {
            return true;
          }
        }
      }
    }
    return false;
  }

  move(dx, dy) {
    if (this.gameOver) return false;
    this.currentPiece.x += dx;
    this.currentPiece.y += dy;

    if (this.checkCollision(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y)) {
      this.currentPiece.x -= dx;
      this.currentPiece.y -= dy;
      return false;
    }
    return true;
  }

  rotate() {
    if (this.gameOver) return;
    const matrix = this.currentPiece.matrix;
    const n = matrix.length;
    let rotated = Array(n).fill().map(() => Array(n).fill(0));

    // Rotate matrix
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        rotated[c][n - 1 - r] = matrix[r][c];
      }
    }

    // Standard wall kicks buffer checks
    const kicks = [0, -1, 1, -2, 2];
    for (let i = 0; i < kicks.length; i++) {
      const offset = kicks[i];
      if (!this.checkCollision(rotated, this.currentPiece.x + offset, this.currentPiece.y)) {
        this.currentPiece.matrix = rotated;
        this.currentPiece.x += offset;
        if (!this.isCpu) SoundSynth.play('rotate');
        return;
      }
    }
  }

  hold() {
    if (this.gameOver || !this.canHold) return;

    const currentType = this.currentPiece.type;

    if (this.holdPieceType === null) {
      this.holdPieceType = currentType;
      this.spawnPiece();
    } else {
      const temp = this.holdPieceType;
      this.holdPieceType = currentType;
      
      this.currentPiece = {
        type: temp,
        matrix: SHAPES[temp].map(row => [...row]),
        x: Math.floor((COLS - SHAPES[temp][0].length) / 2),
        y: temp === 'I' ? -1 : 0
      };
      
      // Update preview canvases since hold has swapped
      this.drawPreviews();
    }

    this.canHold = false;
    if (!this.isCpu) SoundSynth.play('rotate');
    this.drawPreviews();
  }

  drop() {
    if (this.gameOver) return;
    if (!this.move(0, 1)) {
      this.lockPiece();
    }
  }

  hardDrop() {
    if (this.gameOver) return;
    let droppedLines = 0;
    while (this.move(0, 1)) {
      droppedLines++;
    }
    this.lockPiece();
    if (!this.isCpu) SoundSynth.play('drop');
  }

  lockPiece() {
    const matrix = this.currentPiece.matrix;
    const px = this.currentPiece.x;
    const py = this.currentPiece.y;

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const targetY = py + r;
          if (targetY >= 0) {
            this.grid[targetY][px + c] = this.currentPiece.type;
          }
        }
      }
    }

    this.clearLines();
    this.spawnPiece();
  }

  clearLines() {
    let clearedCount = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.grid[r].every(cell => cell !== 0)) {
        this.grid.splice(r, 1);
        this.grid.unshift(Array(COLS).fill(0));
        clearedCount++;
        r++; // check same row index again
      }
    }

    if (clearedCount > 0) {
      this.linesCleared += clearedCount;
      this.score += [0, 100, 300, 500, 800][clearedCount];
      if (!this.isCpu) SoundSynth.play('clear');

      // Send garbage in Vs Mode
      if (gameMode === 'vs') {
        const garbageCount = [0, 0, 1, 2, 4][clearedCount];
        if (garbageCount > 0) {
          if (this.isCpu) {
            // CPU sends to Player
            playerBoard.addGarbage(garbageCount);
          } else {
            // Player sends to CPU
            cpuBoard.addGarbage(garbageCount);
          }
        }
      }
    }
  }

  addGarbage(lines) {
    if (this.gameOver) return;
    SoundSynth.play('garbage');

    for (let i = 0; i < lines; i++) {
      // Shift grid up
      this.grid.shift();

      // Create grey garbage row with exactly one gap
      const gapIdx = Math.floor(seededRandom() * COLS);
      const garbageRow = Array(COLS).fill('G'); // 'G' for grey block
      garbageRow[gapIdx] = 0;
      this.grid.push(garbageRow);
    }

    // Check if player's active block collides with pushed garbage
    if (this.currentPiece && this.checkCollision(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y)) {
      // try shifting active block up to fit
      while (this.currentPiece.y > -2 && this.checkCollision(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y)) {
        this.currentPiece.y--;
      }
      if (this.currentPiece.y <= -2) {
        this.gameOver = true;
        SoundSynth.play('gameover');
      }
    }
  }

  // Draw Board Canvas
  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL_SIZE, 0);
      ctx.lineTo(c * CELL_SIZE, ROWS * CELL_SIZE);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL_SIZE);
      ctx.lineTo(COLS * CELL_SIZE, r * CELL_SIZE);
      ctx.stroke();
    }

    // Draw Locked blocks
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.grid[r][c];
        if (cell !== 0) {
          ctx.fillStyle = cell === 'G' ? '#555555' : COLORS[cell];
          ctx.fillRect(c * CELL_SIZE + 1, r * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
          
          // Glossy highlight
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          ctx.fillRect(c * CELL_SIZE + 2, r * CELL_SIZE + 2, CELL_SIZE - 4, 3);
        }
      }
    }

    // Draw Current Falling block
    if (this.currentPiece && !this.gameOver) {
      const matrix = this.currentPiece.matrix;
      const px = this.currentPiece.x;
      const py = this.currentPiece.y;



      // 2. Draw actual piece
      ctx.fillStyle = COLORS[this.currentPiece.type];
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c] !== 0) {
            const targetY = py + r;
            if (targetY >= 0) {
              ctx.fillRect(px * CELL_SIZE + c * CELL_SIZE + 1, targetY * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
              
              // Glossy highlight
              ctx.fillStyle = 'rgba(255,255,255,0.25)';
              ctx.fillRect(px * CELL_SIZE + c * CELL_SIZE + 2, targetY * CELL_SIZE + 2, CELL_SIZE - 4, 3);
              ctx.fillStyle = COLORS[this.currentPiece.type]; // restore
            }
          }
        }
      }
    }
  }

  // Hold & Next Canvas draw
  drawPreviews() {
    if (this.isCpu) return; // CPU doesn't render previews on canvas

    // 1. Next Preview
    if (this.nextCanvas) {
      const ctx = this.nextCanvas.getContext('2d');
      ctx.clearRect(0, 0, 72, 72);
      if (this.nextPieceType) {
        const mat = SHAPES[this.nextPieceType];
        ctx.fillStyle = COLORS[this.nextPieceType];
        const offset = this.nextPieceType === 'O' ? 22 : 14;
        for (let r = 0; r < mat.length; r++) {
          for (let c = 0; c < mat[r].length; c++) {
            if (mat[r][c] !== 0) {
              ctx.fillRect(c * 14.4 + offset, r * 14.4 + 18, 12.6, 12.6);
            }
          }
        }
      }
    }

    // 2. Hold Preview
    if (this.holdCanvas) {
      const ctx = this.holdCanvas.getContext('2d');
      ctx.clearRect(0, 0, 72, 72);
      if (this.holdPieceType) {
        const mat = SHAPES[this.holdPieceType];
        ctx.fillStyle = COLORS[this.holdPieceType];
        const offset = this.holdPieceType === 'O' ? 22 : 14;
        for (let r = 0; r < mat.length; r++) {
          for (let c = 0; c < mat[r].length; c++) {
            if (mat[r][c] !== 0) {
              ctx.fillRect(c * 14.4 + offset, r * 14.4 + 18, 12.6, 12.6);
            }
          }
        }
      }
    }
  }

  // --- CPU AI SOLVER ---
  runCpuAI() {
    if (this.gameOver) return;

    let bestScore = -Infinity;
    let targetX = 0;
    let targetRot = 0;

    const pieceType = this.currentPiece.type;
    const baseMatrix = SHAPES[pieceType];

    // Evaluate all 4 rotations
    for (let rot = 0; rot < 4; rot++) {
      let matrix = baseMatrix;
      // Rotate matrix mathematically
      for (let k = 0; k < rot; k++) {
        const n = matrix.length;
        let rotated = Array(n).fill().map(() => Array(n).fill(0));
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            rotated[c][n - 1 - r] = matrix[r][c];
          }
        }
        matrix = rotated;
      }

      // Check all valid column horizontal translations
      const minX = -3;
      const maxX = COLS + 3;

      for (let x = minX; x < maxX; x++) {
        // If piece spawns at x, evaluate placement
        if (this.checkCollision(matrix, x, 0)) continue;

        // Simulate drop
        let testY = 0;
        while (!this.checkCollision(matrix, x, testY + 1)) {
          testY++;
        }

        // Compute AI Score heuristic
        const score = this.calculateHeuristicScore(matrix, x, testY);
        if (score > bestScore) {
          bestScore = score;
          targetX = x;
          targetRot = rot;
        }
      }
    }

    this.aiTargetX = targetX;
    this.aiTargetRot = targetRot;
    this.aiMoving = true;
  }

  // Heuristic weights for AI
  calculateHeuristicScore(matrix, px, py) {
    // 1. Create a clone board
    const cloneGrid = this.grid.map(row => [...row]);

    // 2. Lock piece onto clone board
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const ty = py + r;
          if (ty >= 0 && ty < ROWS) {
            cloneGrid[ty][px + c] = 1;
          }
        }
      }
    }

    // 3. Heuristic parameters
    // Heights list
    const heights = Array(COLS).fill(0);
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (cloneGrid[r][c] !== 0) {
          heights[c] = ROWS - r;
          break;
        }
      }
    }

    // Parameters sum
    const aggHeight = heights.reduce((sum, h) => sum + h, 0);

    // Count holes
    let holes = 0;
    for (let c = 0; c < COLS; c++) {
      let blockSeen = false;
      for (let r = 0; r < ROWS; r++) {
        if (cloneGrid[r][c] !== 0) {
          blockSeen = true;
        } else if (blockSeen && cloneGrid[r][c] === 0) {
          holes++;
        }
      }
    }

    // Bumpiness
    let bumpiness = 0;
    for (let c = 0; c < COLS - 1; c++) {
      bumpiness += Math.abs(heights[c] - heights[c + 1]);
    }

    // Completed lines cleared
    let cleared = 0;
    for (let r = 0; r < ROWS; r++) {
      if (cloneGrid[r].every(cell => cell !== 0)) {
        cleared++;
      }
    }

    // Heuristics Score formula
    return (-0.51 * aggHeight) + (0.76 * cleared) - (0.36 * holes) - (0.18 * bumpiness);
  }

  // Update CPU AI steps every frame/tick
  updateCpuMove() {
    if (this.gameOver || !this.aiMoving) return;

    let targetRotReached = false;
    let targetXReached = false;

    // 1. Check current rotation vs target
    // We can count rotation index by comparing matrix representation or just checking rot moves count.
    // For ease, we compare matrix rotation. A simpler way: we track current rotation index (0-3).
    // Let's rotate once until reached
    if (this.currentRotIndex === undefined) this.currentRotIndex = 0;

    if (this.currentRotIndex !== this.aiTargetRot) {
      this.rotate();
      this.currentRotIndex = (this.currentRotIndex + 1) % 4;
    } else {
      targetRotReached = true;
    }

    // 2. Move X direction toward target
    if (this.currentPiece.x < this.aiTargetX) {
      this.move(1, 0);
    } else if (this.currentPiece.x > this.aiTargetX) {
      this.move(-1, 0);
    } else {
      targetXReached = true;
    }

    // 3. If reached, hard drop or reset
    if (targetRotReached && targetXReached) {
      this.aiMoving = false;
      this.currentRotIndex = 0; // reset
      this.hardDrop();
    }
  }
}

// --- GLOBAL GAME REGISTRATION ---

let gameMode = 'lobby'; // 'lobby', 'single', 'vs'
let gameSpeedMultiplier = 1.0;
let isPaused = false;

let playerBoard = null;
let cpuBoard = null;

let singleStage = 1;
let singleLinesLeft = 100;
let singleProgress = {
  currentStage: 1,
  clearedLines: 0
};

// Tick management
let playerLastDropTime = 0;
let cpuLastDropTime = 0;
let cpuLastAiStepTime = 0;

// Update single mode speed multiplier
function updateSingleSpeed() {
  // Stage formula: speed increments by 10% (0.1) every 100 stages cleared.
  // Stage 1-100: 1.0x, Stage 101-200: 1.1x, etc.
  const bonus = Math.floor((singleStage - 1) / 100) * 0.1;
  gameSpeedMultiplier = 1.0 + bonus;
}

// Draw Dashboard HUD values
function updateHUD() {
  if (gameMode === 'single') {
    document.getElementById('hud-stage').innerText = `STAGE ${singleStage}`;
    document.getElementById('hud-lines').innerText = `${playerBoard.linesCleared} / 100`;
    document.getElementById('hud-speed').innerText = `${gameSpeedMultiplier.toFixed(1)}x`;
  } else if (gameMode === 'vs') {
    document.getElementById('vs-speed-hud').innerText = `${gameSpeedMultiplier.toFixed(1)}x`;
  }
}

// Game Core Tick Loop
function showResultModal(type) {
  const modal = document.getElementById('result-modal');
  const header = document.getElementById('result-header');
  const icon = document.getElementById('result-icon');
  const message = document.getElementById('result-message');
  const detail = document.getElementById('result-detail');
  const actionBtn = document.getElementById('btn-result-action');

  // Pause game loop
  gameMode = 'result';

  if (type === 'single_clear') {
    playSoundSynthSafe('win');
    header.innerText = '🎉 STAGE CLEAR!';
    header.style.color = 'var(--neon-cyan)';
    icon.innerText = '🏆';
    message.innerText = `100줄 제거 완료! STAGE ${singleStage - 1} 클리어!`;
    detail.innerText = `다음 난이도 속도: ${gameSpeedMultiplier.toFixed(1)}x`;
    actionBtn.innerText = '다음 스테이지 ▶';
    actionBtn.onclick = () => {
      modal.classList.remove('active');
      gameMode = 'single';
      playerBoard.reset();
      playerLastDropTime = performance.now();
      requestAnimationFrame(mainLoop);
    };
  } else if (type === 'single_gameover') {
    SoundSynth.play('gameover');
    header.innerText = '💀 GAME OVER';
    header.style.color = 'var(--neon-magenta)';
    icon.innerText = '💥';
    message.innerText = `블록이 끝까지 차올랐습니다!`;
    detail.innerText = `최종 도달: STAGE ${singleStage}`;
    actionBtn.innerText = '재시작 🔄';
    actionBtn.onclick = () => {
      modal.classList.remove('active');
      gameMode = 'single';
      playerBoard.reset();
      playerLastDropTime = performance.now();
      requestAnimationFrame(mainLoop);
    };
  } else if (type === 'vs_win') {
    playSoundSynthSafe('win');
    header.innerText = '👑 VICTORY!';
    header.style.color = 'var(--neon-yellow)';
    icon.innerText = '🥇';
    message.innerText = '축하합니다! 컴퓨터(Android)를 물리쳤습니다!';
    detail.innerText = `대결 설정 속도: ${gameSpeedMultiplier.toFixed(1)}x`;
    actionBtn.innerText = '로비로 이동 🏠';
    actionBtn.onclick = () => {
      modal.classList.remove('active');
      exitToLobby();
    };
  } else if (type === 'vs_lose') {
    SoundSynth.play('gameover');
    header.innerText = '💀 DEFEAT';
    header.style.color = '#ff1744';
    icon.innerText = '🤖';
    message.innerText = '컴퓨터의 벽을 넘지 못하고 패배했습니다.';
    detail.innerText = `대결 설정 속도: ${gameSpeedMultiplier.toFixed(1)}x`;
    actionBtn.innerText = '재도전 ⚔️';
    actionBtn.onclick = () => {
      modal.classList.remove('active');
      startVsMode();
    };
  }

  modal.classList.add('active');
}

function mainLoop(timestamp) {
  if (gameMode === 'lobby' || gameMode === 'result' || isPaused) return;

  const dropInterval = 1000 / gameSpeedMultiplier;

  // 1. Update Player
  if (playerBoard && !playerBoard.gameOver) {
    if (timestamp - playerLastDropTime > dropInterval) {
      playerBoard.drop();
      playerLastDropTime = timestamp;
    }
    playerBoard.draw();
  }

  // 2. Update CPU in Vs Mode
  if (gameMode === 'vs' && cpuBoard && !cpuBoard.gameOver) {
    // Normal gravity drop
    if (timestamp - cpuLastDropTime > dropInterval) {
      cpuBoard.drop();
      cpuLastDropTime = timestamp;
    }

    // AI steps interval (constant delay at 60% of original speed, not affected by gameSpeedMultiplier)
    const aiStepDelay = 388;
    if (timestamp - cpuLastAiStepTime > aiStepDelay) {
      cpuBoard.updateCpuMove();
      cpuLastAiStepTime = timestamp;
    }

    cpuBoard.draw();
  }

  // 3. Check Single Mode Win/Clear progress
  if (gameMode === 'single' && playerBoard) {
    if (playerBoard.linesCleared >= 100) {
      singleStage++;
      if (singleStage > 1000) {
        alert("축하합니다! 1000 스테이지를 모두 돌파하셨습니다!");
        exitToLobby();
        return;
      }
      // Save
      localStorage.setItem('tetris_single_stage', singleStage);
      updateSingleSpeed();
      showResultModal('single_clear');
      return;
    }
  }

  // 4. Check global end conditions
  if (playerBoard && playerBoard.gameOver) {
    if (gameMode === 'vs') {
      showResultModal('vs_lose');
    } else {
      showResultModal('single_gameover');
    }
    return;
  }
  if (gameMode === 'vs' && cpuBoard && cpuBoard.gameOver) {
    showResultModal('vs_win');
    return;
  }

  updateHUD();
  requestAnimationFrame(mainLoop);
}

function playSoundSynthSafe(type) {
  try {
    if (type === 'win') {
      SoundSynth.init();
      if (!SoundSynth.ctx) return;
      const t = SoundSynth.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = SoundSynth.ctx.createOscillator();
        const gain = SoundSynth.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + idx * 0.1);
        gain.gain.setValueAtTime(0.12, t + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.1 + 0.25);
        osc.connect(gain);
        gain.connect(SoundSynth.ctx.destination);
        osc.start(t + idx * 0.1);
        osc.stop(t + idx * 0.1 + 0.25);
      });
    }
  } catch(e){}
}

// Pause state management
function togglePause() {
  if (gameMode === 'lobby' || gameMode === 'result') return;
  isPaused = !isPaused;

  const btn = document.getElementById('btn-pause');
  if (isPaused) {
    btn.innerText = '▶️ 계속하기';
    btn.style.background = 'rgba(57, 255, 20, 0.15)';
    btn.style.borderColor = 'var(--neon-green)';
    btn.style.boxShadow = '0 0 10px rgba(57, 255, 20, 0.2)';
    
    // Draw PAUSED text over the player's board canvas
    if (playerBoard) {
      const ctx = playerBoard.ctx;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, playerBoard.canvas.width, playerBoard.canvas.height);
      ctx.font = '900 22px Outfit';
      ctx.fillStyle = 'var(--neon-cyan)';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', playerBoard.canvas.width / 2, playerBoard.canvas.height / 2 - 10);
      ctx.font = '700 12px Noto Sans KR';
      ctx.fillStyle = '#fff';
      ctx.fillText('일시정지 중', playerBoard.canvas.width / 2, playerBoard.canvas.height / 2 + 15);
    }
    
    if (gameMode === 'vs' && cpuBoard) {
      const ctx = cpuBoard.ctx;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, cpuBoard.canvas.width, cpuBoard.canvas.height);
      ctx.font = '900 22px Outfit';
      ctx.fillStyle = 'var(--neon-magenta)';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', cpuBoard.canvas.width / 2, cpuBoard.canvas.height / 2 - 10);
    }
  } else {
    btn.innerText = '⏸️ 일시정지';
    btn.style.background = 'rgba(0, 240, 255, 0.1)';
    btn.style.borderColor = 'var(--neon-cyan)';
    btn.style.boxShadow = 'none';
    
    // Resume request animation loops immediately
    playerLastDropTime = performance.now();
    if (gameMode === 'vs') {
      cpuLastDropTime = performance.now();
      cpuLastAiStepTime = performance.now();
    }
    requestAnimationFrame(mainLoop);
  }
}

function resetPauseState() {
  isPaused = false;
  const btn = document.getElementById('btn-pause');
  if (btn) {
    btn.innerText = '⏸️ 일시정지';
    btn.style.background = 'rgba(0, 240, 255, 0.1)';
    btn.style.borderColor = 'var(--neon-cyan)';
    btn.style.boxShadow = 'none';
  }
}

// Start Modes Trigger
function startSingleMode() {
  SoundSynth.init();
  resetPauseState();
  gameMode = 'single';

  // Load stage from localstorage
  const savedStage = localStorage.getItem('tetris_single_stage');
  singleStage = savedStage ? parseInt(savedStage) : 1;

  document.getElementById('lobby-view').style.display = 'none';
  document.getElementById('game-view').style.display = 'flex';
  
  // Show/Hide boards layout elements
  document.getElementById('game-view').classList.remove('vs-active');
  document.getElementById('single-hud').style.display = 'block';
  document.getElementById('vs-hud').style.display = 'none';

  playerBoard = new TetrisBoard('player-canvas', 'hold-canvas', 'next-canvas', false);
  playerBoard.reset();
  
  updateSingleSpeed();
  updateHUD();

  playerLastDropTime = performance.now();
  requestAnimationFrame(mainLoop);
}

function startVsMode() {
  SoundSynth.init();
  resetPauseState();
  gameMode = 'vs';

  // Read speed multiplier from slider value
  const sliderVal = parseFloat(document.getElementById('speed-slider').value);
  gameSpeedMultiplier = sliderVal;

  document.getElementById('lobby-view').style.display = 'none';
  document.getElementById('game-view').style.display = 'flex';

  // Show/Hide boards layout elements
  document.getElementById('game-view').classList.add('vs-active');
  document.getElementById('single-hud').style.display = 'none';
  document.getElementById('vs-hud').style.display = 'block';

  // Initialize both boards
  playerBoard = new TetrisBoard('player-canvas', 'hold-canvas', 'next-canvas', false);
  cpuBoard = new TetrisBoard('cpu-canvas', null, null, true);

  playerBoard.reset();
  cpuBoard.reset();

  updateHUD();

  playerLastDropTime = performance.now();
  cpuLastDropTime = performance.now();
  cpuLastAiStepTime = performance.now();
  
  requestAnimationFrame(mainLoop);
}

function exitToLobby() {
  resetPauseState();
  gameMode = 'lobby';
  document.getElementById('lobby-view').style.display = 'flex';
  document.getElementById('game-view').style.display = 'none';
}

// Keyboard action mapping
function setupKeyboardControls() {
  window.addEventListener('keydown', e => {
    if (gameMode === 'lobby') return;

    const key = e.key.toLowerCase();
    const code = e.code;

    // Toggle pause with P key or Escape
    if (key === 'p' || key === 'ㅔ' || code === 'KeyP' || key === 'escape') {
      togglePause();
      e.preventDefault();
      return;
    }

    if (isPaused) return;
    if (!playerBoard || playerBoard.gameOver) return;

    if (key === 'arrowleft' || key === 'a' || key === 'ㅁ' || code === 'KeyA') {
      playerBoard.move(-1, 0);
      SoundSynth.play('move');
    } else if (key === 'arrowright' || key === 'd' || key === 'ㅇ' || code === 'KeyD') {
      playerBoard.move(1, 0);
      SoundSynth.play('move');
    } else if (key === 'arrowdown' || key === 's' || key === 'ㄴ' || code === 'KeyS') {
      playerBoard.move(0, 1);
    } else if (key === 'arrowup' || key === 'w' || key === 'ㅈ' || code === 'KeyW') {
      playerBoard.rotate();
    } else if (key === ' ' || code === 'Space') {
      playerBoard.hardDrop();
      e.preventDefault(); // prevent page space scroll
    } else if (key === 'shift' || key === 'c' || key === 'ㅊ' || code === 'KeyC' || code === 'ShiftLeft' || code === 'ShiftRight') {
      playerBoard.hold();
    }
  });
}

// Mobile 가상 패드 바인딩
function setupMobileControls() {
  document.getElementById('btn-left').addEventListener('touchstart', e => {
    if (isPaused) return;
    playerBoard.move(-1, 0);
    SoundSynth.play('move');
    e.preventDefault();
  });
  document.getElementById('btn-right').addEventListener('touchstart', e => {
    if (isPaused) return;
    playerBoard.move(1, 0);
    SoundSynth.play('move');
    e.preventDefault();
  });
  document.getElementById('btn-down').addEventListener('touchstart', e => {
    if (isPaused) return;
    playerBoard.move(0, 1);
    e.preventDefault();
  });
  document.getElementById('btn-rotate').addEventListener('touchstart', e => {
    if (isPaused) return;
    playerBoard.rotate();
    e.preventDefault();
  });
  document.getElementById('btn-hard').addEventListener('touchstart', e => {
    if (isPaused) return;
    playerBoard.hardDrop();
    e.preventDefault();
  });
  document.getElementById('btn-hold').addEventListener('touchstart', e => {
    if (isPaused) return;
    playerBoard.hold();
    e.preventDefault();
  });

  // Pause button (bulletproof touch + click binding for Android/iOS)
  const pauseBtn = document.getElementById('btn-pause');
  if (pauseBtn) {
    let lastPauseTriggerTime = 0;
    const handlePausePress = (e) => {
      const now = performance.now();
      if (now - lastPauseTriggerTime < 350) {
        e.preventDefault();
        return;
      }
      lastPauseTriggerTime = now;
      e.preventDefault();
      togglePause();
    };
    pauseBtn.addEventListener('touchstart', handlePausePress, { passive: false });
    pauseBtn.addEventListener('click', handlePausePress);
  }

  // Slider change event display
  const slider = document.getElementById('speed-slider');
  const sliderValDisp = document.getElementById('slider-val-display');
  slider.oninput = function() {
    sliderValDisp.innerText = `${parseFloat(this.value).toFixed(1)}x`;
  };
}

// Entrypoint
window.onload = function() {
  setupKeyboardControls();
  setupMobileControls();

  const bindTouchAndClick = (id, handler) => {
    const el = document.getElementById(id);
    if (el) {
      let lastPress = 0;
      const pressHandler = (e) => {
        const now = performance.now();
        if (now - lastPress < 350) {
          e.preventDefault();
          return;
        }
        lastPress = now;
        e.preventDefault();
        handler();
      };
      el.addEventListener('touchstart', pressHandler, { passive: false });
      el.addEventListener('click', pressHandler);
    }
  };

  bindTouchAndClick('btn-single', startSingleMode);
  bindTouchAndClick('btn-vs', startVsMode);
  bindTouchAndClick('btn-exit', exitToLobby);

  // Prevent double tap zooms
  document.addEventListener('touchstart', e => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  // PWA Service Worker Registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('Tetris Service Worker Registered', reg.scope))
      .catch(err => console.error('Service Worker Registration Failed', err));
  }
};
