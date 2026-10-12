/* ==========================================================================
   MESIN CATUR (ringan & cepat)
   - Papan 64 kotak (Int8Array), generator langkah pseudo-legal + cek legal
   - Pencarian: iterative deepening, negamax alpha-beta (PVS), tabel transposisi,
     null-move, late-move reduction, quiescence search, killer & history heuristic
   - Evaluasi: materi + tabel posisi (PST) + pasangan gajah + raja awal/akhir
   - Dijalankan di Web Worker supaya tampilan tidak membeku, dan dibatasi waktu.

   Fungsi chessEngineFactory() sengaja SELF-CONTAINED (tidak memakai variabel luar)
   supaya bisa dijadikan kode Worker lewat chessEngineFactory.toString().
   ========================================================================== */
function chessEngineFactory() {
  'use strict';

  // ---------- konstanta ----------
  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
  const VAL = [0, 100, 320, 330, 500, 900, 0];
  const INF = 32000, MATE = 30000, MAXPLY = 64;
  const CAP = 1 << 15, EP = 1 << 16, CAS = 1 << 17, DBL = 1 << 18;
  const EXACT = 0, LOWER = 1, UPPER = 2;

  // tabel posisi (sudut pandang putih, baris 0 = rank 8)
  const PST = [null,
    [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5,
     0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
    [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30,
     -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10,
     -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
     -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
    [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5,
     0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    null];
  const KING_MG = [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10,
    20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20];
  const KING_EG = [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30,
    -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30,
    -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50];

  // ---------- tabel geometri ----------
  const knightTo = [], kingTo = [], rays = [];
  const KN = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  const DIRS = [[-1,0],[1,0],[0,1],[0,-1],[-1,1],[-1,-1],[1,1],[1,-1]]; // 0-3 benteng, 4-7 gajah
  for (let sq = 0; sq < 64; sq++) {
    const r = sq >> 3, c = sq & 7;
    knightTo[sq] = KN.map(([dr, dc]) => [r + dr, c + dc]).filter(([a, b]) => a >= 0 && a < 8 && b >= 0 && b < 8).map(([a, b]) => a * 8 + b);
    const kk = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const a = r + dr, b = c + dc;
      if (a >= 0 && a < 8 && b >= 0 && b < 8) kk.push(a * 8 + b);
    }
    kingTo[sq] = kk;
    rays[sq] = DIRS.map(([dr, dc]) => {
      const list = []; let a = r + dr, b = c + dc;
      while (a >= 0 && a < 8 && b >= 0 && b < 8) { list.push(a * 8 + b); a += dr; b += dc; }
      return list;
    });
  }

  // hak rokade: bit 1=wK 2=wQ 4=bK 8=bQ
  const castleMask = new Int8Array(64).fill(15);
  castleMask[60] = 15 & ~3; castleMask[63] = 15 & ~1; castleMask[56] = 15 & ~2;
  castleMask[4] = 15 & ~12; castleMask[7] = 15 & ~4; castleMask[0] = 15 & ~8;

  // ---------- zobrist ----------
  let seed = 0x9E3779B9;
  function rnd() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; }
  const zP1 = new Int32Array(12 * 64), zP2 = new Int32Array(12 * 64);
  for (let i = 0; i < 12 * 64; i++) { zP1[i] = rnd(); zP2[i] = rnd(); }
  const zC1 = new Int32Array(16), zC2 = new Int32Array(16), zE1 = new Int32Array(8), zE2 = new Int32Array(8);
  for (let i = 0; i < 16; i++) { zC1[i] = rnd(); zC2[i] = rnd(); }
  for (let i = 0; i < 8; i++) { zE1[i] = rnd(); zE2[i] = rnd(); }
  const zS1 = rnd(), zS2 = rnd();
  const pidx = p => p > 0 ? p - 1 : 5 - p; // -1 -> 6 ... -6 -> 11

  // ---------- state ----------
  const bd = new Int8Array(64);
  let side = 1, cas = 0, ep = -1, hm = 0, h1 = 0, h2 = 0;
  let psq = 0, npm0 = 0, npm1 = 0, bc0 = 0, bc1 = 0;
  const ksq = [60, 4];
  const STK = 1024;
  const usMove = new Int32Array(STK), usCap = new Int8Array(STK), usCas = new Int8Array(STK), usEp = new Int8Array(STK);
  const usHm = new Int16Array(STK), usH1 = new Int32Array(STK), usH2 = new Int32Array(STK), usPsq = new Int32Array(STK);
  const usN0 = new Int16Array(STK), usN1 = new Int16Array(STK), usB0 = new Int8Array(STK), usB1 = new Int8Array(STK);
  let sp = 0;

  function addPiece(sq, p) {
    bd[sq] = p;
    h1 ^= zP1[pidx(p) * 64 + sq]; h2 ^= zP2[pidx(p) * 64 + sq];
    const t = p > 0 ? p : -p;
    if (t === K) { ksq[p > 0 ? 0 : 1] = sq; return; }
    if (p > 0) { psq += VAL[t] + PST[t][sq]; if (t !== P) npm0 += VAL[t]; if (t === B) bc0++; }
    else { psq -= VAL[t] + PST[t][sq ^ 56]; if (t !== P) npm1 += VAL[t]; if (t === B) bc1++; }
  }
  function removePiece(sq) {
    const p = bd[sq]; bd[sq] = 0;
    h1 ^= zP1[pidx(p) * 64 + sq]; h2 ^= zP2[pidx(p) * 64 + sq];
    const t = p > 0 ? p : -p;
    if (t === K) return;
    if (p > 0) { psq -= VAL[t] + PST[t][sq]; if (t !== P) npm0 -= VAL[t]; if (t === B) bc0--; }
    else { psq += VAL[t] + PST[t][sq ^ 56]; if (t !== P) npm1 -= VAL[t]; if (t === B) bc1--; }
  }

  function setPosition(msg) {
    bd.fill(0); h1 = 0; h2 = 0; psq = 0; npm0 = 0; npm1 = 0; bc0 = 0; bc1 = 0; sp = 0;
    const map = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const ch = msg.board[r][c];
      if (!ch) continue;
      const t = map[ch.toLowerCase()];
      addPiece(r * 8 + c, ch === ch.toUpperCase() ? t : -t);
    }
    side = msg.turn === 'w' ? 1 : -1;
    const cs = msg.castling || {};
    cas = (cs.wK ? 1 : 0) | (cs.wQ ? 2 : 0) | (cs.bK ? 4 : 0) | (cs.bQ ? 8 : 0);
    ep = msg.enPassant ? msg.enPassant.row * 8 + msg.enPassant.col : -1;
    hm = msg.halfmove || 0;
    if (side === -1) { h1 ^= zS1; h2 ^= zS2; }
    h1 ^= zC1[cas]; h2 ^= zC2[cas];
    if (ep >= 0) { h1 ^= zE1[ep & 7]; h2 ^= zE2[ep & 7]; }
  }

  // kunci posisi dari UI (string) -> hash h1, untuk deteksi pengulangan posisi
  function hashOfKey(key) {
    const parts = key.split(' ');
    const rows = parts[0].split('/');
    const saved = [bd.slice(), side, cas, ep, hm, h1, h2, psq, npm0, npm1, bc0, bc1, ksq[0], ksq[1], sp];
    const board = rows.map(r => r.split('').map(x => x === '.' ? '' : x));
    const cs = parts[2] || '';
    const epk = parts[3];
    setPosition({
      board, turn: parts[1], hm: 0,
      castling: { wK: cs.includes('K'), wQ: cs.includes('Q'), bK: cs.includes('k'), bQ: cs.includes('q') },
      enPassant: epk && epk !== '-' ? { row: +epk[0], col: +epk[1] } : null
    });
    const out = h1;
    bd.set(saved[0]); side = saved[1]; cas = saved[2]; ep = saved[3]; hm = saved[4]; h1 = saved[5]; h2 = saved[6];
    psq = saved[7]; npm0 = saved[8]; npm1 = saved[9]; bc0 = saved[10]; bc1 = saved[11]; ksq[0] = saved[12]; ksq[1] = saved[13]; sp = saved[14];
    return out;
  }

  // ---------- serangan ----------
  function attacked(sq, by) { // apakah kotak sq diserang bidak warna `by` (+1 putih, -1 hitam)
    const r = sq >> 3, c = sq & 7;
    // pion
    if (by === 1) {
      if (r < 7) { if (c > 0 && bd[sq + 7] === P) return true; if (c < 7 && bd[sq + 9] === P) return true; }
    } else if (r > 0) { if (c > 0 && bd[sq - 9] === -P) return true; if (c < 7 && bd[sq - 7] === -P) return true; }
    const kn = knightTo[sq]; const nn = by * N;
    for (let i = 0; i < kn.length; i++) if (bd[kn[i]] === nn) return true;
    const kg = kingTo[sq]; const kk = by * K;
    for (let i = 0; i < kg.length; i++) if (bd[kg[i]] === kk) return true;
    const rk = by * R, qq = by * Q, bb = by * B;
    const rs = rays[sq];
    for (let d = 0; d < 8; d++) {
      const ray = rs[d]; const straight = d < 4;
      for (let i = 0; i < ray.length; i++) {
        const p = bd[ray[i]];
        if (p === 0) continue;
        if (p === qq || p === (straight ? rk : bb)) return true;
        break;
      }
    }
    return false;
  }

  // ---------- generator langkah ----------
  const mvBuf = [], scBuf = [];
  for (let i = 0; i < MAXPLY + 4; i++) { mvBuf.push(new Int32Array(256)); scBuf.push(new Int32Array(256)); }

  function gen(ply, capsOnly) {
    const mv = mvBuf[ply]; let n = 0; const s = side;
    for (let i = 0; i < 64; i++) {
      const p = bd[i];
      if (p === 0 || (p > 0) !== (s > 0)) continue;
      const t = p > 0 ? p : -p;
      if (t === P) {
        const r = i >> 3, c = i & 7;
        const fwd = s === 1 ? i - 8 : i + 8;
        const lastNext = s === 1 ? r === 1 : r === 6;
        const startRow = s === 1 ? 6 : 1;
        if (bd[fwd] === 0) {
          if (lastNext) { mv[n++] = i | (fwd << 6) | (Q << 12); if (!capsOnly) { mv[n++] = i | (fwd << 6) | (R << 12); mv[n++] = i | (fwd << 6) | (B << 12); mv[n++] = i | (fwd << 6) | (N << 12); } }
          else if (!capsOnly) {
            mv[n++] = i | (fwd << 6);
            if (r === startRow) { const f2 = s === 1 ? i - 16 : i + 16; if (bd[f2] === 0) mv[n++] = i | (f2 << 6) | DBL; }
          }
        }
        for (let dc = -1; dc <= 1; dc += 2) {
          const cc = c + dc; if (cc < 0 || cc > 7) continue;
          const to = fwd + dc, tp = bd[to];
          if (tp !== 0 && (tp > 0) !== (s > 0)) {
            if (lastNext) { mv[n++] = i | (to << 6) | (Q << 12) | CAP; mv[n++] = i | (to << 6) | (R << 12) | CAP; mv[n++] = i | (to << 6) | (B << 12) | CAP; mv[n++] = i | (to << 6) | (N << 12) | CAP; }
            else mv[n++] = i | (to << 6) | CAP;
          } else if (to === ep && tp === 0) mv[n++] = i | (to << 6) | CAP | EP;
        }
      } else if (t === N) {
        const l = knightTo[i];
        for (let k = 0; k < l.length; k++) { const to = l[k], tp = bd[to];
          if (tp === 0) { if (!capsOnly) mv[n++] = i | (to << 6); } else if ((tp > 0) !== (s > 0)) mv[n++] = i | (to << 6) | CAP; }
      } else if (t === K) {
        const l = kingTo[i];
        for (let k = 0; k < l.length; k++) { const to = l[k], tp = bd[to];
          if (tp === 0) { if (!capsOnly) mv[n++] = i | (to << 6); } else if ((tp > 0) !== (s > 0)) mv[n++] = i | (to << 6) | CAP; }
        if (!capsOnly) {
          if (s === 1 && i === 60) {
            if ((cas & 1) && bd[61] === 0 && bd[62] === 0 && bd[63] === R && !attacked(60, -1) && !attacked(61, -1) && !attacked(62, -1)) mv[n++] = 60 | (62 << 6) | CAS;
            if ((cas & 2) && bd[59] === 0 && bd[58] === 0 && bd[57] === 0 && bd[56] === R && !attacked(60, -1) && !attacked(59, -1) && !attacked(58, -1)) mv[n++] = 60 | (58 << 6) | CAS;
          } else if (s === -1 && i === 4) {
            if ((cas & 4) && bd[5] === 0 && bd[6] === 0 && bd[7] === -R && !attacked(4, 1) && !attacked(5, 1) && !attacked(6, 1)) mv[n++] = 4 | (6 << 6) | CAS;
            if ((cas & 8) && bd[3] === 0 && bd[2] === 0 && bd[1] === 0 && bd[0] === -R && !attacked(4, 1) && !attacked(3, 1) && !attacked(2, 1)) mv[n++] = 4 | (2 << 6) | CAS;
          }
        }
      } else {
        const d0 = t === B ? 4 : 0, d1 = t === R ? 4 : 8;
        const rs = rays[i];
        for (let d = d0; d < d1; d++) {
          const ray = rs[d];
          for (let k = 0; k < ray.length; k++) {
            const to = ray[k], tp = bd[to];
            if (tp === 0) { if (!capsOnly) mv[n++] = i | (to << 6); continue; }
            if ((tp > 0) !== (s > 0)) mv[n++] = i | (to << 6) | CAP;
            break;
          }
        }
      }
    }
    return n;
  }

  // ---------- make / unmake ----------
  function make(m) {
    const from = m & 63, to = (m >> 6) & 63, promo = (m >> 12) & 7;
    const p = bd[from];
    const capSq = (m & EP) ? (side === 1 ? to + 8 : to - 8) : to;
    const cap = bd[capSq];
    usMove[sp] = m; usCap[sp] = cap; usCas[sp] = cas; usEp[sp] = ep; usHm[sp] = hm; usH1[sp] = h1; usH2[sp] = h2;
    usPsq[sp] = psq; usN0[sp] = npm0; usN1[sp] = npm1; usB0[sp] = bc0; usB1[sp] = bc1; sp++;
    if (ep >= 0) { h1 ^= zE1[ep & 7]; h2 ^= zE2[ep & 7]; }
    h1 ^= zC1[cas]; h2 ^= zC2[cas];
    removePiece(from);
    if (cap !== 0) removePiece(capSq);
    addPiece(to, promo ? side * promo : p);
    if (m & CAS) {
      if (to === 62) { removePiece(63); addPiece(61, R); }
      else if (to === 58) { removePiece(56); addPiece(59, R); }
      else if (to === 6) { removePiece(7); addPiece(5, -R); }
      else { removePiece(0); addPiece(3, -R); }
    }
    cas &= castleMask[from] & castleMask[to];
    ep = (m & DBL) ? (from + to) >> 1 : -1;
    hm = (p === P || p === -P || cap !== 0) ? 0 : hm + 1;
    h1 ^= zC1[cas]; h2 ^= zC2[cas];
    if (ep >= 0) { h1 ^= zE1[ep & 7]; h2 ^= zE2[ep & 7]; }
    side = -side; h1 ^= zS1; h2 ^= zS2;
  }
  function unmake() {
    sp--;
    const m = usMove[sp], from = m & 63, to = (m >> 6) & 63, promo = (m >> 12) & 7;
    side = -side;
    const p = promo ? side * P : bd[to];
    bd[from] = p; bd[to] = 0;
    const cap = usCap[sp];
    if (m & EP) bd[side === 1 ? to + 8 : to - 8] = cap; else if (cap !== 0) bd[to] = cap;
    if (m & CAS) {
      if (to === 62) { bd[63] = R; bd[61] = 0; }
      else if (to === 58) { bd[56] = R; bd[59] = 0; }
      else if (to === 6) { bd[7] = -R; bd[5] = 0; }
      else { bd[0] = -R; bd[3] = 0; }
    }
    if (p === K) ksq[0] = from; else if (p === -K) ksq[1] = from;
    cas = usCas[sp]; ep = usEp[sp]; hm = usHm[sp]; h1 = usH1[sp]; h2 = usH2[sp];
    psq = usPsq[sp]; npm0 = usN0[sp]; npm1 = usN1[sp]; bc0 = usB0[sp]; bc1 = usB1[sp];
  }
  function makeNull() {
    usMove[sp] = 0; usCas[sp] = cas; usEp[sp] = ep; usHm[sp] = hm; usH1[sp] = h1; usH2[sp] = h2; sp++;
    if (ep >= 0) { h1 ^= zE1[ep & 7]; h2 ^= zE2[ep & 7]; }
    ep = -1; hm++; side = -side; h1 ^= zS1; h2 ^= zS2;
  }
  function unmakeNull() {
    sp--; side = -side; cas = usCas[sp]; ep = usEp[sp]; hm = usHm[sp]; h1 = usH1[sp]; h2 = usH2[sp];
  }
  const inCheck = () => attacked(ksq[side === 1 ? 0 : 1], -side);
  // setelah make(): apakah raja pihak yang baru jalan berada dalam serangan (langkah ilegal)?
  const leftInCheck = () => attacked(ksq[side === 1 ? 1 : 0], side);

  // ---------- evaluasi ----------
  function evaluate() {
    let s = psq;
    const ph = Math.min(npm0 + npm1, 5000) / 5000;
    const wk = ksq[0], bk = ksq[1] ^ 56;
    s += (KING_MG[wk] * ph + KING_EG[wk] * (1 - ph)) - (KING_MG[bk] * ph + KING_EG[bk] * (1 - ph));
    if (bc0 >= 2) s += 30;
    if (bc1 >= 2) s -= 30;
    return side === 1 ? s | 0 : -s | 0;
  }

  // ---------- tabel transposisi ----------
  const TT_BITS = 18, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
  const tK1 = new Int32Array(TT_SIZE), tK2 = new Int32Array(TT_SIZE), tS = new Int16Array(TT_SIZE);
  const tD = new Int8Array(TT_SIZE), tF = new Int8Array(TT_SIZE), tM = new Int32Array(TT_SIZE);
  const toTT = (s, ply) => s > MATE - 200 ? s + ply : s < -MATE + 200 ? s - ply : s;
  const fromTT = (s, ply) => s > MATE - 200 ? s - ply : s < -MATE + 200 ? s + ply : s;

  // ---------- pencarian ----------
  let nodes = 0, stop = false, deadline = 0;
  const killers = new Int32Array((MAXPLY + 4) * 2);
  const hist = new Int32Array(2 * 4096);
  let gameSet = new Set();

  function orderScores(ply, n, ttMove) {
    const mv = mvBuf[ply], sc = scBuf[ply], ki = ply * 2, hOff = side === 1 ? 0 : 4096;
    for (let i = 0; i < n; i++) {
      const m = mv[i];
      let s;
      if (m === ttMove) s = 2000000;
      else if (m & CAP) {
        const victim = (m & EP) ? P : Math.abs(bd[(m >> 6) & 63]);
        const att = Math.abs(bd[m & 63]);
        s = 1000000 + victim * 16 - att + (((m >> 12) & 7) === Q ? 800 : 0);
      } else if ((m >> 12) & 7) s = ((m >> 12) & 7) === Q ? 990000 : 100;
      else if (m === killers[ki]) s = 900000;
      else if (m === killers[ki + 1]) s = 890000;
      else s = hist[hOff + (m & 4095)];
      sc[i] = s;
    }
  }
  function pick(ply, i, n) {
    const mv = mvBuf[ply], sc = scBuf[ply];
    let b = i;
    for (let j = i + 1; j < n; j++) if (sc[j] > sc[b]) b = j;
    if (b !== i) { const tm = mv[i]; mv[i] = mv[b]; mv[b] = tm; const ts = sc[i]; sc[i] = sc[b]; sc[b] = ts; }
    return mv[i];
  }

  function qsearch(alpha, beta, ply) {
    nodes++;
    if ((nodes & 2047) === 0 && Date.now() > deadline) stop = true;
    if (stop) return 0;
    const stand = evaluate();
    if (ply >= MAXPLY || stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    const n = gen(ply, true);
    orderScores(ply, n, 0);
    for (let i = 0; i < n; i++) {
      const m = pick(ply, i, n);
      const victim = (m & EP) ? P : Math.abs(bd[(m >> 6) & 63]);
      if (!((m >> 12) & 7) && stand + VAL[victim] + 200 < alpha) continue; // delta pruning
      make(m);
      if (leftInCheck()) { unmake(); continue; }
      const score = -qsearch(-beta, -alpha, ply + 1);
      unmake();
      if (stop) return 0;
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  function search(depth, alpha, beta, ply, nullOk) {
    nodes++;
    if ((nodes & 2047) === 0 && Date.now() > deadline) stop = true;
    if (stop) return 0;
    if (ply > 0) {
      if (hm >= 100) return 0;
      for (let k = sp - 2, lim = sp - hm; k >= lim && k >= 0; k -= 2) if (usH1[k] === h1 && usH2[k] === h2) return 0;
      if (gameSet.has(h1)) return 0;
    }
    const chk = inCheck();
    if (chk && ply < MAXPLY - 2) depth++;
    if (depth <= 0) return qsearch(alpha, beta, ply);
    if (ply >= MAXPLY - 1) return evaluate();

    const idx = h1 & TT_MASK; let ttMove = 0;
    if (tK1[idx] === h1 && tK2[idx] === h2) {
      ttMove = tM[idx];
      if (ply > 0 && tD[idx] >= depth) {
        const sc = fromTT(tS[idx], ply), f = tF[idx];
        if (f === EXACT) return sc;
        if (f === LOWER && sc >= beta) return sc;
        if (f === UPPER && sc <= alpha) return sc;
      }
    }
    // null move
    if (nullOk && !chk && depth >= 3 && ply > 0 && (side === 1 ? npm0 : npm1) > 0 && beta < MATE - 200) {
      makeNull();
      const sc = -search(depth - 3, -beta, -beta + 1, ply + 1, false);
      unmakeNull();
      if (stop) return 0;
      if (sc >= beta) return beta;
    }

    const n = gen(ply, false);
    orderScores(ply, n, ttMove);
    let best = -INF, bestMove = 0, legal = 0; const origAlpha = alpha;
    const hOff = side === 1 ? 0 : 4096, ki = ply * 2;
    for (let i = 0; i < n; i++) {
      const m = pick(ply, i, n);
      make(m);
      if (leftInCheck()) { unmake(); continue; }
      legal++;
      let score;
      if (legal === 1) score = -search(depth - 1, -beta, -alpha, ply + 1, true);
      else {
        let red = 0;
        if (depth >= 3 && legal > 4 && !chk && !(m & CAP) && !((m >> 12) & 7)) red = legal > 10 && depth >= 5 ? 2 : 1;
        score = -search(depth - 1 - red, -alpha - 1, -alpha, ply + 1, true);
        if (score > alpha && red > 0) score = -search(depth - 1, -alpha - 1, -alpha, ply + 1, true);
        if (score > alpha && score < beta) score = -search(depth - 1, -beta, -alpha, ply + 1, true);
      }
      unmake();
      if (stop) return 0;
      if (score > best) {
        best = score; bestMove = m;
        if (score > alpha) {
          alpha = score;
          if (alpha >= beta) {
            if (!(m & CAP)) {
              if (killers[ki] !== m) { killers[ki + 1] = killers[ki]; killers[ki] = m; }
              hist[hOff + (m & 4095)] += depth * depth;
              if (hist[hOff + (m & 4095)] > 400000) for (let j = 0; j < hist.length; j++) hist[j] >>= 1;
            }
            break;
          }
        }
      }
    }
    if (legal === 0) return chk ? -MATE + ply : 0;
    tK1[idx] = h1; tK2[idx] = h2; tS[idx] = toTT(best, ply); tD[idx] = depth; tM[idx] = bestMove;
    tF[idx] = best <= origAlpha ? UPPER : best >= beta ? LOWER : EXACT;
    return best;
  }

  // ---------- akar pencarian ----------
  function legalRoot() {
    const n = gen(0, false), out = [];
    const tmp = Array.from(mvBuf[0].subarray(0, n));
    for (const m of tmp) { make(m); if (!leftInCheck()) out.push(m); unmake(); }
    return out;
  }

  function toUI(m) {
    const from = m & 63, to = (m >> 6) & 63, promo = (m >> 12) & 7;
    return { from: { row: from >> 3, col: from & 7 }, to: { row: to >> 3, col: to & 7 }, promo: promo ? ' pnbrqk'[promo] : null };
  }

  // skor penuh (jendela penuh) tiap langkah akar pada kedalaman tertentu
  function scoreAll(moves, depth) {
    const res = [];
    for (const m of moves) {
      make(m);
      const sc = -search(depth - 1, -INF, INF, 1, true);
      unmake();
      if (stop) return null;
      res.push({ m, sc });
    }
    return res;
  }

  function think(level, keys, ms, maxDepth) {
    const moves = legalRoot();
    if (moves.length === 0) return null;
    gameSet = new Set();
    for (const k of keys || []) { try { gameSet.add(hashOfKey(k)); } catch (e) { /* abaikan kunci rusak */ } }
    const start = Date.now(); deadline = start + ms; stop = false; nodes = 0;
    killers.fill(0);
    for (let j = 0; j < hist.length; j++) hist[j] >>= 2;
    const info = { depth: 0, nodes: 0, ms: 0, score: 0 };
    let chosen = moves[0];

    if (moves.length === 1) { info.depth = 1; return { m: moves[0], info }; }

    if (level === 'easy' || level === 'normal') {
      const d = level === 'easy' ? 2 : 3, noise = level === 'easy' ? 160 : 14;
      if (level === 'easy' && Math.random() < 0.15) { chosen = moves[Math.floor(Math.random() * moves.length)]; info.depth = 0; return { m: chosen, info }; }
      const res = scoreAll(moves, d);
      if (res) {
        let bs = -INF;
        for (const r of res) {
          // skakmat selalu diambil; selebihnya diberi sedikit variasi
          const v = r.sc > MATE - 200 ? INF : r.sc + (Math.random() * 2 - 1) * noise;
          if (v > bs) { bs = v; chosen = r.m; info.score = r.sc; }
        }
        info.depth = d;
      }
      info.nodes = nodes; info.ms = Date.now() - start;
      return { m: chosen, info };
    }

    // hard / insane: iterative deepening + PVS di akar
    let order = moves.slice();
    let bestScore = 0;
    for (let depth = 1; depth <= maxDepth; depth++) {
      let alpha = -INF; const beta = INF;
      let iterBest = order[0], iterScore = -INF; const scores = [];
      for (let i = 0; i < order.length; i++) {
        const m = order[i];
        make(m);
        let sc;
        if (i === 0) sc = -search(depth - 1, -beta, -alpha, 1, true);
        else {
          sc = -search(depth - 1, -alpha - 1, -alpha, 1, true);
          if (sc > alpha && !stop) sc = -search(depth - 1, -beta, -alpha, 1, true);
        }
        unmake();
        if (stop) break;
        scores.push({ m, sc });
        if (sc > iterScore) { iterScore = sc; iterBest = m; if (sc > alpha) alpha = sc; }
      }
      if (stop) break;
      chosen = iterBest; bestScore = iterScore; info.depth = depth; info.score = iterScore;
      order = [iterBest].concat(scores.filter(x => x.m !== iterBest).sort((a, b) => b.sc - a.sc).map(x => x.m));
      if (Math.abs(iterScore) > MATE - 200) break;
      if (Date.now() - start > ms * 0.55) break; // tidak mulai iterasi baru yang pasti tidak selesai
    }
    // variasi pembukaan untuk level hard supaya tidak selalu sama
    if (level === 'hard' && (keys || []).length < 12) {
      stop = false; deadline = Date.now() + 400;
      const res = scoreAll(moves, 3);
      if (res) {
        const top = Math.max(...res.map(r => r.sc));
        const cands = res.filter(r => r.sc >= top - 12);
        if (cands.length && Math.abs(top) < 300) chosen = cands[Math.floor(Math.random() * cands.length)].m;
      }
    }
    info.nodes = nodes; info.ms = Date.now() - start;
    return { m: chosen, info };
  }

  const LEVELS = {
    easy: { ms: 200, depth: 2 },
    normal: { ms: 450, depth: 3 },
    hard: { ms: 1000, depth: 6 },
    insane: { ms: 2000, depth: 10 }
  };

  function perft(depth) {
    if (depth === 0) return 1;
    const n = gen(Math.min(depth, MAXPLY), false);
    const list = Array.from(mvBuf[Math.min(depth, MAXPLY)].subarray(0, n));
    let total = 0;
    for (const m of list) {
      make(m);
      if (!leftInCheck()) total += perft(depth - 1);
      unmake();
    }
    return total;
  }

  // ---------- antarmuka pesan ----------
  function handle(msg) {
    if (msg.type === 'newgame') { tK1.fill(0); tK2.fill(0); killers.fill(0); hist.fill(0); return { type: 'ok' }; }
    setPosition(msg);
    if (msg.type === 'legal') return { type: 'legal', moves: legalRoot().map(toUI) };
    if (msg.type === 'perft') return { type: 'perft', nodes: perft(msg.depth) };
    if (msg.type === 'go') {
      const lv = LEVELS[msg.level] || LEVELS.normal;
      const ms = msg.ms || lv.ms;
      const r = think(msg.level, msg.keys, ms, lv.depth);
      if (!r) return { type: 'best', id: msg.id, move: null, info: { depth: 0, nodes: 0, ms: 0, score: 0 } };
      const mv = toUI(r.m);
      return { type: 'best', id: msg.id, move: mv, info: r.info };
    }
    return { type: 'error', message: 'perintah tidak dikenal' };
  }

  return { handle };
}

// ==========================================================================
// Pembungkus untuk halaman: membuat Web Worker dari kode di atas (tanpa file terpisah,
// jadi tetap jalan saat dibuka dari localhost maupun file://). Kalau Worker tidak
// tersedia, mesin dijalankan langsung di halaman (tetap dibatasi waktu).
// ==========================================================================
function createChessBot() {
  let worker = null, inline = null, seq = 0, pending = null;

  function start() {
    if (worker || inline) return;
    try {
      const code = 'const __e = ' + chessEngineFactory.toString() + '();' +
        'onmessage = function (ev) { postMessage(__e.handle(ev.data)); };';
      worker = new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
      worker.onmessage = ev => {
        if (pending && ev.data.id === pending.id) { const p = pending; pending = null; p.resolve(ev.data); }
      };
      worker.onerror = () => {
        // gagal di worker -> pindah ke mode langsung
        try { worker.terminate(); } catch (e) { /* ignore */ }
        worker = null; inline = chessEngineFactory();
        if (pending) { const p = pending; pending = null; p.resolve({ failed: true }); }
      };
    } catch (e) {
      worker = null; inline = chessEngineFactory();
    }
  }

  return {
    // minta langkah terbaik; resolve({move, info}) atau null kalau dibatalkan
    think(position, level, keys, ms) {
      start();
      const id = ++seq;
      const msg = Object.assign({ type: 'go', id, level, keys, ms }, position);
      if (inline) return new Promise(res => setTimeout(() => res(inline.handle(msg)), 30));
      return new Promise(resolve => { pending = { id, resolve }; worker.postMessage(msg); });
    },
    // batalkan pencarian yang sedang berjalan (worker dimatikan, dibuat ulang saat dibutuhkan)
    cancel() {
      if (pending) pending = null;
      if (worker) { worker.terminate(); worker = null; }
      seq++;
    },
    newGame() { if (worker) worker.postMessage({ type: 'newgame' }); else if (inline) inline.handle({ type: 'newgame' }); },
    isWorker() { return !!worker; }
  };
}

if (typeof module !== 'undefined') module.exports = { chessEngineFactory };
