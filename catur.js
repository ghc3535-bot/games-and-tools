/* ==========================================================================
   CATUR — logika permainan & tampilan
   Dibagi per bagian:
     1. Bidak SVG (sprite) & tekstur kayu
     2. Tema, suara, pengaturan
     3. Status permainan
     4. Papan & tampilan (render bertahap)
     5. Langkah, notasi (SAN), animasi
     6. Aturan catur (legal move, skak, remis)
     7. Jam catur
     8. Bot (mesin di Web Worker)
     9. Simpan / lanjutkan
    10. Undo, reset, inisialisasi
   Mesin bot ada di catur-engine.js
   ========================================================================== */

/* ===== 1. BIDAK SVG & TEKSTUR ===== */
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

// lapisan gambar satu bidak (outline tebal hitam, bidak hitam punya garis putih tipis di dalam)
function pieceLayers(piece) {
  const white = piece === piece.toUpperCase();
  const def = PIECE_SHAPES[piece.toLowerCase()];
  const shape = def.body + BASE_SHAPE;
  const fill = white ? '#fdfdfd' : '#111';
  const ink = white ? '#111' : '#f4f4f4';
  let layers = '<g fill="#000" stroke="#000" stroke-width="9" stroke-linejoin="round">' + shape + '</g>';
  if (!white) layers += '<g fill="#fff" stroke="#fff" stroke-width="4.5" stroke-linejoin="round">' + shape + '</g>';
  layers += '<g fill="' + fill + '">' + shape + '</g>';
  if (def.detail) layers += '<g fill="none" stroke="' + ink + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' + def.detail + '</g>';
  return layers;
}

const symId = piece => 'pc-' + (piece === piece.toUpperCase() ? 'w' : 'b') + piece.toLowerCase();

// 12 bidak digambar SEKALI sebagai <symbol>; papan hanya memakainya lewat <use> (DOM jauh lebih kecil)
function buildSprite() {
  if (document.getElementById('pieceSprite')) return;
  let defs = '';
  for (const ch of 'PNBRQKpnbrqk') defs += '<symbol id="' + symId(ch) + '" viewBox="0 0 100 100">' + pieceLayers(ch) + '</symbol>';
  document.body.insertAdjacentHTML('afterbegin',
    '<svg id="pieceSprite" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' + defs + '</defs></svg>');
}
const pieceSVG = piece => '<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#' + symId(piece) + '"/></svg>';
const pieceHTML = piece => '<div class="pc ' + (piece === piece.toUpperCase() ? 'w' : 'b') + '">' + pieceSVG(piece) + '</div>';

// serat kayu dibuat sekali di canvas kecil (bukan filter SVG yang berat), lalu dipakai sebagai gambar ubin
function makeGrain() {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    const g = c.getContext('2d');
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 110; i++) {
      const y = rnd() * 160, a = 0.03 + rnd() * 0.10, w = 0.5 + rnd() * 2.2, amp = rnd() * 2.2;
      g.strokeStyle = 'rgba(70,35,10,' + a.toFixed(3) + ')';
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= 160; x += 16) g.lineTo(x, y + Math.sin(x / 160 * Math.PI * 4 + i) * amp);
      g.stroke();
    }
    const u = 'url(' + c.toDataURL('image/png') + ')';
    let st = document.getElementById('grainStyle');
    if (!st) { st = document.createElement('style'); st.id = 'grainStyle'; document.head.appendChild(st); }
    st.textContent =
      'body{background-image:var(--planks),' + u + '}' +
      '.board-frame,.square.light,.square.dark,.promo-btn{background-image:' + u + '}' +
      '.square.light.check,.square.dark.check{background-image:var(--check-glow),' + u + '}';
  } catch (e) { /* tanpa tekstur pun tetap jalan */ }
}

/* ===== 2. TEMA, SUARA, PENGATURAN ===== */
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

let ANIMATE = true; // false = bidak langsung pindah (hemat baterai/CPU, juga dipakai saat pengujian)
function setAnimMode(v) {
  ANIMATE = v !== 'off';
  try { localStorage.setItem('catur_anim', v); } catch (e) {}
}

let audioCtx;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playSound(type) {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') return; // belum ada interaksi pengguna
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime;
    if (type === 'move') { osc.frequency.value = 800; gain.gain.setValueAtTime(0.3, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08); osc.start(); osc.stop(t + 0.08); }
    if (type === 'capture') { osc.frequency.value = 400; gain.gain.setValueAtTime(0.4, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15); osc.start(); osc.stop(t + 0.15); }
    if (type === 'check') { osc.frequency.value = 600; gain.gain.setValueAtTime(0.4, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3); osc.start(); osc.stop(t + 0.3); }
    if (type === 'checkmate') { osc.frequency.setValueAtTime(500, t); osc.frequency.setValueAtTime(700, t + 0.2); gain.gain.setValueAtTime(0.4, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4); osc.start(); osc.stop(t + 0.4); }
  } catch (e) { /* suara tidak wajib */ }
}
document.addEventListener('click', () => { try { getAudioCtx().resume(); } catch (e) {} }, { once: true });

/* ===== 3. STATUS PERMAINAN ===== */
let board = [];
let turn = 'w';
let selected = null;
let validMoves = [];
let history = [];            // snapshot sebelum tiap langkah (untuk undo)
let moveLog = [];            // notasi tiap langkah, mis. "Nf3", "O-O", "exd5+"
let castling = { wK: true, wQ: true, bK: true, bQ: true };
let enPassant = null;

let gameMode = 'pvp';
let botDifficulty = 'normal';
let botColor = 'b';

let capturedWhite = [];      // bidak putih yang sudah dimakan lawan
let capturedBlack = [];      // bidak hitam yang sudah dimakan lawan
let animating = false;
let halfmoveClock = 0;       // langkah sejak terakhir ada pion jalan / bidak dimakan
let positionLog = [];        // kunci posisi tiap langkah (untuk pengulangan 3x)
let pendingPromotion = null;
let gameEnded = false;       // game sudah selesai (popup boleh ditutup, tetapi papan tetap terkunci)
let gameResult = null;       // { title, sub } hasil akhir

function setGameMode(mode) {
  gameMode = mode;
  document.getElementById('btn-pvp')?.classList.remove('active');
  document.getElementById('btn-bot')?.classList.remove('active');
  document.getElementById('btn-' + mode)?.classList.add('active');
  resetGame();
}
function setBotDifficulty(diff) { botDifficulty = diff; }
function setBotColor(color) { botColor = color; resetGame(); }

/* ===== 4. PAPAN & TAMPILAN (dibuat sekali, diperbarui seperlunya) ===== */
const squares = [];          // 64 elemen kotak, indeks = row * 8 + col

function buildBoard() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  squares.length = 0;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const sq = document.createElement('div');
      sq.className = 'square ' + ((row + col) % 2 === 0 ? 'light' : 'dark');
      sq.dataset.row = row;
      sq.dataset.col = col;
      // geser serat kayu tiap kotak supaya tidak terlihat berulang (sekali saja, bukan tiap render)
      sq.style.backgroundPosition = ((row * 37 + col * 91) % 160) + 'px ' + ((row * 53 + col * 29) % 160) + 'px';
      sq._p = '';
      sq._cls = sq.className;
      sq.onclick = () => handleClick(row, col);
      boardEl.appendChild(sq);
      squares.push(sq);
    }
  }
}

function buildCoords() {
  const files = 'abcdefgh'.split('').map(f => '<span>' + f + '</span>').join('');
  const ranks = [8, 7, 6, 5, 4, 3, 2, 1].map(n => '<span>' + n + '</span>').join('');
  document.getElementById('coordsTop').innerHTML = files;
  document.getElementById('coordsBottom').innerHTML = files;
  document.getElementById('coordsLeft').innerHTML = ranks;
  document.getElementById('coordsRight').innerHTML = ranks;
}

function findKing(color) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.toLowerCase() == 'k' && (p == p.toUpperCase()) == (color == 'w')) return { row: r, col: c };
    }
  return null;
}

// hanya kotak yang berubah (bidak atau penanda) yang disentuh DOM-nya
function renderBoard() {
  if (squares.length != 64) buildBoard();
  const pvp = gameMode == 'pvp';
  document.getElementById('board').classList.toggle('pvp', pvp);
  document.getElementById('boardFrame').classList.toggle('pvp', pvp);
  const sel = selected ? board[selected.row][selected.col] : '';
  const selectedColor = sel ? (sel == sel.toUpperCase() ? 'w' : 'b') : null;
  const kingPos = findKing(turn);
  const inCheck = kingPos && isCheck(turn);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const sq = squares[row * 8 + col];
      const piece = board[row][col];
      if (sq._p !== piece) {
        sq.innerHTML = piece ? pieceHTML(piece) : '';
        sq._p = piece;
      }
      let cls = 'square ' + ((row + col) % 2 === 0 ? 'light' : 'dark');
      if (selected && selected.row == row && selected.col == col) cls += ' selected';
      if (inCheck && kingPos.row == row && kingPos.col == col) cls += ' check';
      if (validMoves.some(m => m.row == row && m.col == col)) {
        cls += ' highlight';
        if (piece && isEnemy(piece, selectedColor)) cls += ' capture';
      }
      if (sq._cls !== cls) { sq.className = cls; sq._cls = cls; }
    }
  }
}

function updateStatus() {
  const el = document.getElementById('status');
  el.classList.toggle('ended', gameEnded);
  if (gameEnded && gameResult) el.textContent = gameResult.title + ' ' + gameResult.sub;
  else if (botThinking) el.textContent = 'Bot berpikir…';
  else el.textContent = 'Giliran: ' + (turn == 'w' ? 'Putih' : 'Hitam');
}
function setThinking(on) {
  botThinking = on;
  document.getElementById('status')?.classList.toggle('thinking', on);
  updateStatus();
}

function updateCaptured() {
  const mini = p => '<span class="cap-pc">' + pieceSVG(p) + '</span>';
  document.getElementById('capturedWhite').innerHTML = capturedWhite.map(mini).join('');
  document.getElementById('capturedBlack').innerHTML = capturedBlack.map(mini).join('');
}

function updateMoveList() {
  const el = document.getElementById('moveList');
  if (!el) return;
  if (moveLog.length == 0) {
    el.innerHTML = '<div class="mv-empty">Belum ada langkah</div>';
    document.getElementById('moveCount').textContent = '';
    return;
  }
  let html = '';
  for (let i = 0; i < moveLog.length; i += 2) {
    const last = moveLog.length - 1;
    html += '<div class="mv-row"><span class="mv-n">' + (i / 2 + 1) + '.</span>' +
      '<span class="mv' + (i == last ? ' now' : '') + '">' + moveLog[i] + '</span>' +
      '<span class="mv' + (i + 1 == last ? ' now' : '') + '">' + (moveLog[i + 1] || '') + '</span></div>';
  }
  el.innerHTML = html;
  el.scrollTop = el.scrollHeight;
  document.getElementById('moveCount').textContent = '(' + moveLog.length + ')';
}

function movesAsPGN() {
  return moveLog.map((m, i) => (i % 2 == 0 ? (i / 2 + 1) + '. ' : '') + m).join(' ');
}
function copyMoves() {
  const st = document.getElementById('moveStatus');
  const show = t => { st.textContent = t; clearTimeout(window.__mvSt); window.__mvSt = setTimeout(() => { st.textContent = ''; }, 2500); };
  if (moveLog.length == 0) { show('Belum ada langkah.'); return; }
  if (!navigator.clipboard) { show('Browser tidak mendukung salin.'); return; }
  navigator.clipboard.writeText(movesAsPGN()).then(() => show('Langkah disalin.'), () => show('Gagal menyalin.'));
}

/* ===== 5. LANGKAH, NOTASI, ANIMASI ===== */
function handleClick(row, col) {
  if (animating || pendingPromotion || isGameOver()) return;
  if (gameMode == 'bot' && turn == botColor) return;
  const piece = board[row][col];
  if (!selected) {
    if (piece && isMyTurn(piece)) {
      selected = { row, col };
      validMoves = getValidMoves(row, col);
      renderBoard();
    }
    return;
  }
  const move = validMoves.find(m => m.row == row && m.col == col);
  if (move) {
    const from = selected;
    selected = null;
    validMoves = [];
    const mover = board[from.row][from.col];
    if (mover.toLowerCase() == 'p' && (row == 0 || row == 7)) {
      askPromotion(from, row, col, move);   // pemain pilih bidak dulu
      renderBoard();
      return;
    }
    makeMove(from.row, from.col, row, col, move);
    return;
  }
  // klik bidak sendiri lain = ganti pilihan
  if (piece && isMyTurn(piece) && !(selected.row == row && selected.col == col)) {
    selected = { row, col };
    validMoves = getValidMoves(row, col);
  } else {
    selected = null;
    validMoves = [];
  }
  renderBoard();
}

// notasi aljabar standar (SAN) tanpa tanda + / # (ditambahkan setelah langkah dijalankan)
function sanBase(fr, fc, tr, tc, move, piece, isCapture) {
  const files = 'abcdefgh';
  if (move.castling) return tc == 6 ? 'O-O' : 'O-O-O';
  const t = piece.toLowerCase();
  let s = '';
  if (t == 'p') {
    if (isCapture) s += files[fc] + 'x';
    s += files[tc] + (8 - tr);
    if (tr == 0 || tr == 7) s += '=' + ((move.promotion || 'q').toUpperCase());
    return s;
  }
  s += t.toUpperCase();
  let ambiguous = false, sameFile = false, sameRank = false;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      if ((r == fr && c == fc) || board[r][c] !== piece) continue;
      if (getValidMoves(r, c).some(m => m.row == tr && m.col == tc)) {
        ambiguous = true;
        if (c == fc) sameFile = true;
        if (r == fr) sameRank = true;
      }
    }
  if (ambiguous) {
    if (!sameFile) s += files[fc];
    else if (!sameRank) s += (8 - fr);
    else s += files[fc] + (8 - fr);
  }
  if (isCapture) s += 'x';
  return s + files[tc] + (8 - tr);
}

function makeMove(fromRow, fromCol, toRow, toCol, moveData) {
  const piece = board[fromRow][fromCol];
  const targetPiece = board[toRow][toCol];
  const isCapture = (targetPiece && targetPiece !== '') || !!moveData.enPassant;

  // bidak yang tertangkap ditentukan SEBELUM papan berubah (termasuk en passant)
  let capturedPiece = null;
  if (targetPiece && targetPiece !== '') capturedPiece = targetPiece;
  else if (moveData.enPassant) capturedPiece = board[fromRow][toCol];

  const san0 = sanBase(fromRow, fromCol, toRow, toCol, moveData, piece, isCapture);
  const mover = turn;

  animating = true;
  animatePieceMove(fromRow, fromCol, toRow, toCol, () => {
    animating = false;
    // waktu habis saat bidak masih meluncur -> langkah tidak jadi
    if (clockCfg.base > 0) { tickClock(); if (flagged) { renderBoard(); return; } }

    history.push({
      board: JSON.parse(JSON.stringify(board)),
      castling: { ...castling },
      enPassant: enPassant,
      turn: turn,
      capturedWhite: [...capturedWhite],
      capturedBlack: [...capturedBlack],
      halfmoveClock: halfmoveClock,
      posLen: positionLog.length,
      clockW: clocks.w,
      clockB: clocks.b
    });

    if (moveData.enPassant) board[fromRow][toCol] = '';
    if (moveData.castling) {
      if (toCol == 6) { board[toRow][5] = board[toRow][7]; board[toRow][7] = ''; }
      else { board[toRow][3] = board[toRow][0]; board[toRow][0] = ''; }
    }
    if (piece.toLowerCase() == 'k') {
      if (turn == 'w') { castling.wK = false; castling.wQ = false; }
      else { castling.bK = false; castling.bQ = false; }
    }
    updateRookRights(fromRow, fromCol, toRow, toCol);
    enPassant = null;
    if (piece.toLowerCase() == 'p' && Math.abs(toRow - fromRow) == 2) {
      enPassant = { row: (fromRow + toRow) / 2, col: fromCol };
    }
    board[toRow][toCol] = promotedPiece(piece, toRow, moveData);
    board[fromRow][fromCol] = '';
    halfmoveClock = (piece.toLowerCase() == 'p' || capturedPiece) ? 0 : halfmoveClock + 1;

    if (capturedPiece) {
      if (capturedPiece == capturedPiece.toUpperCase()) capturedWhite.push(capturedPiece);
      else capturedBlack.push(capturedPiece);
    }

    // jam: tambahan waktu untuk yang baru jalan, lalu jam lawan mulai berjalan
    if (clockCfg.base > 0) {
      if (clockOn) clocks[mover] += clockCfg.inc * 1000;   // langkah pertama putih belum berjam, jadi tanpa tambahan
      if (!clockOn) startClock(); else clockStamp = Date.now();
    }

    playSound(isCapture ? 'capture' : 'move');
    turn = turn == 'w' ? 'b' : 'w';
    positionLog.push(positionKey());

    const chk = isCheck(turn);
    const mate = chk && isCheckmate(turn);
    moveLog.push(san0 + (mate ? '#' : chk ? '+' : ''));

    updateStatus();
    checkGameEnd(chk, mate);
    updateCaptured();
    updateMoveList();
    renderClocks();
    renderBoard();
    saveGame();

    if (gameMode == 'bot' && turn == botColor && !isGameOver()) {
      setTimeout(botMove, 150);
    }
  });
}

// bidak meluncur memakai transform (dikerjakan GPU, tanpa layout ulang tiap frame)
function animatePieceMove(fromRow, fromCol, toRow, toCol, callback) {
  const boardEl = document.getElementById('board');
  const fromSquare = squares[fromRow * 8 + fromCol];
  const toSquare = squares[toRow * 8 + toCol];
  const piece = board[fromRow][fromCol];

  if (!ANIMATE || !fromSquare || !piece) { callback(); return; }

  const fromRect = fromSquare.getBoundingClientRect();
  const toRect = toSquare.getBoundingClientRect();
  const boardRect = boardEl.getBoundingClientRect();

  const pieceDiv = document.createElement('div');
  pieceDiv.className = 'piece moving';
  pieceDiv.innerHTML = pieceHTML(piece);
  pieceDiv.style.width = fromRect.width + 'px';
  pieceDiv.style.height = fromRect.height + 'px';
  pieceDiv.style.left = (fromRect.left - boardRect.left) + 'px';
  pieceDiv.style.top = (fromRect.top - boardRect.top) + 'px';
  boardEl.appendChild(pieceDiv);

  const ghost = fromSquare.firstChild;
  if (ghost) ghost.style.visibility = 'hidden';

  const dx = toRect.left - fromRect.left, dy = toRect.top - fromRect.top;
  pieceDiv.getBoundingClientRect(); // paksa browser mencatat posisi awal
  pieceDiv.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0)';

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    if (pieceDiv.parentNode) pieceDiv.parentNode.removeChild(pieceDiv);
    callback();
  };
  pieceDiv.addEventListener('transitionend', finish, { once: true });
  setTimeout(finish, 320); // cadangan kalau transitionend tidak terpanggil
}

function promotedPiece(piece, toRow, moveData) {
  if (piece == 'P' && toRow == 0) return ((moveData && moveData.promotion) || 'q').toUpperCase();
  if (piece == 'p' && toRow == 7) return ((moveData && moveData.promotion) || 'q').toLowerCase();
  return piece;
}

function positionKey() {
  return board.map(r => r.map(x => x || '.').join('')).join('/') + ' ' + turn + ' ' +
    (castling.wK ? 'K' : '') + (castling.wQ ? 'Q' : '') + (castling.bK ? 'k' : '') + (castling.bQ ? 'q' : '') +
    ' ' + (enPassant ? enPassant.row + '' + enPassant.col : '-');
}

// hak rokade hilang jika benteng di pojok awal bergerak ATAU dimakan
function updateRookRights(fromRow, fromCol, toRow, toCol) {
  const corners = [[7, 0, 'wQ'], [7, 7, 'wK'], [0, 0, 'bQ'], [0, 7, 'bK']];
  corners.forEach(([r, c, key]) => {
    if ((fromRow == r && fromCol == c) || (toRow == r && toCol == c)) castling[key] = false;
  });
}

/* ===== PROMOSI PION ===== */
function askPromotion(from, row, col, move) {
  pendingPromotion = { from, row, col, move };
  const white = board[from.row][from.col] == 'P';
  document.querySelectorAll('#promotionOverlay .promo-btn').forEach(btn => {
    const t = btn.dataset.piece;
    btn.innerHTML = pieceSVG(white ? t.toUpperCase() : t);
  });
  document.getElementById('promotionOverlay').classList.remove('hidden');
}
function choosePromotion(letter) {
  if (!pendingPromotion) return;
  const { from, row, col, move } = pendingPromotion;
  pendingPromotion = null;
  document.getElementById('promotionOverlay').classList.add('hidden');
  makeMove(from.row, from.col, row, col, { ...move, promotion: letter });
}
function cancelPromotion() {
  if (!pendingPromotion) return;
  const { from } = pendingPromotion;
  pendingPromotion = null;
  document.getElementById('promotionOverlay').classList.add('hidden');
  selected = { row: from.row, col: from.col };
  validMoves = getValidMoves(from.row, from.col);
  renderBoard();
}

/* ===== 6. ATURAN CATUR ===== */
const isMyTurn = piece => turn == 'w' ? piece == piece.toUpperCase() : piece == piece.toLowerCase();
const isEnemy = (p, color) => p && (color == 'w' ? p == p.toLowerCase() : p == p.toUpperCase());
const colorOf = p => p == p.toUpperCase() ? 'w' : 'b';

function getValidMoves(row, col) {
  const piece = board[row][col];
  let moves = [];
  const color = colorOf(piece);
  const addMove = (r, c, extra = {}) => {
    if (r < 0 || r > 7 || c < 0 || c > 7) return false;
    if (!board[r][c] || isEnemy(board[r][c], color)) {
      moves.push({ row: r, col: c, ...extra });
      return !board[r][c];
    }
    return false;
  };
  const dir = color == 'w' ? -1 : 1;
  const startRow = color == 'w' ? 6 : 1;
  switch (piece.toLowerCase()) {
    case 'p':
      if (!board[row + dir]?.[col]) {
        addMove(row + dir, col);
        if (row == startRow && !board[row + dir * 2]?.[col]) addMove(row + dir * 2, col);
      }
      if (col > 0 && isEnemy(board[row + dir]?.[col - 1], color)) addMove(row + dir, col - 1);
      if (col < 7 && isEnemy(board[row + dir]?.[col + 1], color)) addMove(row + dir, col + 1);
      if (enPassant && row == (color == 'w' ? 3 : 4)) {
        if (enPassant.col == col - 1) addMove(enPassant.row, enPassant.col, { enPassant: true });
        if (enPassant.col == col + 1) addMove(enPassant.row, enPassant.col, { enPassant: true });
      }
      break;
    case 'r': for (let i = 1; addMove(row + i, col); i++); for (let i = 1; addMove(row - i, col); i++); for (let i = 1; addMove(row, col + i); i++); for (let i = 1; addMove(row, col - i); i++); break;
    case 'n': [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr, dc]) => addMove(row + dr, col + dc)); break;
    case 'b': for (let i = 1; addMove(row + i, col + i); i++); for (let i = 1; addMove(row + i, col - i); i++); for (let i = 1; addMove(row - i, col + i); i++); for (let i = 1; addMove(row - i, col - i); i++); break;
    case 'q': for (let i = 1; addMove(row + i, col); i++); for (let i = 1; addMove(row - i, col); i++); for (let i = 1; addMove(row, col + i); i++); for (let i = 1; addMove(row, col - i); i++); for (let i = 1; addMove(row + i, col + i); i++); for (let i = 1; addMove(row + i, col - i); i++); for (let i = 1; addMove(row - i, col + i); i++); for (let i = 1; addMove(row - i, col - i); i++); break;
    case 'k': {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) addMove(row + dr, col + dc);
      const c = color == 'w' ? castling.wK : castling.bK;
      const cQ = color == 'w' ? castling.wQ : castling.bQ;
      const r = color == 'w' ? 7 : 0;
      // raja tidak boleh sedang skak, melewati, atau mendarat di kotak yang diserang
      if (row == r && col == 4) {
        if (c && !board[r][5] && !board[r][6] && !isAttacked(r, 4, color) && !isAttacked(r, 5, color) && !isAttacked(r, 6, color)) moves.push({ row: r, col: 6, castling: true });
        if (cQ && !board[r][1] && !board[r][2] && !board[r][3] && !isAttacked(r, 4, color) && !isAttacked(r, 3, color) && !isAttacked(r, 2, color)) moves.push({ row: r, col: 2, castling: true });
      }
      break;
    }
  }
  return moves.filter(m => !wouldBeInCheck(row, col, m.row, m.col, m));
}

function wouldBeInCheck(fromRow, fromCol, toRow, toCol, moveData) {
  const temp = board[toRow][toCol];
  const piece = board[fromRow][fromCol];
  const epPawn = moveData && moveData.enPassant ? board[fromRow][toCol] : null;
  if (epPawn) board[fromRow][toCol] = '';
  board[toRow][toCol] = piece;
  board[fromRow][fromCol] = '';
  const inCheck = isCheck(colorOf(piece));
  board[fromRow][fromCol] = piece;
  board[toRow][toCol] = temp;
  if (epPawn) board[fromRow][toCol] = epPawn;
  return inCheck;
}

function isCheck(color) {
  const k = findKing(color);
  return !!k && isAttacked(k.row, k.col, color);
}

// apakah kotak (row,col) diserang bidak LAWAN dari `color`? Memindai dari kotak itu (tanpa membuat daftar langkah)
function isAttacked(row, col, color) {
  const enemyPawn = color == 'w' ? 'p' : 'P';
  const en = ch => color == 'w' ? ch.toLowerCase() : ch.toUpperCase();
  // pion lawan menyerang secara diagonal ke arah majunya
  const pr = color == 'w' ? row - 1 : row + 1;
  if (pr >= 0 && pr < 8) {
    if (col > 0 && board[pr][col - 1] === enemyPawn) return true;
    if (col < 7 && board[pr][col + 1] === enemyPawn) return true;
  }
  const knight = en('n'), king = en('k'), rook = en('r'), bishop = en('b'), queen = en('q');
  const KN = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  for (let i = 0; i < 8; i++) {
    const r = row + KN[i][0], c = col + KN[i][1];
    if (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === knight) return true;
  }
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const r = row + dr, c = col + dc;
    if (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === king) return true;
  }
  const D = [[-1,0],[1,0],[0,1],[0,-1],[-1,1],[-1,-1],[1,1],[1,-1]];
  for (let d = 0; d < 8; d++) {
    let r = row + D[d][0], c = col + D[d][1];
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const p = board[r][c];
      if (p) {
        if (p === queen || p === (d < 4 ? rook : bishop)) return true;
        break;
      }
      r += D[d][0]; c += D[d][1];
    }
  }
  return false;
}

function hasAnyMove(color) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && colorOf(p) == color && getValidMoves(r, c).length > 0) return true;
    }
  return false;
}
function isStalemate(color) { return !isCheck(color) && !hasAnyMove(color); }
function isCheckmate(color) { return isCheck(color) && !hasAnyMove(color); }

function isThreefold() {
  const key = positionLog[positionLog.length - 1];
  return positionLog.filter(k => k == key).length >= 3;
}

function isInsufficientMaterial() {
  const rest = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const x = board[r][c];
      if (x && x.toLowerCase() != 'k') rest.push({ t: x.toLowerCase(), sq: (r + c) % 2 });
    }
  if (rest.length == 0) return true;                                           // K vs K
  if (rest.length == 1 && (rest[0].t == 'b' || rest[0].t == 'n')) return true; // K+B / K+N vs K
  if (rest.every(x => x.t == 'b' && x.sq == rest[0].sq)) return true;          // gajah satu warna kotak
  return false;
}

// punya bidak cukup untuk (mungkin) skakmat? dipakai saat lawan kehabisan waktu
function hasMatingMaterial(color) {
  let minors = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const x = board[r][c];
      if (!x || colorOf(x) != color) continue;
      const t = x.toLowerCase();
      if (t == 'p' || t == 'r' || t == 'q') return true;
      if (t == 'n' || t == 'b') minors++;
    }
  return minors >= 2;
}

function checkGameEnd(chk, mate) {
  if (mate) {
    playSound('checkmate');
    showGameOver('Skakmat!', (turn == 'w' ? 'Hitam' : 'Putih') + ' menang!');
  } else if (isStalemate(turn)) {
    playSound('check');
    showGameOver('Remis!', 'Stalemate - tidak ada langkah legal');
  } else if (isInsufficientMaterial()) {
    playSound('check');
    showGameOver('Remis!', 'Bidak tersisa tidak cukup untuk skakmat');
  } else if (halfmoveClock >= 100) {
    playSound('check');
    showGameOver('Remis!', 'Aturan 50 langkah: tidak ada pion jalan atau bidak dimakan');
  } else if (isThreefold()) {
    playSound('check');
    showGameOver('Remis!', 'Posisi yang sama terulang 3 kali');
  } else if (chk) {
    playSound('check');
    document.getElementById('status').textContent = 'Skak! Giliran: ' + (turn == 'w' ? 'Putih' : 'Hitam');
  }
}

function showGameOver(title, sub) {
  gameEnded = true;
  gameResult = { title, sub };
  document.getElementById('gameOverText').textContent = title;
  document.getElementById('gameOverSubtext').textContent = sub;
  document.getElementById('gameOverOverlay').classList.remove('hidden');
  document.getElementById('board').style.pointerEvents = 'none';
  clockOn = false;
  cancelBot();
  clearSavedGame();      // game selesai tidak perlu dilanjutkan
  updateStatus();
}
// hanya menutup popup supaya papan terlihat; game tetap dianggap selesai
function closeGameOver() {
  document.getElementById('gameOverOverlay').classList.add('hidden');
}
// popup yang sudah ditutup tidak boleh membuat game seolah-olah berlanjut
function isGameOver() { return gameEnded; }
function clearGameEnd() {
  gameEnded = false;
  gameResult = null;
  document.getElementById('gameOverOverlay').classList.add('hidden');
}

/* ===== 7. JAM CATUR ===== */
let clockCfg = { base: 0, inc: 0 };   // base = menit per pemain (0 = tanpa jam), inc = detik tambahan per langkah
let clocks = { w: 0, b: 0 };           // sisa waktu (ms)
let clockOn = false, clockStamp = 0, clockTimer = null, flagged = false;

function fmtClock(ms) {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
function setClockBase(v) { clockCfg.base = +v; resetGame(); }
function setClockInc(v) { clockCfg.inc = +v; resetGame(); }

function resetClocks() {
  clocks.w = clocks.b = clockCfg.base * 60000;
  clockOn = false;
  flagged = false;
  renderClocks();
}
function startClock() {
  if (clockCfg.base <= 0) return;
  clockOn = true;
  clockStamp = Date.now();
  if (!clockTimer) clockTimer = setInterval(tickClock, 200);
}
function tickClock() {
  if (!clockOn) return;
  if (isGameOver()) { clockOn = false; return; }
  const now = Date.now();
  clocks[turn] -= now - clockStamp;
  clockStamp = now;
  if (clocks[turn] <= 0) { clocks[turn] = 0; renderClocks(); onFlag(turn); return; }
  renderClocks();
}
function onFlag(color) {
  flagged = true;
  clockOn = false;
  const winner = color == 'w' ? 'b' : 'w';
  if (!hasMatingMaterial(winner)) showGameOver('Remis!', (color == 'w' ? 'Putih' : 'Hitam') + ' kehabisan waktu, tetapi lawan tidak punya bidak cukup untuk skakmat');
  else showGameOver('Waktu habis!', (color == 'w' ? 'Putih' : 'Hitam') + ' kehabisan waktu. ' + (winner == 'w' ? 'Putih' : 'Hitam') + ' menang!');
}
function renderClocks() {
  const area = document.getElementById('boardArea');
  if (!area) return;
  area.classList.toggle('no-clock', clockCfg.base <= 0);
  area.classList.toggle('pvp', gameMode == 'pvp');
  ['w', 'b'].forEach(c => {
    const el = document.getElementById(c == 'w' ? 'clockW' : 'clockB');
    el.querySelector('.clock-time').textContent = fmtClock(clocks[c]);
    el.classList.toggle('active', clockOn && turn == c);
    el.classList.toggle('low', clockCfg.base > 0 && clocks[c] < 10000);
  });
}

/* ===== 8. BOT (mesin di Web Worker, lihat catur-engine.js) ===== */
const bot = createChessBot();
const BOT_MS = { easy: 200, normal: 450, hard: 1000, insane: 2000 };
// Saat memakai jam, bot 'berpikir' selama beberapa detik seperti pemain (batas atas per level).
// Tanpa ini bot membalas < 1 detik, lalu tambahan +2 detik membuat jamnya malah naik.
const BOT_PACE_MAX = { easy: 4000, normal: 6000, hard: 8000, insane: 10000 };
let botJob = 0, botThinking = false;

function cancelBot() {
  botJob++;
  bot.cancel();
  if (botThinking) setThinking(false);
}

function botMove() {
  if (gameMode != 'bot' || turn != botColor || animating || isGameOver() || botThinking || pendingPromotion) return;
  const job = ++botJob;
  setThinking(true);
  const t0 = Date.now();
  const pos = {
    board: board.map(r => r.slice()),
    turn: turn,
    castling: { ...castling },
    enPassant: enPassant ? { ...enPassant } : null,
    halfmove: halfmoveClock
  };
  const keys = positionLog.slice(0, -1);   // posisi sebelumnya (untuk menghindari pengulangan)
  let ms = BOT_MS[botDifficulty] || 450;
  let pace = 350;                          // lama minimum sebelum bot menjalankan langkah
  if (clockCfg.base > 0) {
    const left = clocks[botColor];
    ms = Math.max(80, Math.min(ms, left / 30));          // jam menipis -> mesin mikir lebih singkat
    if (clockOn) {   // langkah pertama putih belum berjam, jadi tidak perlu dijeda lama
      // waktu yang dihabiskan bot per langkah: sebagian kecil dari sisa waktu + tambahan, dibatasi per level.
      // Variasi 60-100% supaya tidak terasa seperti mesin, dan tidak pernah lebih dari 40% sisa waktu.
      const budget = Math.min(BOT_PACE_MAX[botDifficulty] || 6000, left / 20 + clockCfg.inc * 1000);
      pace = Math.max(400, Math.min(budget * (0.6 + Math.random() * 0.4), left * 0.4));
      ms = Math.min(ms, pace * 0.8);
    }
  }
  bot.think(pos, botDifficulty, keys, ms).then(res => {
    if (job !== botJob) return;           // sudah dibatalkan (reset / undo / mode lain)
    const wait = Math.max(0, pace - (Date.now() - t0));  // sisa jeda: jam bot tetap berjalan selama ini
    setTimeout(() => {
      if (job !== botJob) return;
      botThinking = false;
      setThinking(false);
      applyBotResult(res);
    }, wait);
  });
}

function applyBotResult(res) {
  if (gameMode != 'bot' || turn != botColor || isGameOver()) return;
  let from = null, to = null, data = null;
  if (res && res.move) {
    const f = res.move.from, t = res.move.to;
    const legal = getValidMoves(f.row, f.col).find(m => m.row == t.row && m.col == t.col);
    if (legal && board[f.row][f.col] && isMyTurn(board[f.row][f.col])) {
      from = f; to = t;
      data = res.move.promo ? { ...legal, promotion: res.move.promo } : legal;
    }
  }
  if (!data) {           // cadangan: mesin gagal / langkah tidak cocok aturan -> langkah legal acak
    const m = getRandomMove(botColor);
    if (!m) return;
    from = m.from; to = m.to; data = m.data;
  }
  makeMove(from.row, from.col, to.row, to.col, data);
}

function getRandomMove(color) {
  const all = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && colorOf(p) == color) getValidMoves(r, c).forEach(m => all.push({ from: { row: r, col: c }, to: { row: m.row, col: m.col }, data: m }));
    }
  return all.length ? all[Math.floor(Math.random() * all.length)] : null;
}

/* ===== 9. SIMPAN / LANJUTKAN ===== */
const SAVE_KEY = 'catur_save_v1';

function saveGame() {
  try {
    if (isGameOver() || history.length == 0) { localStorage.removeItem(SAVE_KEY); return; }
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 1, board, turn, castling, enPassant, history, moveLog, capturedWhite, capturedBlack,
      halfmoveClock, positionLog, gameMode, botDifficulty, botColor, clockCfg, clocks, clockOn, savedAt: Date.now()
    }));
  } catch (e) { /* penyimpanan penuh / diblokir: abaikan */ }
}
function clearSavedGame() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

function readSavedGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    const ok = s && s.v == 1 && Array.isArray(s.board) && s.board.length == 8 && s.board.every(r => Array.isArray(r) && r.length == 8) &&
      (s.turn == 'w' || s.turn == 'b') && Array.isArray(s.history) && Array.isArray(s.moveLog) && Array.isArray(s.positionLog) &&
      s.history.length > 0 && s.castling && (s.gameMode == 'pvp' || s.gameMode == 'bot');
    return ok ? s : null;
  } catch (e) { return null; }
}

function showResumeBanner() {
  const s = readSavedGame();
  const el = document.getElementById('resumeBanner');
  if (!el) return;
  if (!s) { el.classList.add('hidden'); return; }
  document.getElementById('resumeInfo').textContent = s.history.length + ' langkah · ' + (s.gameMode == 'bot' ? 'Vs Bot' : '2 Player');
  el.classList.remove('hidden');
}
function hideResumeBanner() { document.getElementById('resumeBanner')?.classList.add('hidden'); }
function discardSaved() { clearSavedGame(); hideResumeBanner(); }

function syncControls() {
  document.getElementById('btn-pvp')?.classList.toggle('active', gameMode == 'pvp');
  document.getElementById('btn-bot')?.classList.toggle('active', gameMode == 'bot');
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = String(v); };
  set('bot-level', botDifficulty); set('bot-color', botColor);
  set('clock-base', clockCfg.base); set('clock-inc', clockCfg.inc);
  set('anim-mode', ANIMATE ? 'on' : 'off');
}

function resumeSaved() {
  const s = readSavedGame();
  if (!s) { hideResumeBanner(); return; }
  cancelBot();
  board = s.board; turn = s.turn; castling = s.castling; enPassant = s.enPassant || null;
  history = s.history; moveLog = s.moveLog; positionLog = s.positionLog;
  capturedWhite = s.capturedWhite || []; capturedBlack = s.capturedBlack || [];
  halfmoveClock = s.halfmoveClock || 0;
  gameMode = s.gameMode; botDifficulty = s.botDifficulty || 'normal'; botColor = s.botColor || 'b';
  clockCfg = s.clockCfg || { base: 0, inc: 0 };
  clocks = s.clocks || { w: clockCfg.base * 60000, b: clockCfg.base * 60000 };
  flagged = false; clockOn = false;
  selected = null; validMoves = []; pendingPromotion = null; animating = false;
  document.getElementById('promotionOverlay').classList.add('hidden');
  clearGameEnd();
  document.getElementById('board').style.pointerEvents = 'auto';
  syncControls();
  if (s.clockOn && clockCfg.base > 0) startClock();   // waktu selama halaman ditutup tidak dihitung
  hideResumeBanner();
  updateStatus(); updateCaptured(); updateMoveList(); renderClocks(); renderBoard();
  if (gameMode == 'bot' && turn == botColor) setTimeout(botMove, 300);
}

/* ===== 10. UNDO, RESET, INISIALISASI ===== */
function initBoard() {
  cancelBot();
  board = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
  ];
  history = [];
  moveLog = [];
  turn = 'w';
  selected = null;
  validMoves = [];
  castling = { wK: true, wQ: true, bK: true, bQ: true };
  enPassant = null;
  capturedWhite = [];
  capturedBlack = [];
  halfmoveClock = 0;
  pendingPromotion = null;
  animating = false;
  positionLog = [positionKey()];
  resetClocks();
  bot.newGame();
  document.getElementById('promotionOverlay').classList.add('hidden');
  clearGameEnd();
  document.getElementById('board').style.pointerEvents = 'auto';
  updateStatus();
  updateCaptured();
  updateMoveList();
  renderBoard();
  if (gameMode == 'bot' && botColor == 'w' && turn == 'w') setTimeout(botMove, 400);
}

function resetGame() { hideResumeBanner(); initBoard(); }

function undoMove() {
  if (animating || pendingPromotion) return;
  cancelBot();
  // vs bot: mundur 2 langkah (langkah bot + langkah kamu) supaya giliran balik ke kamu
  const steps = (gameMode == 'bot' && history.length > 1 && turn != botColor) ? 2 : 1;
  for (let i = 0; i < steps && history.length > 0; i++) {
    const last = history.pop();
    moveLog.pop();
    board = last.board;
    castling = last.castling;
    enPassant = last.enPassant;
    turn = last.turn;
    capturedWhite = last.capturedWhite || [];
    capturedBlack = last.capturedBlack || [];
    halfmoveClock = last.halfmoveClock || 0;
    positionLog.length = last.posLen;
    if (clockCfg.base > 0 && last.clockW !== undefined) { clocks.w = last.clockW; clocks.b = last.clockB; }
  }
  flagged = false;
  if (clockCfg.base > 0) {
    if (history.length == 0) resetClocks();
    else { clockOn = true; clockStamp = Date.now(); }
  }
  selected = null;
  validMoves = [];
  clearGameEnd();
  document.getElementById('board').style.pointerEvents = 'auto';
  updateStatus();
  updateCaptured();
  updateMoveList();
  renderClocks();
  renderBoard();
  saveGame();
  if (gameMode == 'bot' && turn == botColor) setTimeout(botMove, 300);
}

window.onload = () => {
  buildSprite();
  makeGrain();
  buildCoords();
  buildBoard();
  let saved = null, anim = null;
  try { saved = localStorage.getItem('theme'); anim = localStorage.getItem('catur_anim'); } catch (e) {}
  applyTheme(saved === 'dark');
  ANIMATE = anim !== 'off';
  syncControls();
  initBoard();
  showResumeBanner();
};
