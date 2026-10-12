// ==========================================================================
// 🔳 QR CODE — pembuat QR offline (tanpa pustaka luar, tanpa internet)
// Bagian: 1 Encoder (standar ISO/IEC 18004)  2 Penggambar PNG/SVG  3 Isi (WiFi, WhatsApp, dll)  4 Antarmuka
// ==========================================================================

// ===== 1. ENCODER =====
// Mendukung versi 1–40, koreksi error L/M/Q/H, mode angka / alfanumerik / byte (UTF-8).
const QRCode = (function () {
    'use strict';

    // jumlah kata kode koreksi per blok, dan jumlah blok — indeks [level][versi]; level: L, M, Q, H
    const ECC_PER_BLOCK = [
        [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
        [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
        [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
        [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
    ];
    const NUM_BLOCKS = [
        [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
        [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
        [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
        [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
    ];
    const LEVEL = { L: 0, M: 1, Q: 2, H: 3 };
    const FORMAT_BITS = [1, 0, 3, 2];                      // bit format untuk L, M, Q, H
    const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

    const bit = (x, i) => ((x >>> i) & 1) !== 0;

    // ---- kapasitas ----
    function rawDataModules(ver) {
        let r = (16 * ver + 128) * ver + 64;
        if (ver >= 2) {
            const na = Math.floor(ver / 7) + 2;
            r -= (25 * na - 10) * na - 55;
            if (ver >= 7) r -= 36;
        }
        return r;
    }
    function dataCodewords(ver, ecl) {
        return Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ecl][ver] * NUM_BLOCKS[ecl][ver];
    }

    // ---- segmen data ----
    function utf8(text) {
        if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(text));
        const s = unescape(encodeURIComponent(text)), out = [];
        for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
        return out;
    }
    function pushBits(buf, val, len) { for (let i = len - 1; i >= 0; i--) buf.push((val >>> i) & 1); }

    function makeSegment(text) {
        const bits = [];
        if (/^[0-9]+$/.test(text)) {
            for (let i = 0; i < text.length;) {
                const n = Math.min(3, text.length - i);
                pushBits(bits, parseInt(text.substr(i, n), 10), n * 3 + 1);
                i += n;
            }
            return { mode: 1, name: 'Angka', count: text.length, bits };
        }
        if (/^[0-9A-Z $%*+\-./:]+$/.test(text)) {
            let i = 0;
            for (; i + 2 <= text.length; i += 2) pushBits(bits, ALNUM.indexOf(text[i]) * 45 + ALNUM.indexOf(text[i + 1]), 11);
            if (i < text.length) pushBits(bits, ALNUM.indexOf(text[i]), 6);
            return { mode: 2, name: 'Alfanumerik', count: text.length, bits };
        }
        const bytes = utf8(text);
        bytes.forEach(b => pushBits(bits, b, 8));
        return { mode: 4, name: 'Byte (UTF-8)', count: bytes.length, bits };
    }
    function countBits(mode, ver) {
        const k = ver <= 9 ? 0 : ver <= 26 ? 1 : 2;
        return ({ 1: [10, 12, 14], 2: [9, 11, 13], 4: [8, 16, 16] })[mode][k];
    }

    // ---- Reed–Solomon di GF(256) ----
    function gfMul(x, y) {
        let z = 0;
        for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
        return z;
    }
    function rsDivisor(degree) {
        const r = new Array(degree - 1).fill(0).concat([1]);
        let root = 1;
        for (let i = 0; i < degree; i++) {
            for (let j = 0; j < r.length; j++) { r[j] = gfMul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
            root = gfMul(root, 2);
        }
        return r;
    }
    function rsRemainder(data, div) {
        const r = div.map(() => 0);
        for (const b of data) {
            const f = b ^ r.shift();
            r.push(0);
            div.forEach((c, i) => { r[i] ^= gfMul(c, f); });
        }
        return r;
    }

    // ---- susun kata kode data + koreksi, lalu selang-seling antar blok ----
    function addEccAndInterleave(data, ver, ecl) {
        const nb = NUM_BLOCKS[ecl][ver], eccLen = ECC_PER_BLOCK[ecl][ver];
        const raw = Math.floor(rawDataModules(ver) / 8);
        const nShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
        const div = rsDivisor(eccLen), blocks = [];
        for (let i = 0, k = 0; i < nb; i++) {
            const dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1));
            k += dat.length;
            const ecc = rsRemainder(dat, div);
            if (i < nShort) dat.push(0);
            blocks.push(dat.concat(ecc));
        }
        const out = [];
        for (let i = 0; i < blocks[0].length; i++)
            blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= nShort) out.push(b[i]); });
        return out;
    }

    // ---- penggambar matriks ----
    function alignPositions(ver, size) {
        if (ver === 1) return [];
        const n = Math.floor(ver / 7) + 2;
        const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
        const r = [6];
        for (let pos = size - 7; r.length < n; pos -= step) r.splice(1, 0, pos);
        return r;
    }

    function penalty(m, size) {
        let p = 0, dark = 0;
        for (let pass = 0; pass < 2; pass++) {                  // baris, lalu kolom
            for (let a = 0; a < size; a++) {
                let run = 1, prev = pass ? m[0][a] : m[a][0];
                const line = [prev];
                for (let b = 1; b < size; b++) {
                    const c = pass ? m[b][a] : m[a][b];
                    line.push(c);
                    if (c === prev) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else { run = 1; prev = c; }
                }
                // pola mirip penanda (1:1:3:1:1 dengan 4 kotak terang di salah satu sisi)
                for (let b = 0; b + 11 <= size; b++) {
                    const s = line.slice(b, b + 11).map(v => v ? 1 : 0).join('');
                    if (s === '10111010000' || s === '00001011101') p += 40;
                }
            }
        }
        for (let y = 0; y < size - 1; y++)
            for (let x = 0; x < size - 1; x++) {
                const c = m[y][x];
                if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
            }
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (m[y][x]) dark++;
        const total = size * size;
        p += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
        return p;
    }

    function build(data, ver, ecl, forcedMask) {
        const size = ver * 4 + 17;
        const m = Array.from({ length: size }, () => new Array(size).fill(false));
        const fn = Array.from({ length: size }, () => new Array(size).fill(false));
        const set = (x, y, dark) => { m[y][x] = dark; fn[y][x] = true; };

        for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }      // pola penghitung waktu
        const finder = (cx, cy) => {
            for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
                const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
                if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
            }
        };
        finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
        const ap = alignPositions(ver, size), last = ap.length - 1;
        ap.forEach((cy, i) => ap.forEach((cx, j) => {
            if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
            for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }));
        const formatBits = mask => {
            const d = (FORMAT_BITS[ecl] << 3) | mask;
            let rem = d;
            for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
            const bits = ((d << 10) | rem) ^ 0x5412;
            for (let i = 0; i <= 5; i++) set(8, i, bit(bits, i));
            set(8, 7, bit(bits, 6)); set(8, 8, bit(bits, 7)); set(7, 8, bit(bits, 8));
            for (let i = 9; i < 15; i++) set(14 - i, 8, bit(bits, i));
            for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(bits, i));
            for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(bits, i));
            set(8, size - 8, true);                                                             // modul gelap tetap
        };
        formatBits(0);                                                                          // tempat format (ditimpa nanti)
        if (ver >= 7) {
            let rem = ver;
            for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
            const bits = (ver << 12) | rem;
            for (let i = 0; i < 18; i++) {
                const a = size - 11 + i % 3, b = Math.floor(i / 3), c = bit(bits, i);
                set(a, b, c); set(b, a, c);
            }
        }
        // letakkan kata kode secara zig-zag dari kanan-bawah
        let k = 0;
        for (let right = size - 1; right >= 1; right -= 2) {
            if (right === 6) right = 5;
            for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
                const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - v : v;
                if (!fn[y][x] && k < data.length * 8) { m[y][x] = bit(data[k >>> 3], 7 - (k & 7)); k++; }
            }
        }
        const applyMask = mask => {
            for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
                if (fn[y][x]) continue;
                let inv;
                switch (mask) {
                    case 0: inv = (x + y) % 2 === 0; break;
                    case 1: inv = y % 2 === 0; break;
                    case 2: inv = x % 3 === 0; break;
                    case 3: inv = (x + y) % 3 === 0; break;
                    case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
                    case 5: inv = x * y % 2 + x * y % 3 === 0; break;
                    case 6: inv = (x * y % 2 + x * y % 3) % 2 === 0; break;
                    default: inv = ((x + y) % 2 + x * y % 3) % 2 === 0;
                }
                if (inv) m[y][x] = !m[y][x];
            }
        };
        let best = forcedMask, bestScore = Infinity;
        if (forcedMask === undefined || forcedMask < 0) {
            for (let mask = 0; mask < 8; mask++) {
                applyMask(mask); formatBits(mask);
                const sc = penalty(m, size);
                if (sc < bestScore) { bestScore = sc; best = mask; }
                applyMask(mask);                                                                // batalkan
            }
        }
        applyMask(best); formatBits(best);
        return { size, modules: m, mask: best };
    }

    // ---- antarmuka publik ----
    // encode(teks, 'L'|'M'|'Q'|'H', { boost: true, mask: -1 }) -> { version, size, modules, level, mask, mode, bytes }
    function encode(text, level, opts) {
        opts = opts || {};
        let ecl = LEVEL[level === undefined ? 'M' : level];
        if (ecl === undefined) throw new Error('Level koreksi harus L, M, Q, atau H');
        if (text === '') throw new Error('Teks kosong');
        const seg = makeSegment(text);
        let ver = 0, used = 0;
        for (let v = 1; v <= 40; v++) {
            used = 4 + countBits(seg.mode, v) + seg.bits.length;
            if (seg.count >= (1 << countBits(seg.mode, v))) continue;                            // jumlah karakter melebihi batas field
            if (used <= dataCodewords(v, ecl) * 8) { ver = v; break; }
        }
        if (!ver) {
            const e = new Error('Teks terlalu panjang untuk satu QR Code');
            e.tooLong = true; throw e;
        }
        if (opts.boost !== false) {                                                              // naikkan level koreksi bila masih muat di versi yang sama
            [1, 2, 3].forEach(l => { if (l > ecl && used <= dataCodewords(ver, l) * 8) ecl = l; });
        }
        const bits = [];
        pushBits(bits, seg.mode, 4);
        pushBits(bits, seg.count, countBits(seg.mode, ver));
        seg.bits.forEach(b => bits.push(b));
        const cap = dataCodewords(ver, ecl) * 8;
        for (let i = 0; i < 4 && bits.length < cap; i++) bits.push(0);                           // terminator
        while (bits.length % 8) bits.push(0);
        const data = [];
        for (let i = 0; i < bits.length; i += 8) {
            let b = 0;
            for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
            data.push(b);
        }
        for (let pad = 0xEC; data.length < cap / 8; pad ^= 0xEC ^ 0x11) data.push(pad);
        const r = build(addEccAndInterleave(data, ver, ecl), ver, ecl, opts.mask);
        return { version: ver, size: r.size, modules: r.modules, level: 'LMQH'[ecl], mask: r.mask, mode: seg.name, bytes: seg.count, dataCodewords: dataCodewords(ver, ecl) };
    }

    return { encode, dataCodewords, rawDataModules };
})();

// ===== 2. PENGGAMBAR =====
// skala = piksel per modul (bulat, supaya tajam); margin = kotak kosong di sekeliling (standar 4)
function qrGambarCanvas(canvas, qr, targetPx, margin, fg, bg) {
    const total = qr.size + margin * 2;
    const skala = Math.max(1, Math.floor(targetPx / total));
    canvas.width = canvas.height = total * skala;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = fg;
    for (let y = 0; y < qr.size; y++) {
        for (let x = 0; x < qr.size; x++) {
            if (!qr.modules[y][x]) continue;
            let run = 1;                                                     // gabungkan kotak gelap berurutan jadi satu persegi panjang
            while (x + run < qr.size && qr.modules[y][x + run]) run++;
            ctx.fillRect((x + margin) * skala, (y + margin) * skala, run * skala, skala);
            x += run - 1;
        }
    }
    return { skala, piksel: canvas.width };
}

function qrSvg(qr, margin, fg, bg) {
    const total = qr.size + margin * 2;
    let d = '';
    for (let y = 0; y < qr.size; y++)
        for (let x = 0; x < qr.size; x++) {
            if (!qr.modules[y][x]) continue;
            let run = 1;
            while (x + run < qr.size && qr.modules[y][x + run]) run++;
            d += `M${x + margin},${y + margin}h${run}v1h-${run}z`;
            x += run - 1;
        }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total * 10}" height="${total * 10}" shape-rendering="crispEdges">` +
        `<rect width="${total}" height="${total}" fill="${bg}"/><path d="${d}" fill="${fg}"/></svg>`;
}

// ===== 3. ISI QR (format baku yang dikenali aplikasi kamera) =====
const qrEscWifi = s => String(s).replace(/([\\;,:"])/g, '\\$1');

// nomor Indonesia → format internasional tanpa tanda + (0812… → 62812…)
function qrNomorWa(raw) {
    let n = String(raw).replace(/[^\d]/g, '');
    if (String(raw).trim().startsWith('+')) return n;
    if (n.startsWith('00')) n = n.slice(2);
    else if (n.startsWith('0')) n = '62' + n.slice(1);
    else if (n.startsWith('8')) n = '62' + n;
    return n;
}

// mengembalikan { teks } atau { galat }
function qrIsi(jenis, f) {
    switch (jenis) {
        case 'teks':
            return f.teks.trim() === '' ? { petunjuk: 'Ketik teks atau tautan untuk membuat QR.' } : { teks: f.teks };
        case 'wifi': {
            if (!f.ssid.trim()) return { petunjuk: 'Isi nama WiFi (SSID).' };
            const t = f.enkripsi;
            if (t !== 'nopass' && !f.sandi) return { petunjuk: 'Isi kata sandi WiFi, atau pilih "Tanpa sandi".' };
            return { teks: `WIFI:T:${t};S:${qrEscWifi(f.ssid)};` + (t === 'nopass' ? '' : `P:${qrEscWifi(f.sandi)};`) + `H:${f.tersembunyi ? 'true' : 'false'};;` };
        }
        case 'wa': {
            if (!f.nomor.trim()) return { petunjuk: 'Isi nomor WhatsApp.' };
            const n = qrNomorWa(f.nomor);
            if (n.length < 8 || n.length > 15) return { galat: 'Nomor tidak valid (harus 8–15 digit setelah kode negara).' };
            return { teks: `https://wa.me/${n}` + (f.pesan.trim() ? `?text=${encodeURIComponent(f.pesan)}` : '') };
        }
        case 'email': {
            const a = f.alamat.trim();
            if (!a) return { petunjuk: 'Isi alamat email.' };
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)) return { galat: 'Alamat email tidak valid.' };
            const q = [];
            if (f.subjek.trim()) q.push('subject=' + encodeURIComponent(f.subjek));
            if (f.isi.trim()) q.push('body=' + encodeURIComponent(f.isi));
            return { teks: 'mailto:' + a + (q.length ? '?' + q.join('&') : '') };
        }
        case 'tel': {
            if (!f.telp.trim()) return { petunjuk: 'Isi nomor telepon.' };
            const n = f.telp.trim().replace(/[^\d+]/g, '');
            if (n.replace(/\+/g, '').length < 3) return { galat: 'Nomor telepon terlalu pendek.' };
            return { teks: 'tel:' + n };
        }
    }
    return { petunjuk: '' };
}

// ===== 4. ANTARMUKA =====
let qrTerakhir = null;       // { qr, teks, opsi } hasil terakhir yang valid
let qrTimer = null;

const qrAmbilForm = () => ({
    teks: $('qrTeks').value,
    ssid: $('qrSsid').value, sandi: $('qrSandi').value, enkripsi: $('qrEnkripsi').value, tersembunyi: $('qrTersembunyi').checked,
    nomor: $('qrNomor').value, pesan: $('qrPesan').value,
    alamat: $('qrAlamat').value, subjek: $('qrSubjek').value, isi: $('qrIsiEmail').value,
    telp: $('qrTelp').value
});

function qrGantiJenis() {
    const j = $('qrJenis').value;
    document.querySelectorAll('.qr-form').forEach(f => f.classList.toggle('hidden', f.id !== 'qr-' + j));
    qrBuat();
}

// tunda sebentar saat mengetik supaya tidak menggambar di setiap huruf
function qrBuatTunda() { clearTimeout(qrTimer); qrTimer = setTimeout(qrBuat, 120); }

function qrTombol(aktif) { document.querySelectorAll('.qr-aksi button').forEach(b => { b.disabled = !aktif; }); }

function qrBuat() {
    clearTimeout(qrTimer);
    const isi = qrIsi($('qrJenis').value, qrAmbilForm());
    const kotak = $('qrKotak'), info = $('qrInfo');
    if (!isi.teks) {
        qrTerakhir = null;
        kotak.classList.add('kosong');
        qrTombol(false);
        info.classList.add('show');
        info.innerHTML = isi.galat ? `<span class="err">${esc(isi.galat)}</span>` : `<span class="muted">${esc(isi.petunjuk || '')}</span>`;
        return;
    }
    const fg = $('qrFg').value, bg = $('qrBg').value;
    const margin = Math.max(0, Math.min(10, parseInt($('qrMargin').value, 10) || 0));
    let qr;
    try {
        qr = QRCode.encode(isi.teks, $('qrLevel').value);
    } catch (e) {
        qrTerakhir = null;
        kotak.classList.add('kosong');
        qrTombol(false);
        info.classList.add('show');
        info.innerHTML = `<span class="err">${e.tooLong ? 'Teks terlalu panjang untuk satu QR Code (maksimal sekitar 2.900 karakter). Persingkat isinya.' : esc(e.message)}</span>`;
        return;
    }
    kotak.classList.remove('kosong');
    const g = qrGambarCanvas($('qrCanvas'), qr, parseInt($('qrUkuran').value, 10), margin, fg, bg);
    qrTerakhir = { qr, teks: isi.teks, margin, fg, bg };
    qrTombol(true);
    // peringatan keterbacaan
    const kFg = warnaParse(fg), kBg = warnaParse(bg);
    const rasio = kFg && kBg ? rasioKontras(kFg, kBg) : 21;
    const terbalik = kFg && kBg && luminansi(kFg) > luminansi(kBg);
    const peringatan = [];
    if (rasio < 3) peringatan.push('Warna terlalu mirip (kontras rendah), QR sulit dipindai.');
    else if (terbalik) peringatan.push('Warna depan lebih terang dari latar (QR terbalik): sebagian pemindai tidak bisa membacanya.');
    if (margin < 2) peringatan.push('Margin kecil bisa mengganggu pemindaian (disarankan 4).');
    if (g.skala === 1 && qr.size + margin * 2 > parseInt($('qrUkuran').value, 10)) peringatan.push('Ukuran gambar yang dipilih terlalu kecil untuk isi sepanjang ini, jadi dipakai ukuran minimum.');
    info.classList.add('show');
    info.innerHTML =
        `<b>Versi ${qr.version}</b> · ${qr.size}×${qr.size} modul · koreksi ${qr.level}${qr.level !== $('qrLevel').value ? ' <span class="muted">(dinaikkan otomatis, ukuran tetap)</span>' : ''}<br>` +
        `<span class="muted">${esc(qr.mode)} · ${qr.bytes} ${qr.mode.startsWith('Byte') ? 'byte' : 'karakter'} · gambar ${g.piksel}×${g.piksel} px</span>` +
        peringatan.map(p => `<br><span class="err">⚠️ ${esc(p)}</span>`).join('');
}

function qrUnduhBlob(blob, nama) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nama;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function qrUnduhPng() {
    if (!qrTerakhir) return;
    $('qrCanvas').toBlob(b => { if (b) qrUnduhBlob(b, 'qr-code.png'); }, 'image/png');
}
function qrUnduhSvg() {
    if (!qrTerakhir) return;
    const t = qrTerakhir;
    qrUnduhBlob(new Blob([qrSvg(t.qr, t.margin, t.fg, t.bg)], { type: 'image/svg+xml' }), 'qr-code.svg');
}
async function qrSalinGambar(tombol) {
    if (!qrTerakhir) return;
    const lama = tombol.dataset.old === undefined ? (tombol.dataset.old = tombol.textContent) : tombol.dataset.old;
    let ok = false;
    try {
        const blob = await new Promise((res, rej) => $('qrCanvas').toBlob(b => b ? res(b) : rej(new Error('kosong')), 'image/png'));
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        ok = true;
    } catch (e) { ok = false; }
    tombol.textContent = ok ? 'Tersalin ✓' : 'Tidak didukung, pakai Unduh';
    clearTimeout(tombol._t);
    tombol._t = setTimeout(() => { tombol.textContent = lama; }, 1800);
}

TOOL_OPEN.qr = qrGantiJenis;
