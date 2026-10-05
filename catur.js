const pieces = {
  'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚', 'p': '♟',
  'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔', 'P': '♙'
};

// ===== BIDAK SVG (hitam/putih beroutline tebal) =====
const BASE_SHAPE = '<rect x="24" y="78" width="52" height="11" rx="4"/>';
const PIECE_SHAPES = {
  p: { body: '<circle cx="50" cy="30" r="12"/><path d="M42 44H58L63 60Q66 72 70 80H30Q34 72 37 60Z"/><rect x="35" y="43" width="30" height="7" rx="3.5"/>',
       detail: '' },
  r: { body: '<path d="M30 20H38V28H44V20H56V28H62V20H70V38H30Z"/><path d="M35 36H65L62 70H38Z"/><path d="M30 68H70V80H30Z"/>',
       detail: '<path d="M36 41H64M38 66H62"/>' },
  n: { body: '<path d="M70 80C72 56 70 32 54 20L52 10L45 17C30 24 20 42 18 54L26 58C30 52 36 50 42 46C34 58 30 68 30 80Z"/>',
       detail: '<path d="M44 30h.1M21 54h.1"/><path d="M60 28C64 42 64 56 62 70"/>' },
  b: { body: '<ellipse cx="50" cy="32" rx="12" ry="17"/><circle cx="50" cy="12" r="5"/><rect x="36" y="49" width="28" height="7" rx="3.5"/><path d="M41 55H59L66 80H34Z"/>',
       detail: '<path d="M46 38L56 26"/>' },
  q: { body: '<path d="M28 32L37 62H63L72 32L60 48L50 24L40 48Z"/><circle cx="28" cy="28" r="4.5"/><circle cx="39" cy="20" r="4.5"/><circle cx="50" cy="16" r="4.5"/><circle cx="61" cy="20" r="4.5"/><circle cx="72" cy="28" r="4.5"/><path d="M35 60H65L69 80H31Z"/>',
       detail: '<path d="M37 66H63"/>' },
  k: { body: '<path d="M34 80L38 54Q38 40 50 40Q62 40 62 54L66 80Z"/><rect x="46" y="10" width="8" height="30"/><rect x="38" y="19" width="24" height="8"/>',
       detail: '<path d="M38 62H62"/>' }
};

function pieceSVG(piece) {
  const white = piece === piece.toUpperCase();
  const def = PIECE_SHAPES[piece.toLowerCase()];
  const shape = def.body + BASE_SHAPE;
  const fill = white ? '#fdfdfd' : '#111';
  const ink = white ? '#111' : '#f4f4f4';
  let layers = '<g fill="#000" stroke="#000" stroke-width="9" stroke-linejoin="round">' + shape + '</g>';
  if (!white) layers += '<g fill="#fff" stroke="#fff" stroke-width="4.5" stroke-linejoin="round">' + shape + '</g>';
  layers += '<g fill="' + fill + '">' + shape + '</g>';
  if (def.detail) layers += '<g fill="none" stroke="' + ink + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' + def.detail + '</g>';
  return '<svg viewBox="0 0 100 100" aria-hidden="true">' + layers + '</svg>';
}

function pieceHTML(piece) {
  const white = piece === piece.toUpperCase();
  return '<div class="pc ' + (white ? 'w' : 'b') + '">' + pieceSVG(piece) + '</div>';
}

// ===== TEMA (pakai data-theme + kunci 'theme' yang sama dengan halaman lain) =====
function applyTheme(dark) {
  if (dark) document.body.setAttribute('data-theme', 'dark');
  else document.body.removeAttribute('data-theme');
  const btn = document.getElementById('themeBtn');
  if (btn) btn.innerText = dark ? '☀️ Light Mode' : '🌙 Dark Mode';
}

function toggleTheme() {
  const dark = !document.body.hasAttribute('data-theme');
  applyTheme(dark);
  try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) {}
}

document.addEventListener('DOMContentLoaded', () => {
  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch (e) {}
  applyTheme(saved === 'dark');
});

let board = [];
let turn = 'w';
let selected = null;
let validMoves = [];
let history = [];
let castling = { wK: true, wQ: true, bK: true, bQ: true };
let enPassant = null;

let gameMode = 'pvp';
let botDifficulty = 'normal';
let botColor = 'b';

// FIX #2: array untuk melacak bidak yang benar-benar tertangkap
let capturedWhite = []; // bidak putih yang sudah dimakan lawan
let capturedBlack = []; // bidak hitam yang sudah dimakan lawan
let animating = false;

// aturan remis + promosi
let halfmoveClock = 0;      // langkah sejak terakhir ada pion jalan / bidak dimakan
let positionLog = [];       // kunci posisi tiap langkah (untuk pengulangan 3x)
let pendingPromotion = null;

const pieceValue = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

let audioCtx;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playSound(type) {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  if (type === 'move') { osc.frequency.value = 800; gain.gain.setValueAtTime(0.3, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08); osc.start(); osc.stop(ctx.currentTime + 0.08); }
  if (type === 'capture') { osc.frequency.value = 400; gain.gain.setValueAtTime(0.4, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15); osc.start(); osc.stop(ctx.currentTime + 0.15); }
  if (type === 'check') { osc.frequency.value = 600; gain.gain.setValueAtTime(0.4, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3); osc.start(); osc.stop(ctx.currentTime + 0.3); }
  if (type === 'checkmate') { osc.frequency.setValueAtTime(500, ctx.currentTime); osc.frequency.setValueAtTime(700, ctx.currentTime + 0.2); gain.gain.setValueAtTime(0.4, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4); osc.start(); osc.stop(ctx.currentTime + 0.4); }
}
document.addEventListener('click', () => getAudioCtx().resume(), { once: true });

function setGameMode(mode) {
  gameMode = mode;
  document.getElementById('btn-pvp')?.classList.remove('active');
  document.getElementById('btn-bot')?.classList.remove('active');
  document.getElementById('btn-' + mode)?.classList.add('active');
  resetGame();
}
function setBotDifficulty(diff) { botDifficulty = diff; }
function setBotColor(color) { botColor = color; resetGame(); }

function initBoard() {
  board = [
    ['r','n','b','q','k','b','n','r'],
    ['p','p','p','p','p','p','p','p'],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['P','P','P','P','P','P','P','P'],
    ['R','N','B','Q','K','B','N','R']
  ];
  history = [];
  turn = 'w';
  selected = null;
  validMoves = [];
  castling = { wK: true, wQ: true, bK: true, bQ: true };
  enPassant = null;
  capturedWhite = [];
  capturedBlack = [];
  halfmoveClock = 0;
  pendingPromotion = null;
  positionLog = [positionKey()];
  document.getElementById('promotionOverlay').classList.add('hidden');
  updateStatus();
  updateCaptured();
  document.getElementById('gameOverOverlay').classList.add('hidden');
  document.getElementById('board').style.pointerEvents = 'auto';
  renderBoard();
  if(gameMode == 'bot' && botColor == 'w' && turn == 'w') {
    setTimeout(botMove, 500);
  }
}

function buildCoords() {
  const files = 'abcdefgh'.split('').map(f => '<span>' + f + '</span>').join('');
  const ranks = [8,7,6,5,4,3,2,1].map(n => '<span>' + n + '</span>').join('');
  document.getElementById('coordsTop').innerHTML = files;
  document.getElementById('coordsBottom').innerHTML = files;
  document.getElementById('coordsLeft').innerHTML = ranks;
  document.getElementById('coordsRight').innerHTML = ranks;
}

function renderBoard() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  // 2 player: bidak hitam diputar 180° supaya menghadap pemain di seberang
  boardEl.classList.toggle('pvp', gameMode == 'pvp');
  document.getElementById('boardFrame').classList.toggle('pvp', gameMode == 'pvp');
  const selectedColor = selected? (board[selected.row][selected.col] == board[selected.row][selected.col].toUpperCase()? 'w' : 'b') : null;
  let kingPos = null;
  for(let r = 0; r < 8; r++) {
    for(let c = 0; c < 8; c++) {
      const p = board[r][c];
      if(p && p.toLowerCase() == 'k' && (p == p.toUpperCase()) == (turn == 'w')) {
        kingPos = {row: r, col: c};
        break;
      }
    }
    if(kingPos) break;
  }
  const inCheck = kingPos && isCheck(turn);
  for(let row = 0; row < 8; row++) {
    for(let col = 0; col < 8; col++) {
      const square = document.createElement('div');
      square.className = 'square ' + ((row + col) % 2 === 0? 'light' : 'dark');
      square.dataset.row = row;
      square.dataset.col = col;
      const piece = board[row][col];
      if(piece) square.innerHTML = pieceHTML(piece);
      // geser serat kayu tiap kotak biar tidak terlihat berulang
      square.style.backgroundPosition = ((row * 37 + col * 91) % 200) + 'px ' + ((row * 53 + col * 29) % 200) + 'px';
      if(selected && selected.row == row && selected.col == col) square.classList.add('selected');
      if(inCheck && kingPos.row == row && kingPos.col == col) square.classList.add('check');
      if(validMoves.some(m => m.row == row && m.col == col)) {
        square.classList.add('highlight');
        if(piece && isEnemy(piece, selectedColor)) square.classList.add('capture');
      }
      square.onclick = () => handleClick(row, col);
      boardEl.appendChild(square);
    }
  }
}

function handleClick(row, col) {
  if(animating || pendingPromotion || isGameOver()) return;
  if(gameMode == 'bot' && turn == botColor) return;
  const piece = board[row][col];
  if(!selected) {
    if(piece && isMyTurn(piece)) {
      selected = {row, col};
      validMoves = getValidMoves(row, col);
      renderBoard();
    }
    return;
  }
  const move = validMoves.find(m => m.row == row && m.col == col);
  if(move) {
    const from = selected;
    selected = null;
    validMoves = [];
    const mover = board[from.row][from.col];
    if(mover.toLowerCase() == 'p' && (row == 0 || row == 7)) {
      askPromotion(from, row, col, move);   // pemain pilih bidak dulu
      renderBoard();
      return;
    }
    makeMove(from.row, from.col, row, col, move); // makeMove yang render ulang papan setelah animasi
    return;
  }
  // klik bidak sendiri lain = ganti pilihan
  if(piece && isMyTurn(piece) && !(selected.row == row && selected.col == col)) {
    selected = {row, col};
    validMoves = getValidMoves(row, col);
  } else {
    selected = null;
    validMoves = [];
  }
  renderBoard();
}

function makeMove(fromRow, fromCol, toRow, toCol, moveData) {
  const piece = board[fromRow][fromCol];
  const targetPiece = board[toRow][toCol];
  const isCapture = (targetPiece && targetPiece !== '') || !!moveData.enPassant;

  // FIX #2: tentukan bidak yang tertangkap SEBELUM papan berubah,
  // termasuk kasus en passant (bidak yang dimakan ada di baris asal, kolom tujuan)
  let capturedPiece = null;
  if(targetPiece && targetPiece !== '') {
    capturedPiece = targetPiece;
  } else if(moveData.enPassant) {
    capturedPiece = board[fromRow][toCol];
  }

  // 1. Animasi dulu
  animating = true;
  animatePieceMove(fromRow, fromCol, toRow, toCol, () => {
    animating = false;
    // 2. Setelah animasi selesai, baru update logic beneran
    history.push({
      board: JSON.parse(JSON.stringify(board)),
      castling: {...castling},
      enPassant: enPassant,
      turn: turn,
      capturedWhite: [...capturedWhite],
      capturedBlack: [...capturedBlack],
      halfmoveClock: halfmoveClock,
      posLen: positionLog.length
    });

    if(moveData.enPassant) board[fromRow][toCol] = '';
    if(moveData.castling) {
      if(toCol == 6) { board[toRow][5] = board[toRow][7]; board[toRow][7] = ''; }
      else { board[toRow][3] = board[toRow][0]; board[toRow][0] = ''; }
    }
    if(piece.toLowerCase() == 'k') {
      if(turn == 'w') { castling.wK = false; castling.wQ = false; }
      else { castling.bK = false; castling.bQ = false; }
    }
    updateRookRights(fromRow, fromCol, toRow, toCol);
    enPassant = null;
    if(piece.toLowerCase() == 'p' && Math.abs(toRow - fromRow) == 2) {
      enPassant = {row: (fromRow + toRow)/2, col: fromCol};
    }
    board[toRow][toCol] = promotedPiece(piece, toRow, moveData);
    board[fromRow][fromCol] = '';
    halfmoveClock = (piece.toLowerCase() == 'p' || capturedPiece) ? 0 : halfmoveClock + 1;

    // FIX #2: catat bidak yang tertangkap ke array yang benar
    if(capturedPiece) {
      if(capturedPiece == capturedPiece.toUpperCase()) {
        capturedWhite.push(capturedPiece);
      } else {
        capturedBlack.push(capturedPiece);
      }
    }

    playSound(isCapture? 'capture' : 'move');
    turn = turn == 'w'? 'b' : 'w';
    positionLog.push(positionKey());
    updateStatus();
    checkGameEnd();
    updateCaptured();
    renderBoard();

    if(gameMode == 'bot' && turn == botColor && !isGameOver()) {
      setTimeout(botMove, 800);
    }
  });
}

// Fungsi animasi ngesot
function animatePieceMove(fromRow, fromCol, toRow, toCol, callback) {
  const boardEl = document.getElementById('board');
  const fromSquare = boardEl.children[fromRow * 8 + fromCol];
  const toSquare = boardEl.children[toRow * 8 + toCol];
  const piece = board[fromRow][fromCol];

  if(!fromSquare || !piece) {
    callback();
    return;
  }

  const pieceDiv = document.createElement('div');
  pieceDiv.className = 'piece moving';
  pieceDiv.innerHTML = pieceHTML(piece);
  pieceDiv.style.position = 'absolute';
  pieceDiv.style.pointerEvents = 'none';

  const fromRect = fromSquare.getBoundingClientRect();
  const toRect = toSquare.getBoundingClientRect();
  const boardRect = boardEl.getBoundingClientRect();

  pieceDiv.style.width = fromRect.width + 'px';
  pieceDiv.style.height = fromRect.height + 'px';
  pieceDiv.style.left = (fromRect.left - boardRect.left) + 'px';
  pieceDiv.style.top = (fromRect.top - boardRect.top) + 'px';

  boardEl.style.position = 'relative';
  boardEl.appendChild(pieceDiv);
  fromSquare.innerHTML = '';

  // Force reflow
  pieceDiv.offsetHeight;

  pieceDiv.style.left = (toRect.left - boardRect.left) + 'px';
  pieceDiv.style.top = (toRect.top - boardRect.top) + 'px';

  setTimeout(() => {
    if(pieceDiv.parentNode) pieceDiv.parentNode.removeChild(pieceDiv);
    callback();
  }, 400);
}

function promotedPiece(piece, toRow, moveData) {
  if(piece == 'P' && toRow == 0) return ((moveData && moveData.promotion) || 'q').toUpperCase();
  if(piece == 'p' && toRow == 7) return ((moveData && moveData.promotion) || 'q').toLowerCase();
  return piece;
}

function positionKey() {
  return board.map(r => r.map(x => x || '.').join('')).join('/') + ' ' + turn + ' ' +
    (castling.wK ? 'K' : '') + (castling.wQ ? 'Q' : '') + (castling.bK ? 'k' : '') + (castling.bQ ? 'q' : '') +
    ' ' + (enPassant ? enPassant.row + '' + enPassant.col : '-');
}

function isThreefold() {
  const key = positionLog[positionLog.length - 1];
  return positionLog.filter(k => k == key).length >= 3;
}

function isInsufficientMaterial() {
  const rest = [];
  for(let r = 0; r < 8; r++)
    for(let c = 0; c < 8; c++) {
      const x = board[r][c];
      if(x && x.toLowerCase() != 'k') rest.push({t: x.toLowerCase(), sq: (r + c) % 2});
    }
  if(rest.length == 0) return true;                                  // K vs K
  if(rest.length == 1 && (rest[0].t == 'b' || rest[0].t == 'n')) return true; // K+B / K+N vs K
  // hanya gajah, semuanya di warna kotak yang sama
  if(rest.every(x => x.t == 'b' && x.sq == rest[0].sq)) return true;
  return false;
}

function showGameOver(title, sub) {
  document.getElementById('gameOverText').textContent = title;
  document.getElementById('gameOverSubtext').textContent = sub;
  document.getElementById('gameOverOverlay').classList.remove('hidden');
  document.getElementById('board').style.pointerEvents = 'none';
}

// ===== PILIH PROMOSI PION =====
function askPromotion(from, row, col, move) {
  pendingPromotion = {from, row, col, move};
  const white = board[from.row][from.col] == 'P';
  document.querySelectorAll('#promotionOverlay .promo-btn').forEach(btn => {
    const t = btn.dataset.piece;
    btn.innerHTML = pieceSVG(white ? t.toUpperCase() : t);
  });
  document.getElementById('promotionOverlay').classList.remove('hidden');
}

function choosePromotion(letter) {
  if(!pendingPromotion) return;
  const {from, row, col, move} = pendingPromotion;
  pendingPromotion = null;
  document.getElementById('promotionOverlay').classList.add('hidden');
  makeMove(from.row, from.col, row, col, {...move, promotion: letter});
}

function cancelPromotion() {
  if(!pendingPromotion) return;
  const {from} = pendingPromotion;
  pendingPromotion = null;
  document.getElementById('promotionOverlay').classList.add('hidden');
  selected = {row: from.row, col: from.col};
  validMoves = getValidMoves(from.row, from.col);
  renderBoard();
}

// hak rokade hilang jika benteng di pojok awal bergerak ATAU dimakan
function updateRookRights(fromRow, fromCol, toRow, toCol) {
  const corners = [[7,0,'wQ'],[7,7,'wK'],[0,0,'bQ'],[0,7,'bK']];
  corners.forEach(([r,c,key]) => {
    if((fromRow == r && fromCol == c) || (toRow == r && toCol == c)) castling[key] = false;
  });
}

function checkGameEnd() {
  if(isCheckmate(turn)) {
    playSound('checkmate');
    showGameOver('Skakmat!', (turn == 'w'? 'Hitam' : 'Putih') + ' menang!');
  } else if(isStalemate(turn)) {
    playSound('check');
    showGameOver('Remis!', 'Stalemate - tidak ada langkah legal');
  } else if(isInsufficientMaterial()) {
    playSound('check');
    showGameOver('Remis!', 'Bidak tersisa tidak cukup untuk skakmat');
  } else if(halfmoveClock >= 100) {
    playSound('check');
    showGameOver('Remis!', 'Aturan 50 langkah: tidak ada pion jalan atau bidak dimakan');
  } else if(isThreefold()) {
    playSound('check');
    showGameOver('Remis!', 'Posisi yang sama terulang 3 kali');
  } else if(isCheck(turn)) {
    playSound('check');
    document.getElementById('status').textContent = 'Skak! Giliran: ' + (turn == 'w'? 'Putih' : 'Hitam');
  }
}

function isGameOver() {
  return document.getElementById('gameOverOverlay').classList.contains('hidden') == false;
}

// ===== BOT AI =====
function botMove() {
  if(gameMode != 'bot' || turn != botColor || animating || isGameOver()) return;
  let move;
  let depth = 2;
  if(botDifficulty == 'easy') {
    move = getRandomMove(botColor);
  } else if(botDifficulty == 'normal') {
    depth = 2;
    move = getBestMove(depth);
  } else if(botDifficulty == 'hard') {
    depth = 3;
    move = getBestMove(depth);
  } else if(botDifficulty == 'insane') {
    depth = 4;
    move = getBestMove(depth);
  }
  if(move) makeMove(move.from.row, move.from.col, move.to.row, move.to.col, move.data);
}

function getRandomMove(color) {
  let allMoves = [];
  for(let r = 0; r < 8; r++) {
    for(let c = 0; c < 8; c++) {
      if(board[r][c] && (color == 'w'? board[r][c] == board[r][c].toUpperCase() : board[r][c] == board[r][c].toLowerCase())) {
        let moves = getValidMoves(r, c);
        moves.forEach(m => allMoves.push({from: {row: r, col: c}, to: {row: m.row, col: m.col}, data: m}));
      }
    }
  }
  if(allMoves.length == 0) return null;
  return allMoves[Math.floor(Math.random() * allMoves.length)];
}

function getBestMove(depth) {
  let bestScore = -Infinity;
  let bestMove = null;
  let moves = orderMoves(getAllValidMoves(botColor));
  if(moves.length == 0) return null;

  for(let m of moves) {
    makeTempMove(m.from.row, m.from.col, m.to.row, m.to.col, m.data);
    let score = minimax(depth - 1, -Infinity, Infinity, false);
    undoTempMove();
    if(score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
  }
  return bestMove;
}
let tempMoveStack = [];

// langkah makan bidak mahal dicoba duluan -> alpha-beta jauh lebih cepat
function orderMoves(moves) {
  const val = m => {
    const t = board[m.to.row][m.to.col];
    return t ? pieceValue[t.toLowerCase()] : (m.data.enPassant ? 100 : 0);
  };
  return moves.sort((a, b) => val(b) - val(a));
}

function makeTempMove(fromRow, fromCol, toRow, toCol, moveData) {
  tempMoveStack.push({
    board: board.map(r => r.slice()),
    castling: {...castling},
    enPassant: enPassant,
    turn: turn
  });

  const piece = board[fromRow][fromCol];

  // Handle en passant
  if(moveData.enPassant) {
    board[fromRow][toCol] = '';
  }

  // Handle castling
  if(moveData.castling) {
    if(toCol == 6) {
      board[toRow][5] = board[toRow][7];
      board[toRow][7] = '';
    } else {
      board[toRow][3] = board[toRow][0];
      board[toRow][0] = '';
    }
  }

  // Handle promosi
  board[toRow][toCol] = promotedPiece(piece, toRow, moveData);
  board[fromRow][fromCol] = '';

  // Update en passant
  enPassant = null;
  if(piece.toLowerCase() == 'p' && Math.abs(toRow - fromRow) == 2) {
    enPassant = {row: (fromRow + toRow)/2, col: fromCol};
  }

  // Update castling rights
  if(piece.toLowerCase() == 'k') {
    if(turn == 'w') { castling.wK = false; castling.wQ = false; }
    else { castling.bK = false; castling.bQ = false; }
  }
  updateRookRights(fromRow, fromCol, toRow, toCol);

  turn = turn == 'w'? 'b' : 'w';
}

function undoTempMove() {
  if(tempMoveStack.length > 0) {
    const last = tempMoveStack.pop();
    board = last.board;
    castling = last.castling;
    enPassant = last.enPassant;
    turn = last.turn;
  }
}

function minimax(depth, alpha, beta, isMaximizing) {
  if(depth == 0) return evaluateBoard();
  let color = isMaximizing? botColor : (botColor == 'w'? 'b' : 'w');
  let moves = orderMoves(getAllValidMoves(color));
  if(moves.length == 0) {
    if(isCheck(color)) return isMaximizing? -100000 - depth : 100000 + depth;
    return 0;
  }
  if(isMaximizing) {
    let maxEval = -Infinity;
    for(let m of moves) {
      makeTempMove(m.from.row, m.from.col, m.to.row, m.to.col, m.data);
      let evalScore = minimax(depth - 1, alpha, beta, false);
      undoTempMove();
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if(beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for(let m of moves) {
      // FIX #1: m.data sebelumnya tidak dikirim -> moveData undefined -> crash
      makeTempMove(m.from.row, m.from.col, m.to.row, m.to.col, m.data);
      let evalScore = minimax(depth - 1, alpha, beta, true);
      undoTempMove();
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if(beta <= alpha) break;
    }
    return minEval;
  }
}

function evaluateBoard() {
  let score = 0;
  for(let r = 0; r < 8; r++) {
    for(let c = 0; c < 8; c++) {
      let p = board[r][c];
      if(p) {
        let val = pieceValue[p.toLowerCase()];
        score += (p == p.toUpperCase())? val : -val;
      }
    }
  }
  return botColor == 'w'? score : -score;
}
function getAllValidMoves(color) {
  let moves = [];
  for(let r = 0; r < 8; r++) {
    for(let c = 0; c < 8; c++) {
      if(board[r][c] && (color == 'w'? board[r][c] == board[r][c].toUpperCase() : board[r][c] == board[r][c].toLowerCase())) {
        let valid = getValidMoves(r, c);
        valid.forEach(m => moves.push({from: {row: r, col: c}, to: {row: m.row, col: m.col}, data: m}));
      }
    }
  }
  return moves;
}

function getValidMoves(row, col) {
  const piece = board[row][col];
  let moves = [];
  const color = piece == piece.toUpperCase()? 'w' : 'b';
  const addMove = (r, c, extra = {}) => {
    if(r < 0 || r > 7 || c < 0 || c > 7) return false;
    if(!board[r][c] || isEnemy(board[r][c], color)) {
      moves.push({row: r, col: c, ...extra});
      return !board[r][c];
    }
    return false;
  };
  const dir = color == 'w'? -1 : 1;
  const startRow = color == 'w'? 6 : 1;
  switch(piece.toLowerCase()) {
    case 'p':
      if(!board[row + dir]?.[col]) {
        addMove(row + dir, col);
        if(row == startRow && !board[row + dir*2]?.[col]) addMove(row + dir*2, col);
      }
      if(col > 0 && isEnemy(board[row + dir]?.[col - 1], color)) addMove(row + dir, col - 1);
      if(col < 7 && isEnemy(board[row + dir]?.[col + 1], color)) addMove(row + dir, col + 1);
      if(enPassant && row == (color == 'w'? 3 : 4)) {
        if(enPassant.col == col - 1) addMove(enPassant.row, enPassant.col, {enPassant: true});
        if(enPassant.col == col + 1) addMove(enPassant.row, enPassant.col, {enPassant: true});
      }
      break;
    case 'r': for(let i = 1; addMove(row + i, col); i++); for(let i = 1; addMove(row - i, col); i++); for(let i = 1; addMove(row, col + i); i++); for(let i = 1; addMove(row, col - i); i++); break;
    case 'n': [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc]) => addMove(row + dr, col + dc)); break;
    case 'b': for(let i = 1; addMove(row + i, col + i); i++); for(let i = 1; addMove(row + i, col - i); i++); for(let i = 1; addMove(row - i, col + i); i++); for(let i = 1; addMove(row - i, col - i); i++); break;
    case 'q': for(let i = 1; addMove(row + i, col); i++); for(let i = 1; addMove(row - i, col); i++); for(let i = 1; addMove(row, col + i); i++); for(let i = 1; addMove(row, col - i); i++); for(let i = 1; addMove(row + i, col + i); i++); for(let i = 1; addMove(row + i, col - i); i++); for(let i = 1; addMove(row - i, col + i); i++); for(let i = 1; addMove(row - i, col - i); i++); break;
    case 'k':
      for(let dr = -1; dr <= 1; dr++) for(let dc = -1; dc <= 1; dc++) if(dr || dc) addMove(row + dr, col + dc);
      const c = color == 'w'? castling.wK : castling.bK;
      const cQ = color == 'w'? castling.wQ : castling.bQ;
      const r = color == 'w'? 7 : 0;
      // FIX #3: kotak TUJUAN raja (6 untuk kingside, 2 untuk queenside) juga wajib dicek aman
      if(c && !board[r][5] && !board[r][6] && !isAttacked(r, 4, color) && !isAttacked(r, 5, color) && !isAttacked(r, 6, color)) moves.push({row: r, col: 6, castling: true});
      if(cQ && !board[r][1] && !board[r][2] && !board[r][3] && !isAttacked(r, 4, color) && !isAttacked(r, 3, color) && !isAttacked(r, 2, color)) moves.push({row: r, col: 2, castling: true});
      break;
  }
  return moves.filter(m => !wouldBeInCheck(row, col, m.row, m.col, m));
}

function wouldBeInCheck(fromRow, fromCol, toRow, toCol, moveData) {
  const temp = board[toRow][toCol];
  const piece = board[fromRow][fromCol];
  const epPawn = moveData && moveData.enPassant ? board[fromRow][toCol] : null;
  if(epPawn) board[fromRow][toCol] = '';
  board[toRow][toCol] = piece;
  board[fromRow][fromCol] = '';
  const color = piece == piece.toUpperCase()? 'w' : 'b';
  const inCheck = isCheck(color);
  board[fromRow][fromCol] = piece;
  board[toRow][toCol] = temp;
  if(epPawn) board[fromRow][toCol] = epPawn;
  return inCheck;
}

function isCheck(color) {
  let kingPos = null;
  for(let r = 0; r < 8; r++) {
    for(let c = 0; c < 8; c++) {
      if(board[r][c] && board[r][c].toLowerCase() == 'k' && (board[r][c] == board[r][c].toUpperCase()) == (color == 'w')) {
        kingPos = {row: r, col: c};
        break;
      }
    }
    if(kingPos) break;
  }
  return kingPos && isAttacked(kingPos.row, kingPos.col, color);
}

function isStalemate(color) {
  if(isCheck(color)) return false;
  for(let r = 0; r < 8; r++) {
    for(let c = 0; c < 8; c++) {
      if(board[r][c] && (color == 'w'? board[r][c] == board[r][c].toUpperCase() : board[r][c] == board[r][c].toLowerCase())) {
        if(getValidMoves(r, c).length > 0) return false;
      }
    }
  }
  return true;
}

function isAttacked(row, col, color) {
  for(let r = 0; r < 8; r++) {
    for(let c = 0; c < 8; c++) {
      if(board[r][c] && isEnemy(board[r][c], color)) {
        const moves = getMovesNoCheck(r, c);
        if(moves.some(m => m.row == row && m.col == col)) return true;
      }
    }
  }
  return false;
}

function getMovesNoCheck(row, col) {
  const piece = board[row][col];
  let moves = [];
  const color = piece == piece.toUpperCase()? 'w' : 'b';
  const dir = color == 'w'? -1 : 1;
  const add = (r, c) => {
    if(r < 0 || r > 7 || c < 0 || c > 7) return false;
    moves.push({row: r, col: c});
    return !board[r][c];
  };
  switch(piece.toLowerCase()) {
    // FIX #4: pion cuma "menyerang" secara diagonal, bukan kotak lurus di depannya
    case 'p': if(col > 0) add(row + dir, col - 1); if(col < 7) add(row + dir, col + 1); break;
    case 'n': [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc]) => add(row + dr, col + dc)); break;
    case 'b': for(let i=1;add(row+i,col+i);i++); for(let i=1;add(row+i,col-i);i++); for(let i=1;add(row-i,col+i);i++); for(let i=1;add(row-i,col-i);i++); break;
    case 'r': for(let i=1;add(row+i,col);i++); for(let i=1;add(row-i,col);i++); for(let i=1;add(row,col+i);i++); for(let i=1;add(row,col-i);i++); break;
    case 'q': for(let i=1;add(row+i,col);i++); for(let i=1;add(row-i,col);i++); for(let i=1;add(row,col+i);i++); for(let i=1;add(row,col-i);i++); for(let i=1;add(row+i,col+i);i++); for(let i=1;add(row+i,col-i);i++); for(let i=1;add(row-i,col+i);i++); for(let i=1;add(row-i,col-i);i++); break;
    case 'k': for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++) if(dr||dc) add(row+dr,col+dc); break;
  }
  return moves;
}

function isCheckmate(color) {
  if(!isCheck(color)) return false;
  for(let r = 0; r < 8; r++)
    for(let c = 0; c < 8; c++)
      if(board[r][c] && (color == 'w'? board[r][c] == board[r][c].toUpperCase() : board[r][c] == board[r][c].toLowerCase()))
        if(getValidMoves(r, c).length > 0) return false;
  return true;
}

function isMyTurn(piece) {
  return turn == 'w'? piece == piece.toUpperCase() : piece == piece.toLowerCase();
}

function isEnemy(p, color) {
  return p && (color == 'w'? p == p.toLowerCase() : p == p.toUpperCase());
}

function updateStatus() {
  document.getElementById('status').textContent = 'Giliran: ' + (turn == 'w'? 'Putih' : 'Hitam');
}

// FIX #2: render langsung dari array capturedWhite / capturedBlack
function updateCaptured() {
  const mini = p => '<span class="cap-pc">' + pieceSVG(p) + '</span>';
  document.getElementById('capturedWhite').innerHTML = capturedWhite.map(mini).join('');
  document.getElementById('capturedBlack').innerHTML = capturedBlack.map(mini).join('');
}

function resetGame() { initBoard(); }

function undoMove() {
  if(animating || pendingPromotion) return;
  // vs bot: mundur 2 langkah (langkah bot + langkah kamu) supaya giliran balik ke kamu
  const steps = (gameMode == 'bot' && history.length > 1 && turn != botColor) ? 2 : 1;
  for(let i = 0; i < steps && history.length > 0; i++) {
    const last = history.pop();
    board = last.board;
    castling = last.castling;
    enPassant = last.enPassant;
    turn = last.turn;
    capturedWhite = last.capturedWhite || [];
    capturedBlack = last.capturedBlack || [];
    halfmoveClock = last.halfmoveClock || 0;
    positionLog.length = last.posLen;
  }
  selected = null;
  validMoves = [];
  document.getElementById('gameOverOverlay').classList.add('hidden');
  document.getElementById('board').style.pointerEvents = 'auto';
  updateStatus();
  updateCaptured();
  renderBoard();
  if(gameMode == 'bot' && turn == botColor) setTimeout(botMove, 500);
}

window.onload = () => { buildCoords(); initBoard(); };
