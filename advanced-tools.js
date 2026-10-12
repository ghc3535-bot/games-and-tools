// ==========================================================================
// ADVANCED TOOLS — tool tambahan
// Daftar tool + 8 tool baru: Tanggal, Pengacak, Warna, Teks, Sandi, Timer, Bagi Tagihan, Basis Angka
// (Konverter, Persen, dan Massa→Liter ada di advanced.js; QR Code ada di advanced-qr.js)
// ==========================================================================

// ===== DAFTAR TOOL (urutan = urutan kartu) =====
const TOOLS = [
    { id: 'konverter', icon: '📏', nama: 'Konverter',     desk: 'Satuan massa, volume, dan panjang', kata: 'satuan gram kilogram liter meter inch cm mm' },
    { id: 'persen',    icon: '💰', nama: 'Diskon',        desk: 'Harga setelah diskon persen',        kata: 'persen harga potongan' },
    { id: 'massa',     icon: '⚖️', nama: 'Massa → Liter', desk: 'Berat bahan ke volume',              kata: 'kg liter densitas minyak susu air' },
    { id: 'tanggal',   icon: '📅', nama: 'Tanggal',       desk: 'Selisih hari, tambah/kurang, umur',  kata: 'kalender hari umur ulang tahun hari kerja' },
    { id: 'acak',      icon: '🎲', nama: 'Pengacak',      desk: 'Angka, undian nama, koin, dadu',     kata: 'random undian lotre pilih koin dadu' },
    { id: 'warna',     icon: '🎨', nama: 'Warna',         desk: 'HEX, RGB, HSL, dan kontras',         kata: 'hex rgb hsl color picker kontras' },
    { id: 'teks',      icon: '📝', nama: 'Teks',          desk: 'Hitung kata, ubah huruf, rapikan',   kata: 'kata karakter huruf besar kecil kapital urut' },
    { id: 'sandi',     icon: '🔐', nama: 'Sandi',         desk: 'Buat password yang kuat',            kata: 'password kata sandi generator aman' },
    { id: 'qr',        icon: '🔳', nama: 'QR Code',       desk: 'QR untuk tautan, WiFi, WhatsApp',    kata: 'qr barcode kode scan wifi whatsapp tautan link email telepon', butuh: 'qrBuat', file: 'advanced-qr.js' },
    { id: 'timer',     icon: '⏱️', nama: 'Timer',         desk: 'Hitung mundur dan Pomodoro',         kata: 'countdown pomodoro fokus istirahat stopwatch' },
    { id: 'tagihan',   icon: '🧾', nama: 'Bagi Tagihan',  desk: 'Patungan dengan pajak & service',    kata: 'split bill patungan pajak service restoran' },
    { id: 'basis',     icon: '🔢', nama: 'Basis Angka',   desk: 'Biner, oktal, heksa, dan Romawi',    kata: 'biner heksadesimal oktal romawi bilangan' }
];

// dijalankan saat sebuah tool dibuka (mengisi nilai awal)
const TOOL_OPEN = {};

// ===== PEMBANTU UMUM =====
const rupiah = n => 'Rp ' + n.toLocaleString('id-ID', { maximumFractionDigits: 2 });
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nilaiBaris = (k, v, salin) =>
    `<div class="nilai-row"><span class="k">${k}</span><span class="v">${esc(v)}</span>` +
    (salin === false ? '' : `<button data-copy="${esc(salin === undefined ? v : salin)}">Salin</button>`) + '</div>';

// bilangan acak bulat [min, max] yang seragam (crypto, tanpa bias modulo)
function randInt(min, max) {
    const range = max - min + 1;
    if (range <= 1) return min;
    if (window.crypto && crypto.getRandomValues && range <= 0x100000000) {
        const lim = Math.floor(0x100000000 / range) * range;
        const buf = new Uint32Array(1);
        let x;
        do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= lim);
        return min + (x % range);
    }
    return min + Math.floor(Math.random() * range);
}
function acakUrut(arr) {      // Fisher–Yates; mengembalikan salinan
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = randInt(0, i); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
}

// ==========================================================================
// 📅 TANGGAL
// ==========================================================================
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MS_HARI = 86400000;

// timestamp UTC untuk tahun berapa pun (Date.UTC memetakan tahun 0-99 ke 1900-an)
function utcMs(y, m, d) {
    const dt = new Date(0);
    dt.setUTCFullYear(y, m - 1, d);
    dt.setUTCHours(0, 0, 0, 0);
    return dt.getTime();
}
const hariDalamBulan = (y, m) => { const dt = new Date(0); dt.setUTCFullYear(y, m, 0); return dt.getUTCDate(); };
const kabisat = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

function tglParse(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return null;
    const [y, m, d] = s.split('-').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > hariDalamBulan(y, m)) return null;
    return { y, m, d, t: utcMs(y, m, d) };
}
function tglDariMs(t) {
    const dt = new Date(t);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), t, w: dt.getUTCDay() };
}
function tglFormat(o) {
    const w = new Date(o.t).getUTCDay();
    return `${HARI[w]}, ${o.d} ${BULAN[o.m - 1]} ${o.y}`;
}
function tglIso(o) { return `${String(o.y).padStart(4, '0')}-${String(o.m).padStart(2, '0')}-${String(o.d).padStart(2, '0')}`; }

// tambah bulan; kalau tanggalnya tidak ada di bulan tujuan, dipotong ke hari terakhir (31 Jan + 1 bulan = 28/29 Feb)
function tglTambahBulan(o, n) {
    const total = o.y * 12 + (o.m - 1) + n;
    const y = Math.floor(total / 12), m = total - y * 12 + 1;
    return tglDariMs(utcMs(y, m, Math.min(o.d, hariDalamBulan(y, m))));
}

// selisih kalender a -> b (a <= b): tahun, bulan, hari
function tglBeda(a, b) {
    let n = (b.y - a.y) * 12 + (b.m - a.m);
    if (tglTambahBulan(a, n).t > b.t) n--;
    const sisa = Math.round((b.t - tglTambahBulan(a, n).t) / MS_HARI);
    return { tahun: Math.floor(n / 12), bulan: n % 12, hari: sisa };
}

// jumlah hari kerja (Senin–Jumat) dari a sampai SEBELUM b
function hariKerja(a, b) {
    const total = Math.round((b.t - a.t) / MS_HARI);
    const pekan = Math.floor(total / 7);
    let n = pekan * 5;
    const mulai = new Date(a.t).getUTCDay();
    for (let i = 0; i < total - pekan * 7; i++) { const w = (mulai + i) % 7; if (w !== 0 && w !== 6) n++; }
    return n;
}

function isoHariIni() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function tglMode(mode, btn) { segPilih('tgl', mode, btn); tglHitung(); }

function tglHitung() {
    const aktif = ['selisih', 'tambah', 'umur'].find(m => !$('tgl-' + m).classList.contains('hidden'));
    if (aktif === 'selisih') tglSelisih();
    else if (aktif === 'tambah') tglTambah();
    else tglUmur();
}

function tglSelisih() {
    const a = tglParse($('tglA').value), b = tglParse($('tglB').value);
    if (!a || !b) { sembunyiHasil('tglHasil1'); return; }
    const [awal, akhir] = a.t <= b.t ? [a, b] : [b, a];
    const total = Math.round((akhir.t - awal.t) / MS_HARI);
    const bd = tglBeda(awal, akhir);
    const potong = [];
    if (bd.tahun) potong.push(bd.tahun + ' tahun');
    if (bd.bulan) potong.push(bd.bulan + ' bulan');
    if (bd.hari || !potong.length) potong.push(bd.hari + ' hari');
    tampilHasil('tglHasil1',
        `<span class="big"><b>${total.toLocaleString('id-ID')} hari</b></span><br>` +
        `${potong.join(' ')}<br>` +
        `${Math.floor(total / 7)} minggu ${total % 7} hari<br>` +
        `Hari kerja (Sen–Jum): <b>${hariKerja(awal, akhir).toLocaleString('id-ID')}</b><br>` +
        `<span class="muted">${tglFormat(awal)} → ${tglFormat(akhir)}${a.t > b.t ? ' (urutan dibalik otomatis)' : ''}</span>`);
}

function tglTambah() {
    const mulai = tglParse($('tglMulai').value);
    const n = parseInt($('tglJumlah').value, 10);
    if (!mulai || isNaN(n) || n < 0) { sembunyiHasil('tglHasil2'); return; }
    const arah = parseInt($('tglArah').value, 10);
    const satuan = $('tglSatuan').value;
    let hasil;
    if (satuan === 'hari') hasil = tglDariMs(mulai.t + arah * n * MS_HARI);
    else if (satuan === 'minggu') hasil = tglDariMs(mulai.t + arah * n * 7 * MS_HARI);
    else if (satuan === 'bulan') hasil = tglTambahBulan(mulai, arah * n);
    else hasil = tglTambahBulan(mulai, arah * n * 12);
    const selisih = Math.round((hasil.t - mulai.t) / MS_HARI);
    tampilHasil('tglHasil2',
        `<span class="big"><b>${tglFormat(hasil)}</b></span><br>` +
        `<span class="muted">${tglIso(hasil)} · ${Math.abs(selisih).toLocaleString('id-ID')} hari ${selisih < 0 ? 'sebelum' : 'setelah'} tanggal awal</span>`);
}

function tglUmur() {
    const lahir = tglParse($('tglLahir').value), ref = tglParse($('tglRef').value);
    if (!lahir || !ref) { sembunyiHasil('tglHasil3'); return; }
    if (lahir.t > ref.t) { tampilHasil('tglHasil3', 'Tanggal lahir tidak boleh setelah tanggal acuan.', true); return; }
    const bd = tglBeda(lahir, ref);
    const totalHari = Math.round((ref.t - lahir.t) / MS_HARI);
    // ulang tahun berikutnya (29 Feb di tahun biasa dirayakan 28 Feb)
    const tglUlang = y => utcMs(y, lahir.m, lahir.m === 2 && lahir.d === 29 && !kabisat(y) ? 28 : lahir.d);
    let next = tglUlang(ref.y);
    if (next < ref.t) next = tglUlang(ref.y + 1);
    const lagi = Math.round((next - ref.t) / MS_HARI);
    tampilHasil('tglHasil3',
        `<span class="big"><b>${bd.tahun} tahun ${bd.bulan} bulan ${bd.hari} hari</b></span><br>` +
        `Sudah hidup ${totalHari.toLocaleString('id-ID')} hari<br>` +
        `Lahir hari <b>${HARI[new Date(lahir.t).getUTCDay()]}</b><br>` +
        (lagi === 0 ? '🎉 <b>Hari ini ulang tahun!</b>' : `Ulang tahun berikutnya: <b>${lagi} hari lagi</b> (${tglFormat(tglDariMs(next))})`));
}

TOOL_OPEN.tanggal = () => {
    ['tglA', 'tglB', 'tglMulai', 'tglRef'].forEach(id => { if (!$(id).value) $(id).value = isoHariIni(); });
    tglHitung();
};

// ==========================================================================
// 🎲 PENGACAK
// ==========================================================================
function acakMode(mode, btn) { segPilih('acak', mode, btn); }

function acakAngka() {
    let min = parseInt($('acakMin').value, 10), max = parseInt($('acakMax').value, 10), n = parseInt($('acakJumlah').value, 10);
    if (isNaN(min) || isNaN(max) || isNaN(n)) { tampilHasil('acakHasilAngka', 'Isi minimum, maksimum, dan jumlah dengan bilangan bulat.', true); return; }
    if (min > max) [min, max] = [max, min];
    if (max - min > 2e9) { tampilHasil('acakHasilAngka', 'Rentang terlalu besar (maksimal 2 miliar).', true); return; }
    if (n < 1 || n > 1000) { tampilHasil('acakHasilAngka', 'Jumlah harus 1 sampai 1000.', true); return; }
    const range = max - min + 1;
    const unik = $('acakUnik').checked;
    if (unik && n > range) { tampilHasil('acakHasilAngka', `Hanya ada ${range} angka berbeda di rentang ini, tidak bisa mengambil ${n} tanpa kembar.`, true); return; }
    const hasil = [];
    if (unik) {
        const dipakai = new Set();
        while (hasil.length < n) { const x = randInt(min, max); if (!dipakai.has(x)) { dipakai.add(x); hasil.push(x); } }
    } else {
        for (let i = 0; i < n; i++) hasil.push(randInt(min, max));
    }
    tampilHasil('acakHasilAngka', n === 1
        ? `<span class="big"><b>${hasil[0]}</b></span> <span class="muted">(${min}–${max})</span>`
        : `<b>${hasil.join(', ')}</b><br><span class="muted">${n} angka dari ${min}–${max}${unik ? ', tanpa kembar' : ''}</span>`);
}

function acakBaris() { return $('acakDaftar').value.split('\n').map(s => s.trim()).filter(Boolean); }

function acakDaftarPilih() {
    const daftar = acakBaris();
    const n = parseInt($('acakPilih').value, 10);
    if (daftar.length < 1) { tampilHasil('acakHasilDaftar', 'Isi daftar dulu (satu per baris).', true); return; }
    if (isNaN(n) || n < 1) { tampilHasil('acakHasilDaftar', 'Jumlah yang dipilih harus minimal 1.', true); return; }
    if (n > daftar.length) { tampilHasil('acakHasilDaftar', `Daftar hanya berisi ${daftar.length} item.`, true); return; }
    const terpilih = acakUrut(daftar).slice(0, n);
    tampilHasil('acakHasilDaftar', n === 1
        ? `<span class="big"><b>${esc(terpilih[0])}</b></span>`
        : terpilih.map((x, i) => `${i + 1}. <b>${esc(x)}</b>`).join('<br>'));
}

function acakKocok() {
    const daftar = acakBaris();
    if (daftar.length < 2) { tampilHasil('acakHasilDaftar', 'Isi minimal 2 item untuk dikocok.', true); return; }
    tampilHasil('acakHasilDaftar', acakUrut(daftar).map((x, i) => `${i + 1}. ${esc(x)}`).join('<br>'));
}

const koinHitung = { gambar: 0, angka: 0 };
function acakKoin() {
    const sisi = randInt(0, 1) === 0 ? 'gambar' : 'angka';
    koinHitung[sisi]++;
    const el = $('koinTampil');
    el.textContent = sisi === 'gambar' ? '🦅' : '🔢';
    el.classList.remove('putar'); void el.offsetWidth; el.classList.add('putar');
    tampilHasil('acakHasilKoin',
        `<span class="big"><b>${sisi.toUpperCase()}</b></span><br>` +
        `<span class="muted">Total lemparan: GAMBAR ${koinHitung.gambar} · ANGKA ${koinHitung.angka}</span>`);
}

function acakDadu() {
    const n = parseInt($('acakDaduJml').value, 10);
    const muka = '⚀⚁⚂⚃⚄⚅';
    const nilai = Array.from({ length: n }, () => randInt(1, 6));
    const total = nilai.reduce((a, b) => a + b, 0);
    tampilHasil('acakHasilDadu',
        `<div class="dadu-wrap">${nilai.map(v => `<span title="${v}">${muka[v - 1]}</span>`).join('')}</div>` +
        `<div style="text-align:center">${nilai.join(' + ')}${n > 1 ? ` = <b>${total}</b>` : ''}</div>`);
}

// ==========================================================================
// 🎨 WARNA
// ==========================================================================
function hslKeRgb(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
function rgbKeHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    const l = (max + min) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (d !== 0) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60; if (h < 0) h += 360;
    }
    return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}
const rgbKeHex = (r, g, b) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');

// menerima #abc, #aabbcc, rgb(1,2,3), hsl(120,50%,50%)
function warnaParse(str) {
    str = (str || '').trim().toLowerCase();
    let m = str.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/);
    if (m) {
        let h = m[1];
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    m = str.match(/^rgb\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*\)$/);
    if (m) { const a = [+m[1], +m[2], +m[3]]; return a.every(v => v <= 255) ? a : null; }
    m = str.match(/^hsl\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})%?\s*[, ]\s*(\d{1,3})%?\s*\)$/);
    if (m && +m[1] <= 360 && +m[2] <= 100 && +m[3] <= 100) return hslKeRgb(+m[1], +m[2], +m[3]);
    return null;
}

// kecerahan relatif & rasio kontras menurut WCAG 2.x
function luminansi([r, g, b]) {
    const c = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}
function rasioKontras(a, b) {
    const l1 = luminansi(a), l2 = luminansi(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
const levelKontras = r => r >= 7 ? 'AAA ✓✓' : r >= 4.5 ? 'AA ✓' : r >= 3 ? 'hanya teks besar' : 'tidak lolos ✗';

let warnaSaatIni = [181, 122, 255];

function warnaTampil(rgb) {
    warnaSaatIni = rgb;
    const [r, g, b] = rgb;
    const hex = rgbKeHex(r, g, b);
    const [h, s, l] = rgbKeHsl(r, g, b);
    $('warnaPicker').value = hex;
    $('warnaSwatch').style.background = hex;
    $('warnaNilai').innerHTML =
        nilaiBaris('HEX', hex.toUpperCase()) +
        nilaiBaris('RGB', `rgb(${r}, ${g}, ${b})`) +
        nilaiBaris('HSL', `hsl(${h}, ${s}%, ${l}%)`);
    const kPutih = rasioKontras(rgb, [255, 255, 255]), kHitam = rasioKontras(rgb, [0, 0, 0]);
    tampilHasil('warnaKontras',
        `Teks <b>putih</b> di atas warna ini: <b>${kPutih.toFixed(2)}:1</b> (${levelKontras(kPutih)})<br>` +
        `Teks <b>hitam</b> di atas warna ini: <b>${kHitam.toFixed(2)}:1</b> (${levelKontras(kHitam)})<br>` +
        `<span class="muted">Disarankan teks ${kPutih >= kHitam ? 'putih' : 'hitam'}.</span>`);
    const steps = [92, 80, 66, 50, 36, 24, 12];
    $('warnaPalet').innerHTML = steps.map(L => {
        const c = rgbKeHex(...hslKeRgb(h, s, L));
        return `<button style="background:${c}" data-warna="${c}" aria-label="${c}" title="${c}"></button>`;
    }).join('');
}

function warnaDariPicker() { $('warnaHex').value = $('warnaPicker').value; warnaTampil(warnaParse($('warnaPicker').value)); }
function warnaDariTeks() {
    const rgb = warnaParse($('warnaHex').value);
    if (!rgb) { tampilHasil('warnaKontras', 'Format belum dikenali. Contoh: #b57aff, #f0f, rgb(181,122,255), hsl(270,100%,74%)', true); return; }
    warnaTampil(rgb);
}
document.addEventListener('click', e => {
    const b = e.target.closest('[data-warna]');
    if (b) { $('warnaHex').value = b.dataset.warna; warnaTampil(warnaParse(b.dataset.warna)); }
});
TOOL_OPEN.warna = () => warnaTampil(warnaParse($('warnaHex').value) || warnaSaatIni);

// ==========================================================================
// 📝 TEKS
// ==========================================================================
// regex huruf Unicode (\p{L}) tidak dikenal browser lama; dibuat lewat RegExp() dengan cadangan agar file tetap terbaca
function buatRegexHuruf(awalan) {
    try { return new RegExp(awalan + '(\\p{L})', 'gu'); }
    catch (e) { return new RegExp(awalan + '([a-zA-Z\u00C0-\u024F])', 'g'); }
}
const RE_AWAL_KATA = buatRegexHuruf("(^|[\\s\\-'\"(])");
const RE_AWAL_KALIMAT = buatRegexHuruf('(^|[.!?]\\s+|\\n)');

function teksHitung() {
    const t = $('teksInput').value;
    const kata = (t.trim().match(/\S+/g) || []).length;
    const huruf = [...t].length;
    const tanpaSpasi = [...t.replace(/\s/g, '')].length;
    const kalimat = t.split(/[.!?…]+(?:\s|$)/).filter(s => s.trim()).length;
    const paragraf = t.split(/\n\s*\n/).filter(s => s.trim()).length;
    const baris = t ? t.split('\n').length : 0;
    const baca = kata === 0 ? '0' : Math.max(1, Math.ceil(kata / 200)) + ' mnt';
    const s = (n, label) => `<div class="stat"><b>${n}</b><span>${label}</span></div>`;
    $('teksStat').innerHTML = s(kata, 'kata') + s(huruf, 'karakter') + s(tanpaSpasi, 'tanpa spasi') + s(kalimat, 'kalimat') +
        s(paragraf, 'paragraf') + s(baris, 'baris') + s(baca, 'waktu baca');
}

function teksAksi(aksi) {
    const el = $('teksInput');
    let t = el.value;
    switch (aksi) {
        case 'upper': t = t.toLocaleUpperCase('id'); break;
        case 'lower': t = t.toLocaleLowerCase('id'); break;
        case 'title': t = t.toLocaleLowerCase('id').replace(RE_AWAL_KATA, (m, a, b) => a + b.toLocaleUpperCase('id')); break;
        case 'kalimat': t = t.toLocaleLowerCase('id').replace(RE_AWAL_KALIMAT, (m, a, b) => a + b.toLocaleUpperCase('id')); break;
        case 'spasi': t = t.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim(); break;
        case 'urut': t = t.split('\n').map(l => l.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' })).join('\n'); break;
        case 'unik': { const lihat = new Set(); t = t.split('\n').filter(l => { const k = l.trim(); if (!k || lihat.has(k)) return false; lihat.add(k); return true; }).join('\n'); break; }
        case 'balik': t = [...t].reverse().join(''); break;
        case 'hapus': t = ''; break;
    }
    el.value = t;
    teksHitung();
    el.focus();
}
TOOL_OPEN.teks = teksHitung;

// ==========================================================================
// 🔐 SANDI
// ==========================================================================
const SANDI_POOL = {
    besar: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    kecil: 'abcdefghijklmnopqrstuvwxyz',
    angka: '0123456789',
    simbol: '!@#$%^&*()-_=+[]{};:,.?/'
};

function sandiBuat() {
    const panjang = parseInt($('sandiPanjang').value, 10);
    $('sandiPanjangNilai').textContent = panjang;
    const hindari = $('sandiMirip').checked ? /[O0Il1|]/g : null;
    const kelas = ['besar', 'kecil', 'angka', 'simbol']
        .filter(k => $('sandi' + k[0].toUpperCase() + k.slice(1)).checked)
        .map(k => hindari ? SANDI_POOL[k].replace(hindari, '') : SANDI_POOL[k]);
    if (!kelas.length) {
        $('sandiHasil').textContent = 'Pilih minimal satu jenis karakter';
        $('sandiBar').style.width = '0';
        $('sandiLabel').textContent = '';
        return;
    }
    const gabung = kelas.join('');
    // minimal satu karakter dari tiap jenis yang dipilih, sisanya dari gabungan, lalu diacak
    const huruf = kelas.map(k => k[randInt(0, k.length - 1)]);
    while (huruf.length < panjang) huruf.push(gabung[randInt(0, gabung.length - 1)]);
    const sandi = acakUrut(huruf).join('');
    $('sandiHasil').textContent = sandi;
    const bit = panjang * Math.log2(gabung.length);
    const [label, warna] = bit < 40 ? ['Lemah', '#d93a2f'] : bit < 60 ? ['Sedang', '#e69a1c'] : bit < 80 ? ['Kuat', '#7cb518'] : ['Sangat kuat', '#2e9b3a'];
    $('sandiBar').style.width = Math.min(100, bit) + '%';
    $('sandiBar').style.background = warna;
    $('sandiLabel').textContent = `${label} · ${Math.round(bit)} bit`;
}
TOOL_OPEN.sandi = sandiBuat;

// ==========================================================================
// ⏱️ TIMER (hitung mundur + Pomodoro)
// ==========================================================================
const tmr = { mode: 'mundur', fase: 'fokus', total: 300000, sisa: 300000, jalan: false, akhir: 0, handle: null, sesi: 0 };
const judulAwal = document.title;

function tmrFormat(ms) {
    const s = Math.ceil(Math.max(0, ms) / 1000);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}
function tmrRender() {
    $('tmrTampil').textContent = tmrFormat(tmr.sisa);
    $('tmrToggle').textContent = tmr.jalan ? '⏸ Jeda' : (tmr.sisa < tmr.total && tmr.sisa > 0 ? '▶ Lanjut' : '▶ Mulai');
    $('tmrFase').textContent = tmr.mode === 'pomodoro' ? (tmr.fase === 'fokus' ? '🎯 Waktunya fokus' : '☕ Waktunya istirahat') : '';
    $('pomoJumlah').textContent = tmr.sesi;
    document.title = tmr.jalan ? `${tmrFormat(tmr.sisa)} · ${judulAwal}` : judulAwal;
}
function tmrMode(mode, btn) {
    if (tmr.jalan) tmrBerhenti();
    segPilih('tmr', mode, btn);
    tmr.mode = mode;
    tmr.fase = 'fokus';
    tmrAtur(true);
}
// ambil durasi dari kolom input (hanya saat tidak berjalan)
function tmrAtur(paksa) {
    if (tmr.jalan && paksa !== true) return;
    let menit;
    if (tmr.mode === 'mundur') menit = Math.max(0, parseInt($('tmrMenit').value, 10) || 0) + Math.min(59, Math.max(0, parseInt($('tmrDetik').value, 10) || 0)) / 60;
    else menit = Math.max(1, parseFloat($(tmr.fase === 'fokus' ? 'pomoFokus' : 'pomoIstirahat').value) || (tmr.fase === 'fokus' ? 25 : 5));
    tmr.total = tmr.sisa = Math.round(menit * 60000);
    $('tmrTampil').classList.remove('selesai');
    tmrRender();
}
function tmrPreset(menit) { $('tmrMenit').value = menit; $('tmrDetik').value = 0; tmrAtur(); }
function tmrBerhenti() { clearInterval(tmr.handle); tmr.handle = null; tmr.jalan = false; }
function tmrToggle() {
    if (tmr.jalan) {                         // jeda
        tmr.sisa = Math.max(0, tmr.akhir - Date.now());
        tmrBerhenti();
        tmrRender();
        return;
    }
    if (tmr.sisa <= 0) tmrAtur(true);
    if (tmr.sisa <= 0) return;               // durasi 0 tidak bisa dimulai
    getAudio();                              // izinkan suara (butuh sentuhan pengguna)
    $('tmrTampil').classList.remove('selesai');
    tmr.akhir = Date.now() + tmr.sisa;
    tmr.jalan = true;
    tmr.handle = setInterval(tmrTick, 250);
    tmrRender();
}
function tmrTick() {
    if (!tmr.jalan) return;
    tmr.sisa = Math.max(0, tmr.akhir - Date.now());
    if (tmr.sisa > 0) { tmrRender(); return; }
    tmrBerhenti();
    tmrBunyi();
    if (tmr.mode === 'pomodoro') {           // lanjut otomatis ke fase berikutnya
        if (tmr.fase === 'fokus') tmr.sesi++;
        tmr.fase = tmr.fase === 'fokus' ? 'istirahat' : 'fokus';
        tmrAtur(true);
        tmrToggle();
    } else {
        $('tmrTampil').classList.add('selesai');
        tmrRender();
        $('tmrFase').textContent = '⏰ Waktu habis!';
    }
}
function tmrBunyi() {
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}
    const ac = getAudio();
    if (!ac) return;
    [0, 0.25, 0.5].forEach(d => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.connect(g); g.connect(ac.destination);
        o.type = 'sine'; o.frequency.value = 880;
        g.gain.setValueAtTime(0.25, ac.currentTime + d);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + d + 0.2);
        o.start(ac.currentTime + d); o.stop(ac.currentTime + d + 0.21);
    });
}
function tmrReset() {
    tmrBerhenti();
    tmr.fase = 'fokus';
    if (tmr.mode === 'pomodoro') tmr.sesi = 0;
    tmrAtur(true);
}
TOOL_OPEN.timer = () => { if (!tmr.jalan) tmrAtur(true); else tmrRender(); };

// ==========================================================================
// 🧾 BAGI TAGIHAN
// ==========================================================================
function bagiHitung() {
    const total = parseFloat($('bagiTotal').value);
    const pajak = parseFloat($('bagiPajak').value) || 0;
    const service = parseFloat($('bagiService').value) || 0;
    const orang = parseInt($('bagiOrang').value, 10);
    const bulat = parseInt($('bagiBulat').value, 10) || 1;
    if (isNaN(total) || total < 0) { sembunyiHasil('bagiHasil'); return; }
    if (!(orang >= 1)) { tampilHasil('bagiHasil', 'Jumlah orang minimal 1.', true); return; }
    const r2 = x => Math.round(x * 100) / 100;
    const p = r2(total * pajak / 100), s = r2(total * service / 100);
    const grand = r2(total + p + s);
    const per = grand / orang;
    const perBulat = bulat === 1 ? r2(per) : Math.ceil(per / bulat - 1e-9) * bulat;
    const terkumpul = r2(perBulat * orang), lebih = r2(terkumpul - grand);
    let h = `Tagihan: ${rupiah(total)}<br>`;
    if (pajak) h += `Pajak ${pajak}%: ${rupiah(p)}<br>`;
    if (service) h += `Service ${service}%: ${rupiah(s)}<br>`;
    h += `Total: <b>${rupiah(grand)}</b><br><span class="big">Per orang (${orang}): <b>${rupiah(perBulat)}</b></span>`;
    if (bulat > 1 && lebih !== 0) h += `<br><span class="muted">Terkumpul ${rupiah(terkumpul)} (kelebihan ${rupiah(lebih)} karena pembulatan)</span>`;
    tampilHasil('bagiHasil', h);
}
TOOL_OPEN.tagihan = bagiHitung;

// ==========================================================================
// 🔢 BASIS ANGKA & ROMAWI
// ==========================================================================
const BASIS_VALID = { 10: /^[0-9]+$/, 2: /^[01]+$/, 8: /^[0-7]+$/, 16: /^[0-9a-f]+$/i };
const ADA_BIGINT = typeof BigInt === 'function';
const BASIS_NAMA = { 10: 'desimal', 2: 'biner', 8: 'oktal', 16: 'heksadesimal' };

function parseBasis(str, basis) {
    let s = str.trim().replace(/[\s_]/g, '');
    if (basis === 16) s = s.replace(/^0x/i, '');
    if (basis === 2) s = s.replace(/^0b/i, '');
    if (!s) return null;
    if (!BASIS_VALID[basis].test(s)) return undefined;     // ada karakter yang tidak cocok dengan basis
    let n = ADA_BIGINT ? BigInt(0) : 0;      // tanpa BigInt (browser sangat lama) hanya akurat sampai 2^53
    const b = ADA_BIGINT ? BigInt(basis) : basis;
    for (const ch of s) n = n * b + (ADA_BIGINT ? BigInt(parseInt(ch, 16)) : parseInt(ch, 16));
    return n;
}
const kelompok = (s, n) => s.replace(new RegExp(`\\B(?=(.{${n}})+$)`, 'g'), ' ');

function keRomawi(n) {
    if (n < 1 || n > 3999) return null;
    const t = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let out = '';
    for (const [v, r] of t) while (n >= v) { out += r; n -= v; }
    return out;
}
function dariRomawi(s) {
    s = s.trim().toUpperCase();
    if (!/^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(s) || !s) return null;
    const v = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
    let n = 0;
    for (let i = 0; i < s.length; i++) n += (v[s[i]] < (v[s[i + 1]] || 0)) ? -v[s[i]] : v[s[i]];
    return n;
}

function basisHitung() {
    const basis = parseInt($('basisDari').value, 10);
    const raw = $('basisInput').value;
    const box = $('basisHasil');
    const n = parseBasis(raw, basis);
    if (n === null) { box.innerHTML = ''; return; }
    if (n === undefined) {
        box.innerHTML = `<div class="hasil-box show"><span class="err">“${esc(raw)}” bukan bilangan ${BASIS_NAMA[basis]} yang valid.</span></div>`;
        return;
    }
    const rom = Number(n) <= 3999 ? keRomawi(Number(n)) : null;
    box.innerHTML =
        nilaiBaris('Desimal', n.toString(10)) +
        nilaiBaris('Biner', kelompok(n.toString(2), 4), n.toString(2)) +
        nilaiBaris('Oktal', n.toString(8)) +
        nilaiBaris('Heksa', n.toString(16).toUpperCase()) +
        nilaiBaris('Romawi', rom || '— (hanya untuk 1–3999)', rom || false);
}

function romawiHitung() {
    const raw = $('romawiInput').value;
    if (!raw.trim()) { sembunyiHasil('romawiHasil'); return; }
    const n = dariRomawi(raw);
    if (n === null) { tampilHasil('romawiHasil', 'Tulis angka Romawi baku, mis. XIV, MCMXCIV.', true); return; }
    tampilHasil('romawiHasil', `${esc(raw.trim().toUpperCase())} = <b>${n}</b>`);
}
TOOL_OPEN.basis = () => { basisHitung(); romawiHitung(); };
