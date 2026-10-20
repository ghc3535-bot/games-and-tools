// Baca daftar dari penyimpanan browser dengan aman: data rusak, bukan daftar, atau penyimpanan diblokir -> daftar kosong.
// (Sebelumnya satu data rusak membuat seluruh halaman berhenti bekerja.)
function bacaDaftar(kunci) {
    try {
        const v = JSON.parse(localStorage.getItem(kunci));
        return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
}

let historyList = bacaDaftar('calcHistory');
// Stopwatch variables
let stopwatchInterval = null;
let stopwatchTime = 0;
let isRunning = false;

// TO-DO + CATATAN GABUNG - hapus 'todos' lama biar gak bentrok
let tasks = bacaDaftar('tasks').filter(t => t && typeof t.text === 'string');

// ==========================================================================
// DAFTAR TOOL & NAVIGASI
// Alur: layar utama (#) -> daftar tools (#tools) -> satu tool (#tools/diagram)
// Pakai # supaya tombol Kembali di HP dan tautan langsung (index.html#tools/suhu) bekerja.
// ==========================================================================
const $ = id => document.getElementById(id);

const TOOLS_UTAMA = [
    { id: 'kalkulator',      icon: '🧮', nama: 'Kalkulator',      desk: 'Hitung, akar, pecahan, lingkaran, kubus', kata: 'hitung tambah kurang kali bagi pangkat pecahan history' },
    { id: 'statistikDasar',  icon: '📊', nama: 'Stat Dasar',      desk: 'Rata-rata, median, modus, simpangan baku',  kata: 'mean median modus rata-rata persentase statistik varians simpangan baku standar deviasi sebaran' },
    { id: 'statistikLanjut', icon: '📈', nama: 'Data Persentil',  desk: 'Kuartil, IQR, outlier, persentil',         kata: 'kuartil q1 q3 iqr outlier persentil statistik' },
    { id: 'diagram',         icon: '📉', nama: 'Diagram',         desk: 'Bar, line, pie, donut, lalu ekspor',       kata: 'chart grafik bar line pie donut png jpg gambar' },
    { id: 'suhu',            icon: '🌡️', nama: 'Suhu',            desk: 'Celcius, Fahrenheit, Kelvin',              kata: 'celcius fahrenheit kelvin konversi' },
    { id: 'uang',            icon: '💱', nama: 'Uang',            desk: 'Konversi IDR, USD, EUR, JPY, SGD',         kata: 'kurs rupiah dollar euro yen konversi' },
    { id: 'catatanTodo',     icon: '📝', nama: 'Catatan & To-Do', desk: 'Daftar tugas dan catatan tersimpan',       kata: 'todo tugas catatan note' },
    { id: 'stopwatch',       icon: '⏱️', nama: 'Stopwatch',       desk: 'Hitung waktu dengan lap',                  kata: 'waktu timer lap detik' }
];

function pergi(hash) {
    if (location.hash === hash || (hash === '' && location.hash === '')) route();
    else location.hash = hash;
}
function keBeranda() { pergi('#'); }
function keDaftarTools() { pergi('#tools'); }
function openTool(id) { pergi('#tools/' + id); }
function switchTab(tabName) { openTool(tabName); }          // nama lama, tetap didukung

function route() {
    const bagian = location.hash.replace(/^#/, '').split('/');
    const layar = bagian[0] === 'tools' ? 'tools' : 'home';
    $('viewHome').classList.toggle('hidden', layar !== 'home');
    $('viewTools').classList.toggle('hidden', layar !== 'tools');
    $('backHome').classList.toggle('hidden', layar === 'home');
    if (layar === 'home') { renderHome(); }
    else if (TOOLS_UTAMA.some(t => t.id === bagian[1])) { tampilTool(bagian[1]); }
    else { $('toolsHome').classList.remove('hidden'); $('toolView').classList.add('hidden'); }
    window.scrollTo({ top: 0 });
}

function renderToolGrid() {
    $('toolGrid').innerHTML = TOOLS_UTAMA.map(t =>
        `<button class="tool-card" data-id="${t.id}" onclick="openTool('${t.id}')">` +
        `<span class="ico">${t.icon}</span><span class="nama">${t.nama}</span><span class="desk">${t.desk}</span></button>`
    ).join('');
}

function filterTools() {
    const q = $('toolFilter').value.trim().toLowerCase();
    let n = 0;
    document.querySelectorAll('.tool-card').forEach(c => {
        const t = TOOLS_UTAMA.find(x => x.id === c.dataset.id);
        const cocok = !q || (t.nama + ' ' + t.desk + ' ' + t.kata).toLowerCase().includes(q);
        c.classList.toggle('hidden', !cocok);
        if (cocok) n++;
    });
    $('toolEmpty').classList.toggle('hidden', n > 0);
}

function tampilTool(id) {
    const t = TOOLS_UTAMA.find(x => x.id === id);
    $('toolsHome').classList.add('hidden');
    $('toolView').classList.remove('hidden');
    document.querySelectorAll('.tool-panel').forEach(p => p.classList.toggle('hidden', p.id !== id));
    $('toolTitle').innerHTML = `<span class="t-ico">${t.icon}</span> ${t.nama}`;   // ikon di luar efek gradasi supaya tetap berwarna
    if (id === 'catatanTodo') { showTasks(); loadNote(); }
    if (id === 'diagram' && diagramDrawn && lastDiagramSpec && $('chartContainer').clientWidth !== lastDiagramWidth) renderDiagram(lastDiagramSpec);
}

// ----- layar utama -----
function renderHome() {
    $('homeTanggal').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const baris = [];
    try {
        tasks = bacaDaftar('tasks').filter(t => t && typeof t.text === 'string');
        const belum = tasks.filter(t => !t.done).length;
        if (belum > 0) baris.push(`<a class="info-baris" href="#tools/catatanTodo"><span>📝</span><span class="ib-teks">${belum} tugas belum selesai</span><span class="ib-aksi">Buka ›</span></a>`);
    } catch (e) { /* abaikan data rusak */ }
    try {
        const catur = JSON.parse(localStorage.getItem('catur_save_v1'));
        if (catur && Array.isArray(catur.history) && catur.history.length > 0)
            baris.push(`<a class="info-baris" href="catur.html"><span>♞</span><span class="ib-teks">Game catur tersimpan · ${catur.history.length} langkah</span><span class="ib-aksi">Lanjutkan ›</span></a>`);
    } catch (e) { /* abaikan data rusak */ }
    const kotak = $('homeInfo');
    kotak.innerHTML = baris.length ? '<h3>Terakhir</h3>' + baris.join('') : '';
    kotak.classList.toggle('hidden', baris.length === 0);
}

document.addEventListener("DOMContentLoaded", () => {
    // THEME
    let savedTheme = null;
    try { savedTheme = localStorage.getItem('theme'); } catch (e) {}
    const btn = document.getElementById('themeBtn');
    if (savedTheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        if(btn) btn.innerText = '☀️ Light Mode';
    }

    // INIT
    const operator = document.getElementById("operator");
    if(operator) {
        operator.addEventListener("change", toggleAngka2);
        toggleAngka2();
    }

    // tekan Enter di kolom isian = jalankan tombol utamanya
    const enter = { angka1: 'hitung', angka2: 'hitung', dataDasar: 'hitungStatistikDasar', labelDasar: 'hitungStatistikDasar',
        dataStatistik: 'hitungStatistikLanjut', persentilInput: 'hitungStatistikLanjut', suhuInput: 'konversiSuhu', uangInput: 'konversiUang',
        taskInput: 'addTask', judulDiagram: 'gambarDiagram', labelData: 'gambarDiagram', nilaiData: 'gambarDiagram' };
    Object.keys(enter).forEach(id => {
        const el = $(id);
        if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); window[enter[id]](); } });
    });

    showTasks();
    loadNote();
    updateStopwatchDisplay();

    renderToolGrid();
    window.addEventListener('hashchange', route);
    route();
});

function toggleAngka2() {
    const op = document.getElementById("operator").value;
    const angka2 = document.getElementById("angka2");
    const wrap = document.getElementById("angka2Wrap") || angka2;
    if (op === "sqrt" || op === "lingkaran" || op === "kubus") {
        wrap.style.display = "none";
        angka2.value = "";
    } else {
        wrap.style.display = "block";
    }
}

const unicodeFractions = {
    '½': 0.5, '¼': 0.25, '¾': 0.75,
    '⅓': 1/3, '⅔': 2/3,
    '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
    '⅙': 1/6, '⅚': 5/6,
    '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
    '⅑': 1/9, '⅒': 0.1
};

// Membaca angka dari kolom isian. Format yang dikenali:
//   12   1,5   1.5   .5          bilangan biasa (koma atau titik sebagai desimal)
//   3/4   2 1/2   2 ½   2½       pecahan dan bilangan campuran (pecahan Unicode boleh menempel: 2½)
//   -½   -2 1/2   -3/4           minus di depan berlaku untuk seluruh nilai
// Yang tidak dikenali (mis. "1.000.000", "12abc", "--5") menghasilkan NaN supaya muncul pesan galat,
// bukan angka yang salah diam-diam (sebelumnya "2½" terbaca 2 dan "1.000.000" terbaca 1).
const RE_BULAT_PECAHAN = new RegExp('^(\\d+)\\s*([' + Object.keys(unicodeFractions).join('') + '])$');
const RE_DESIMAL = /^(\d+([.,]\d*)?|[.,]\d+)([eE][+-]?\d+)?$/;

function parseNumber(val) {
    if (!val) return NaN;
    let s = String(val).trim();
    let tanda = 1;
    if (s[0] === '-' || s[0] === '\u2212') { tanda = -1; s = s.slice(1).trim(); }
    if (!s || s[0] === '-' || s[0] === '\u2212') return NaN;

    let hasil;
    const campur = s.match(RE_BULAT_PECAHAN);
    if (campur) {
        hasil = parseFloat(campur[1]) + unicodeFractions[campur[2]];
    } else if (/\s/.test(s)) {
        const parts = s.split(/\s+/);
        if (parts.length !== 2 || !RE_DESIMAL.test(parts[0])) return NaN;
        const whole = parseFloat(parts[0].replace(',', '.'));
        const frac = parts[1] in unicodeFractions ? unicodeFractions[parts[1]] : parseFraction(parts[1]);
        hasil = whole + frac;
    } else if (s.includes('/')) {
        hasil = parseFraction(s);
    } else if (unicodeFractions[s] !== undefined) {
        hasil = unicodeFractions[s];
    } else if (RE_DESIMAL.test(s)) {
        hasil = parseFloat(s.replace(',', '.'));
    } else {
        return NaN;
    }
    return hasil === 0 ? 0 : tanda * hasil;      // hindari -0
}

// buang noise floating point (0.1+0.2 -> 0.3)
function rapikan(n) {
    return Number.isFinite(n) ? parseFloat(n.toPrecision(12)) : n;
}

function parseFraction(frac) {
    const parts = frac.split('/');
    if (parts.length !== 2 || !RE_DESIMAL.test(parts[0].trim()) || !RE_DESIMAL.test(parts[1].trim())) return NaN;
    const num = parseFloat(parts[0].replace(',', '.'));
    const den = parseFloat(parts[1].replace(',', '.'));
    if (isNaN(num) || isNaN(den) || den === 0) return NaN;
    return num / den;
}

// DIAGRAM
let diagramDrawn = false;
let lastDiagramSpec = null;
let lastDiagramWidth = 0;

const FONT = "'Times New Roman', serif";

function gambarDiagram() {
    let labels = document.getElementById("labelData").value
        .split(',')
        .map(s => s.trim())
        .filter(s => s !== "");
    let values = document.getElementById("nilaiData").value
        .split(',')
        .map(s => parseFloat(s.trim()))
        .filter(x => !isNaN(x));

    if (values.length === 0) {
        alert("Isi label dan nilai dulu!");
        return;
    }
    if (labels.length !== values.length) {
        alert("Jumlah label dan nilai harus sama!");
        return;
    }

    // urutkan data (opsional)
    const urut = document.getElementById("urutData").value;
    if (urut !== "asli") {
        const idx = labels.map((_, i) => i);
        if (urut === "desc") idx.sort((a, b) => values[b] - values[a]);
        else if (urut === "asc") idx.sort((a, b) => values[a] - values[b]);
        else idx.sort((a, b) => labels[a].localeCompare(labels[b], 'id', {numeric: true}));
        labels = idx.map(i => labels[i]);
        values = idx.map(i => values[i]);
    }

    renderDiagram({
        labels, values,
        tipe: document.getElementById("tipeDiagram").value,
        bg: document.getElementById("bgDiagram").value,
        palet: document.getElementById("paletWarna").value,
        judul: document.getElementById("judulDiagram").value || "Diagram"
    });
}

// menggambar dari data yang sudah divalidasi (tidak membaca kolom input lagi)
function renderDiagram(spec) {
    lastDiagramSpec = spec;
    const {labels, values, tipe, bg, judul} = spec;
    const canvas = document.getElementById("canvasDiagram");
    const ctx = canvas.getContext("2d");
    const colors = getColors(spec.palet, values.length);
    const total = values.reduce((a, b) => a + b, 0);
    const mean = total / values.length;

    const wrap = document.getElementById("chartContainer");
    const availW = Math.max(300, (wrap.clientWidth || 340) - 2);
    const theme = {
        bg: bg === "gelap" ? "#1e1e2e" : "#ffffff",
        text: bg === "gelap" ? "#cdd6f4" : "#1e1e2e",
        soft: bg === "gelap" ? "rgba(205,214,244,0.65)" : "rgba(30,30,46,0.65)",
        grid: bg === "gelap" ? "rgba(205,214,244,0.16)" : "rgba(30,30,46,0.12)"
    };

    const isRound = tipe === "pie" || tipe === "donut";
    const layout = isRound ? layoutPie(labels, availW) : layoutBar(labels, values, availW, ctx);

    // tajam di layar HP (devicePixelRatio)
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(layout.w * dpr);
    canvas.height = Math.round(layout.h * dpr);
    canvas.style.width = layout.w + "px";
    canvas.style.height = layout.h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, layout.w, layout.h);

    drawHeader(ctx, layout.w, judul, mean, total, theme);

    if (tipe === "bar") drawBar(ctx, labels, values, colors, total, theme, layout);
    else if (tipe === "line") drawLine(ctx, labels, values, colors, total, theme, layout);
    else drawPie(ctx, labels, values, colors, total, theme, layout, tipe === "donut");

    // deskripsi untuk pembaca layar
    const nama = {bar: "Bar chart", line: "Line chart", pie: "Pie chart", donut: "Donut chart"}[tipe];
    canvas.setAttribute("aria-label", nama + " " + judul + ": " + labels.map((l, i) => l + " " + fmtNum(values[i])).join(", "));

    diagramDrawn = true;
    lastDiagramWidth = document.getElementById("chartContainer").clientWidth;
}

// Gambar ulang HANYA kalau lebar layar berubah (rotasi HP / ubah ukuran jendela).
// Keyboard HP yang muncul/hilang hanya mengubah tinggi, jadi diabaikan.
// Yang digambar ulang adalah data terakhir yang valid, bukan isi kolom yang sedang diketik.
window.addEventListener("resize", () => {
    if (!diagramDrawn || !lastDiagramSpec) return;
    clearTimeout(window.__diagramResize);
    window.__diagramResize = setTimeout(() => {
        const w = document.getElementById("chartContainer").clientWidth;
        if (w && w !== lastDiagramWidth) renderDiagram(lastDiagramSpec);        // w = 0 berarti panel sedang tersembunyi
    }, 200);
});

function isiContohDiagram() {
    document.getElementById("judulDiagram").value = "Penjualan Buah (kg)";
    document.getElementById("labelData").value = "Apel,Jeruk,Mangga,Pisang,Anggur,Melon";
    document.getElementById("nilaiData").value = "24,18,32,15,27,9";
    gambarDiagram();
}

function tampilStatusDiagram(teks, galat) {
    const el = document.getElementById("diagramStatus");
    if (!el) return;
    el.textContent = teks;
    el.style.color = galat ? "#e5484d" : "";
    clearTimeout(window.__diagramStatus);
    window.__diagramStatus = setTimeout(() => { el.textContent = ""; }, 3000);
}

async function salinGambar() {
    if (!diagramDrawn) {
        tampilStatusDiagram("Gambar diagram dulu sebelum disalin.", true);
        return;
    }
    const canvas = document.getElementById("canvasDiagram");
    if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
        tampilStatusDiagram("Browser ini belum mendukung salin gambar. Pakai Export PNG.", true);
        return;
    }
    try {
        const blob = await new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error("kosong")), "image/png"));
        await navigator.clipboard.write([new ClipboardItem({"image/png": blob})]);
        tampilStatusDiagram("Gambar disalin ke clipboard.");
    } catch (e) {
        tampilStatusDiagram("Gagal menyalin gambar. Pakai Export PNG.", true);
    }
}

function getColors(palet, n) {
    const palets = {
        catppuccin: ["#89b4fa", "#a6e3a1", "#f9e2af", "#f38ba8", "#cba6f7", "#74c7ec"],
        pastel: ["#FF6B6B", "#4ECDC4", "#FFE66D", "#95E1D3", "#A18CD1", "#FBC4AB"],
        neon: ["#00FF87", "#00D4FF", "#FF00FF", "#FFFF00", "#FF6B00", "#FF007F"],
        monokrom: ["#333333", "#555555", "#777777", "#999999", "#BBBBBB", "#DDDDDD"],

        // === PALET NYENTRIK BARU ===
        cyberpunk: ["#00f5ff", "#ff00ff", "#ff1493", "#00ff88", "#ffff00", "#ff4500"],
        toxico: ["#39ff14", "#7fff00", "#adff2f", "#32cd32", "#00fa9a", "#98fb98"],
        sunset: ["#ff3c41", "#ff7e67", "#ffb347", "#ffdb58", "#ff9966", "#ff5f6d"],
        galaxy: ["#8a2be2", "#4b0082", "#9400d3", "#ff1493", "#00bfff", "#1e90ff"],
        candy: ["#ff69b4", "#ff1493", "#ffc0cb", "#ff00ff", "#ffb6c1", "#ff91af"]
    };
    let arr = palets[palet] || palets.catppuccin;
    return Array.from({length: n}, (_, i) => arr[i % arr.length]);
}

// ---------- helper ----------
function fmtNum(v) {
    return Number.isInteger(v) ? String(v) : String(parseFloat(v.toFixed(2)));
}

function fitText(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
    return t + "…";
}

function hexToRgb(hex) {
    let h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map(c => c + c).join("");
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
}

function isLightColor(hex) {
    const [r, g, b] = hexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150;
}

function niceScale(max) {
    if (!(max > 0)) return {max: 1, step: 0.25};
    const exp = Math.pow(10, Math.floor(Math.log10(max)));
    const f = max / exp;
    const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    const niceMax = nf * exp;
    return {max: niceMax, step: niceMax / 4};
}

function fillRoundTop(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    if (h <= 0) return;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
}

function drawHeader(ctx, w, judul, mean, total, theme) {
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = theme.text;
    ctx.font = "bold 17px " + FONT;
    ctx.fillText(fitText(ctx, judul, w - 32), w / 2, 28);
    ctx.fillStyle = theme.soft;
    ctx.font = "12px " + FONT;
    ctx.fillText("Total: " + fmtNum(total) + "  |  Rata-rata: " + mean.toFixed(2), w / 2, 48);
}

// ---------- layout bar & line (sama) ----------
function layoutBar(labels, values, availW, ctx) {
    const n = labels.length;
    // lebar kolom sumbu Y menyesuaikan angka terpanjang (nilai besar tidak terpotong)
    const sc = niceScale(Math.max(...values, 0));
    ctx.font = "11px " + FONT;
    let tickW = 0;
    for (let i = 0; i <= 4; i++) tickW = Math.max(tickW, ctx.measureText(fmtNum(sc.step * i)).width);
    const padL = Math.max(46, Math.ceil(tickW) + 20), padR = 16;
    const slot = n > 40 ? 22 : n > 20 ? 30 : n > 10 ? 44 : 60;
    const innerW = n * slot;
    const w = Math.max(availW, padL + padR + innerW);
    // label dimiringkan kalau slot sempit atau teks panjang
    ctx.font = "12px " + FONT;
    const longest = Math.max(...labels.map(l => ctx.measureText(l).width));
    const rotate = slot < 50 || longest > slot - 8;
    const labelH = rotate ? Math.round(Math.min(90, Math.max(46, longest * 0.72 + 14))) : 28;
    const plotTop = 96;
    // tinggi ikut lebar: data banyak -> canvas melebar DAN meninggi, rasio tetap proporsional
    const plotH = Math.round(Math.max(170, Math.min(460, (w - padL - padR) * 0.5)));
    return {w, h: plotTop + plotH + labelH, padL, padR, slot, innerW, plotTop, plotH, rotate, n,
            offsetX: padL + Math.max(0, (w - padL - padR - innerW) / 2)};
}

// garis bantu + angka sumbu Y; mengembalikan skala dan garis dasar
function drawAxis(ctx, values, theme, L) {
    const sc = niceScale(Math.max(...values, 0));
    const baseY = L.plotTop + L.plotH;
    ctx.font = "11px " + FONT;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i++) {
        const v = sc.step * i;
        const y = baseY - (v / sc.max) * L.plotH;
        ctx.strokeStyle = i === 0 ? theme.soft : theme.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(L.padL - 6, y + 0.5);
        ctx.lineTo(L.w - L.padR, y + 0.5);
        ctx.stroke();
        ctx.fillStyle = theme.soft;
        ctx.fillText(fmtNum(v), L.padL - 10, y);
    }
    return {sc, baseY};
}

function drawCategoryLabel(ctx, text, cx, baseY, theme, L) {
    ctx.fillStyle = theme.text;
    ctx.font = (L.slot < 30 ? "10px " : "12px ") + FONT;
    if (L.rotate) {
        ctx.save();
        ctx.translate(cx + 3, baseY + 12);
        ctx.rotate(-Math.PI / 4);
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(fitText(ctx, text, 100), 0, 0);
        ctx.restore();
    } else {
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(fitText(ctx, text, L.slot - 6), cx, baseY + 18);
    }
}

// ---------- BAR ----------
function drawBar(ctx, labels, values, colors, total, theme, L) {
    const {sc, baseY} = drawAxis(ctx, values, theme, L);
    const barW = Math.min(L.slot * 0.64, 46);
    const showValue = L.slot >= 30;
    const showPercent = L.slot >= 54;

    values.forEach((v, i) => {
        const h = sc.max > 0 ? (Math.max(v, 0) / sc.max) * L.plotH : 0;
        const x = L.offsetX + i * L.slot + (L.slot - barW) / 2;
        const cx = x + barW / 2;

        ctx.fillStyle = colors[i];
        fillRoundTop(ctx, x, baseY - h, barW, h, 5);

        if (showValue) {
            ctx.textAlign = "center";
            ctx.textBaseline = "alphabetic";
            ctx.fillStyle = theme.text;
            ctx.font = "bold 11px " + FONT;
            ctx.fillText(fmtNum(v), cx, baseY - h - (showPercent ? 17 : 6));
            if (showPercent) {
                const persen = total > 0 ? (Math.max(v, 0) / total * 100).toFixed(1) : "0.0";
                ctx.fillStyle = theme.soft;
                ctx.font = "10px " + FONT;
                ctx.fillText(persen + "%", cx, baseY - h - 5);
            }
        }
        drawCategoryLabel(ctx, labels[i], cx, baseY, theme, L);
    });
}

// ---------- LINE ----------
function drawLine(ctx, labels, values, colors, total, theme, L) {
    const {sc, baseY} = drawAxis(ctx, values, theme, L);
    const pts = values.map((v, i) => ({
        x: L.offsetX + i * L.slot + L.slot / 2,
        y: baseY - (sc.max > 0 ? (Math.max(v, 0) / sc.max) * L.plotH : 0)
    }));
    const main = colors[0];
    const [r, g, b] = hexToRgb(main);

    // area di bawah garis
    const grad = ctx.createLinearGradient(0, L.plotTop, 0, baseY);
    grad.addColorStop(0, "rgba(" + r + "," + g + "," + b + ",0.35)");
    grad.addColorStop(1, "rgba(" + r + "," + g + "," + b + ",0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, baseY);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, baseY);
    ctx.closePath();
    ctx.fill();

    // garis
    ctx.strokeStyle = main;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();

    // titik + nilai
    const rad = L.slot >= 30 ? 4 : 2.5;
    const showValue = L.slot >= 30;
    pts.forEach((p, i) => {
        ctx.fillStyle = colors[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = theme.bg;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        if (showValue) {
            ctx.textAlign = "center";
            ctx.textBaseline = "alphabetic";
            ctx.fillStyle = theme.text;
            ctx.font = "bold 11px " + FONT;
            ctx.fillText(fmtNum(values[i]), p.x, p.y - 10);
        }
        drawCategoryLabel(ctx, labels[i], p.x, baseY, theme, L);
    });
}

// ---------- PIE & DONUT ----------
function layoutPie(labels, availW) {
    const w = availW;
    const r = Math.max(70, Math.min(110, (w - 40) / 2));
    const cols = Math.max(1, Math.floor((w - 24) / 170));
    const rows = Math.ceil(labels.length / cols);
    const cy = 66 + r + 6;
    const legendTop = cy + r + 24;
    return {w, h: legendTop + rows * 24 + 14, r, cols, rows, cy, legendTop};
}

function drawPie(ctx, labels, values, colors, total, theme, L, donut) {
    const cx = L.w / 2;
    const inner = donut ? L.r * 0.56 : 0;
    let start = -Math.PI / 2;

    values.forEach((v, i) => {
        const angle = total > 0 ? (Math.max(v, 0) / total) * Math.PI * 2 : 0;
        ctx.fillStyle = colors[i];
        ctx.beginPath();
        if (donut) {
            ctx.arc(cx, L.cy, L.r, start, start + angle);
            ctx.arc(cx, L.cy, inner, start + angle, start, true);
        } else {
            ctx.moveTo(cx, L.cy);
            ctx.arc(cx, L.cy, L.r, start, start + angle);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = theme.bg;
        ctx.lineWidth = 2;
        ctx.stroke();

        // persen di dalam irisan (hanya kalau cukup lebar)
        const pct = total > 0 ? v / total * 100 : 0;
        if (pct >= (donut ? 7 : 6)) {
            const mid = start + angle / 2;
            const rr = donut ? (L.r + inner) / 2 : L.r * 0.65;
            ctx.fillStyle = isLightColor(colors[i]) ? "#111" : "#fff";
            ctx.font = "bold 12px " + FONT;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(pct.toFixed(1) + "%", cx + Math.cos(mid) * rr, L.cy + Math.sin(mid) * rr);
        }
        start += angle;
    });

    // total di tengah donut
    if (donut) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = theme.soft;
        ctx.font = "12px " + FONT;
        ctx.fillText("Total", cx, L.cy - 12);
        ctx.fillStyle = theme.text;
        ctx.font = "bold 18px " + FONT;
        ctx.fillText(fitText(ctx, fmtNum(total), inner * 1.8), cx, L.cy + 9);
    }

    // legenda selalu di bawah, rapi per kolom
    const colW = (L.w - 24) / L.cols;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    labels.forEach((label, i) => {
        const row = Math.floor(i / L.cols);
        const col = i % L.cols;
        const x = 12 + col * colW;
        const y = L.legendTop + row * 24;
        const persen = total > 0 ? (values[i] / total * 100).toFixed(1) : "0.0";

        ctx.fillStyle = colors[i];
        ctx.fillRect(x, y - 6, 12, 12);
        ctx.fillStyle = theme.text;
        ctx.font = "12px " + FONT;
        ctx.fillText(fitText(ctx, label + ": " + fmtNum(values[i]) + " (" + persen + "%)", colW - 24), x + 18, y);
    });
}

// STATISTIK DASAR
// Ukuran sebaran data. Dua langkah (hitung rata-rata dulu, baru selisihnya) supaya tetap akurat untuk angka besar:
// mis. 1000000004, 1000000007, ... tidak kehilangan ketelitian seperti rumus "rata-rata kuadrat - kuadrat rata-rata".
function hitungSebaran(values) {
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    let ss = 0, min = values[0], max = values[0];
    for (const v of values) {
        const d = v - mean;
        ss += d * d;
        if (v < min) min = v;
        if (v > max) max = v;
    }
    const varPop = ss / n;
    const varSampel = n > 1 ? ss / (n - 1) : NaN;       // varians sampel butuh minimal 2 data
    return {
        n, mean, min, max, rentang: max - min, ss, varPop, varSampel,
        sdPop: Math.sqrt(varPop), sdSampel: n > 1 ? Math.sqrt(varSampel) : NaN
    };
}

// angka bersih untuk ditampilkan: 6 angka penting, tanpa nol di belakang
const fmtSebaran = x => (Number.isNaN(x) ? '—' : String(Number(x.toPrecision(6))));

function hitungStatistikDasar() {
    const dataInput = document.getElementById("dataDasar").value.trim();
    const labelInput = document.getElementById("labelDasar").value.trim();
    const hasil = document.getElementById("hasilStatistikDasar");

    if (!dataInput) {
        hasil.innerText = "Masukkan data!";
        hasil.classList.add("error");
        hasil.style.display = "block";
        return;
    }

    const mentah = dataInput.split(',').map(s => s.trim()).filter(s => s !== '');
    const diurai = mentah.map(s => parseNumber(s));
    const values = diurai.filter(x => !isNaN(x));
    const diabaikan = mentah.filter((s, i) => isNaN(diurai[i]));
    if (values.length === 0) {
        hasil.innerText = "Data tidak valid! Pakai angka dipisah koma, contoh: 1,2,3";
        hasil.classList.add("error");
        hasil.style.display = "block";
        return;
    }
    const labels = labelInput? labelInput.split(',').map(s => s.trim()) : [];
    const sorted = [...values].sort((a, b) => a - b);
    const total = values.reduce((a, b) => a + b, 0);
    const mean = total / values.length;
    const median = sorted.length % 2 === 0
  ? (sorted[sorted.length/2 - 1] + sorted[sorted.length/2]) / 2
      : sorted[Math.floor(sorted.length/2)];

    const freq = {};
    values.forEach(v => freq[v] = (freq[v] || 0) + 1);
    const maxFreq = Math.max(...Object.values(freq));
    const modus = Object.keys(freq).filter(k => freq[k] === maxFreq).join(", ");

    const sb = hitungSebaran(values);
    let langkah = `JALAN PENYELESAIAN STATISTIK DASAR:\n`;
    if (diabaikan.length > 0) {
        const contoh = diabaikan.slice(0, 5).join(", ") + (diabaikan.length > 5 ? ", …" : "");
        langkah += `⚠ ${diabaikan.length} isian diabaikan karena bukan angka: ${contoh}\n`;
    }
    langkah += `Data: ${values.join(", ")}\n`;
    langkah += `Total: ${total}\nMean: ${mean.toFixed(2)}\nMedian: ${median}\nModus: ${modus}\n`;
    langkah += `Jumlah data (n): ${sb.n}\nMin: ${fmtSebaran(sb.min)} | Maks: ${fmtSebaran(sb.max)} | Rentang: ${fmtSebaran(sb.rentang)}\n\n`;
    langkah += `SEBARAN DATA:\n`;
    langkah += `Σ(x − mean)² = ${fmtSebaran(sb.ss)}\n`;
    langkah += `Varians populasi (σ²) = ${fmtSebaran(sb.ss)} / ${sb.n} = ${fmtSebaran(sb.varPop)}\n`;
    langkah += sb.n > 1
        ? `Varians sampel (s²) = ${fmtSebaran(sb.ss)} / ${sb.n - 1} = ${fmtSebaran(sb.varSampel)}\n`
        : `Varians sampel (s²) = — (butuh minimal 2 data)\n`;
    langkah += `Simpangan baku populasi (σ) = ${fmtSebaran(sb.sdPop)}\n`;
    langkah += sb.n > 1
        ? `Simpangan baku sampel (s) = ${fmtSebaran(sb.sdSampel)}\n\n`
        : `Simpangan baku sampel (s) = — (butuh minimal 2 data)\n\n`;
    langkah += `PERSENTASE:\n`;
    values.forEach((v, i) => {
        let persen = total > 0? (v / total * 100).toFixed(1) : 0;
        let label = labels[i] || `Data ${i+1}`;
        langkah += `${label}: ${persen}%\n`;
    });

    hasil.style.display = "block";
    hasil.classList.remove("error");
    hasil.innerText = langkah;
}

// STATISTIK LANJUT
function persentil(sorted, p) {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];
    const pos = (p / 100) * (sorted.length - 1);
    const bawah = Math.floor(pos);
    const atas = Math.ceil(pos);
    const fraksi = pos - bawah;
    if (bawah === atas) return sorted[bawah];
    return sorted[bawah] + fraksi * (sorted[atas] - sorted[bawah]);
}

function hitungStatistikLanjut() {
    const dataInput = document.getElementById("dataStatistik").value.trim();
    const persentilInput = document.getElementById("persentilInput").value.trim();
    const hasil = document.getElementById("hasilStatistikLanjut");
    const langkahDiv = document.getElementById("langkahStatistik");

    if (!dataInput) {
        hasil.innerText = "Masukkan data!";
        hasil.classList.add("error");
        hasil.style.display = "block";
        langkahDiv.style.display = "none";
        return;
    }

    const values = dataInput.split(',').map(s => parseFloat(s.trim())).filter(x =>!isNaN(x));
    if (values.length === 0) {
        hasil.innerText = "Data tidak valid! Pakai angka dipisah koma, contoh: 1,2,3";
        hasil.classList.add("error");
        hasil.style.display = "block";
        langkahDiv.style.display = "none";
        return;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const q1 = persentil(sorted, 25);
    const q2 = persentil(sorted, 50);
    const q3 = persentil(sorted, 75);
    const iqr = q3 - q1;
    const batasBawah = q1 - 1.5 * iqr;
    const batasAtas = q3 + 1.5 * iqr;
    const outlier = sorted.filter(x => x < batasBawah || x > batasAtas);

    // satu baris per <br> (tanpa baris baru tambahan, supaya tidak muncul jarak ganda di kotak hasil)
    hasil.innerHTML = `<b>Hasil:</b><br>Q1: ${q1.toFixed(2)}<br>Q2/Median: ${q2.toFixed(2)}<br>Q3: ${q3.toFixed(2)}<br>` +
        `IQR: ${iqr.toFixed(2)}<br>Outlier: ${outlier.length > 0? outlier.join(", ") : "Tidak ada"}`;
    hasil.style.display = "block";
    hasil.classList.remove("error");

    let langkah = `<h4>📝 Langkah Penyelesaian:</h4>`;
    langkah += `<b>1. Data terurut:</b> ${sorted.join(", ")}<br><br>`;
    langkah += `<b>2. Q1, Q2, Q3:</b><br>`;
    langkah += `Posisi Q1 = 25% dari ${n-1} = ${(0.25*(n-1)).toFixed(2)} → Q1 = ${q1.toFixed(2)}<br>`;
    langkah += `Posisi Q2 = 50% dari ${n-1} = ${(0.5*(n-1)).toFixed(2)} → Q2 = ${q2.toFixed(2)}<br>`;
    langkah += `Posisi Q3 = 75% dari ${n-1} = ${(0.75*(n-1)).toFixed(2)} → Q3 = ${q3.toFixed(2)}<br><br>`;
    langkah += `<b>3. IQR = Q3 - Q1 = ${q3.toFixed(2)} - ${q1.toFixed(2)} = ${iqr.toFixed(2)}</b><br>`;
    langkah += `<b>4. Batas outlier:</b><br>`;
    langkah += `Bawah = Q1 - 1.5×IQR = ${batasBawah.toFixed(2)}<br>`;
    langkah += `Atas = Q3 + 1.5×IQR = ${batasAtas.toFixed(2)}<br>`;
    langkah += `Outlier: ${outlier.length > 0? outlier.join(", ") : "Tidak ada"}<br><br>`;

    if (persentilInput) {
        const persentilMau = persentilInput.split(',').map(s => parseFloat(s.trim())).filter(x =>!isNaN(x) && x >= 0 && x <= 100);
        langkah += `<b>5. Persentil Custom:</b><br>`;
        persentilMau.forEach(p => {
            const val = persentil(sorted, p);
            const pos = (p/100)*(n-1);
            langkah += `P${p}: posisi ${pos.toFixed(2)} → ${val.toFixed(2)}<br>`;
        });
    }

    langkahDiv.innerHTML = langkah;
    langkahDiv.style.display = "block";
}

// KALKULATOR
function hitung() {
    let angka1 = document.getElementById("angka1").value.trim();
    let angka2 = document.getElementById("angka2").value.trim();
    let operator = document.getElementById("operator").value;
    let hasil = document.getElementById("hasil");
    hasil.style.display = "block";
    hasil.classList.remove("error");

    if (!angka1) {
        hasil.innerText = "Masukkan angka pertama!";
        hasil.classList.add("error");
        return;
    }

    angka1 = parseNumber(angka1);
    angka2 = parseNumber(angka2);

    if (isNaN(angka1) || (operator!== "sqrt" && operator!== "lingkaran" && operator!== "kubus" && isNaN(angka2))) {
        hasil.innerText = "Input tidak valid!";
        hasil.classList.add("error");
        return;
    }

    let result, display;
    switch (operator) {
        case "+": result = rapikan(angka1 + angka2); display = `${angka1} + ${angka2} = ${result}`; break;
        case "-": result = rapikan(angka1 - angka2); display = `${angka1} - ${angka2} = ${result}`; break;
        case "*": result = rapikan(angka1 * angka2); display = `${angka1} × ${angka2} = ${result}`; break;
        case "/":
            if (angka2 === 0) { hasil.innerText = "Tidak bisa bagi 0!"; hasil.classList.add("error"); return; }
            result = rapikan(angka1 / angka2); display = `${angka1} ÷ ${angka2} = ${result}`; break;
        case "**": result = rapikan(Math.pow(angka1, angka2)); display = `${angka1}^${angka2} = ${result}`; break;
        case "sqrt":
            if (angka1 < 0) { hasil.innerText = "Tidak bisa akar bilangan negatif!"; hasil.classList.add("error"); return; }
            result = rapikan(Math.sqrt(angka1)); display = `√${angka1} = ${result}`; break;
        case "lingkaran":
            let luas = Math.PI * angka1 * angka1;
            let keliling = 2 * Math.PI * angka1;
            display = `Lingkaran r=${angka1}\nLuas: ${luas.toFixed(2)}\nKeliling: ${keliling.toFixed(2)}`;
            break;
        case "kubus":
            let volume = Math.pow(angka1, 3);
            let luasPermukaan = 6 * angka1 * angka1;
            display = `Kubus s=${angka1}\nVolume: ${volume}\nLuas Permukaan: ${luasPermukaan}`;
            break;
    }

    hasil.innerText = display;

    historyList = bacaDaftar('calcHistory');
    historyList.push(display);
    if (historyList.length > 50) historyList.shift();
    localStorage.setItem('calcHistory', JSON.stringify(historyList));
}

function tampilHistory() {
    let historyDiv = document.getElementById("history");
    historyDiv.style.display = "block";
    if (historyList.length === 0) {
        historyDiv.innerHTML = "<div>Tidak ada history</div>";
        return;
    }
    historyDiv.innerHTML = historyList.map(h => `<div class="list-item">${escapeHTML(h)}</div>`).join("");
}

function clearHistory() {
    historyList = [];
    localStorage.removeItem('calcHistory');
    document.getElementById("history").innerHTML = "<div>History dihapus</div>";
}

// TO-DO + CATATAN GABUNG
function addTask() {
  let input = document.getElementById('taskInput');
  if(!input) return;
  let text = input.value.trim();
  if(text!== "") {
    tasks.push({text: text, done: false});
    input.value = "";
    saveTasks();
    showTasks();
  }
}

function showTasks() {
  let list = document.getElementById('taskList');
  if(!list) return;
  list.innerHTML = tasks.map((task, i) => `
      <li class="${task.done? 'done' : ''}">
        <input type="checkbox" ${task.done? 'checked' : ''} onchange="toggleTask(${i})" aria-label="Tandai selesai">
        <span onclick="toggleTask(${i})">${escapeHTML(task.text)}</span>
        <button onclick="deleteTask(${i})" aria-label="Hapus tugas">✕</button>
      </li>`).join('');
  const info = document.getElementById('taskInfo');
  if(info) {
    const selesai = tasks.filter(t => t.done).length;
    info.textContent = tasks.length === 0 ? 'Belum ada tugas.' : `${tasks.length} tugas · ${selesai} selesai`;
  }
}

function toggleTask(i) {
  tasks[i].done =!tasks[i].done;
  saveTasks();
  showTasks();
}

function deleteTask(i) {
  tasks.splice(i, 1);
  saveTasks();
  showTasks();
}

function saveTasks() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

// CATATAN PANJANG
function loadNote() {
    const noteArea = document.getElementById('noteArea');
    if(noteArea) {
        noteArea.value = localStorage.getItem('note') || '';
        noteArea.oninput = () => {
            localStorage.setItem('note', noteArea.value);
            const st = document.getElementById('noteStatus');
            if (st) {
                st.textContent = 'tersimpan ✓';
                clearTimeout(st._t);
                st._t = setTimeout(() => { st.textContent = ''; }, 1400);
            }
        };
    }
}

function clearNote() {
    const noteArea = document.getElementById('noteArea');
    if(noteArea && confirm('Hapus semua catatan?')) {
        noteArea.value = '';
        localStorage.removeItem('note');
    }
}

// SUHU
function konversiSuhu() {
    let val = parseNumber(document.getElementById("suhuInput").value.trim());
    let from = document.getElementById("suhuFrom").value;
    let to = document.getElementById("suhuTo").value;
    let hasil = document.getElementById("hasilSuhu");
    hasil.style.display = "block";

    if (isNaN(val)) {
        hasil.innerText = "Masukkan suhu valid!";
        hasil.classList.add("error");
        return;
    }

    let celsius = from === "C"? val : from === "F"? (val - 32) * 5/9 : val - 273.15;
    let result = to === "C"? celsius : to === "F"? celsius * 9/5 + 32 : celsius + 273.15;
    hasil.innerText = `${val}°${from} = ${result.toFixed(2)}°${to}`;
    hasil.classList.remove("error");
}

// STOPWATCH
function updateStopwatchDisplay() {
    const ms = stopwatchTime % 1000;
    const totalSeconds = Math.floor(stopwatchTime / 1000);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    const mss = String(ms).padStart(3, '0');
    const display = document.getElementById('stopwatchDisplay');
    if(display) display.textContent = `${hh}:${mm}:${ss}.${mss}`;
}

function startStopwatch() {
    if (isRunning) return;
    isRunning = true;
    const startTime = Date.now() - stopwatchTime;
    stopwatchInterval = setInterval(() => {
        stopwatchTime = Date.now() - startTime;
        updateStopwatchDisplay();
    }, 10);
}

function pauseStopwatch() {
    isRunning = false;
    clearInterval(stopwatchInterval);
}

function resetStopwatch() {
    pauseStopwatch();
    stopwatchTime = 0;
    updateStopwatchDisplay();
    const lapList = document.getElementById('lapList');
    if(lapList) lapList.innerHTML = '';
}

function lapStopwatch() {
    if (!isRunning) return;
    const lapTime = document.getElementById('stopwatchDisplay').textContent;
    const lapItem = document.createElement('div');
    lapItem.className = 'list-item';
    lapItem.textContent = `Lap: ${lapTime}`;
    const lapList = document.getElementById('lapList');
    if(lapList) lapList.prepend(lapItem);
}

// ----- tombol pecahan: keyboard angka di HP tidak punya "/" maupun "½" -----
let kolomKalkulator = null;      // kolom kalkulator yang terakhir diketuk
document.addEventListener('focusin', e => {
    if (e.target && (e.target.id === 'angka1' || e.target.id === 'angka2')) kolomKalkulator = e.target;
});

// sisipkan karakter di posisi kursor kolom aktif (angka kedua tersembunyi pada akar/lingkaran/kubus -> angka pertama)
function sisipkanPecahan(ch) {
    let el = kolomKalkulator;
    let pindah = false;                                    // true = bukan kolom yang sedang diketik pengguna
    if (!el || el.offsetParent === null) { el = document.getElementById('angka1'); pindah = true; }
    el.focus();
    // kolom yang baru dipilih otomatis: tambahkan di akhir (posisi kursor lamanya tidak relevan)
    const mulai = pindah ? el.value.length : (typeof el.selectionStart === 'number' ? el.selectionStart : el.value.length);
    const akhir = pindah ? mulai : (typeof el.selectionEnd === 'number' ? el.selectionEnd : mulai);
    el.value = el.value.slice(0, mulai) + ch + el.value.slice(akhir);
    const pos = mulai + ch.length;
    try { el.setSelectionRange(pos, pos); } catch (e) { /* abaikan */ }
    el.dispatchEvent(new Event('input', { bubbles: true }));
}


// ----- perbarui aplikasi: bersihkan semua cache lalu muat ulang dengan berkas terbaru -----
// Dipakai kalau berkas sudah diganti di server tetapi browser masih menampilkan versi lama.
async function perbaruiAplikasi() {
    const tombol = document.getElementById('perbaruiApp');
    if (tombol) { tombol.disabled = true; tombol.textContent = 'Memperbarui…'; }
    try {
        if ('serviceWorker' in navigator) {
            const daftarSw = await navigator.serviceWorker.getRegistrations();
            await Promise.all(daftarSw.map(r => r.unregister()));
        }
        if (window.caches) {
            const nama = await caches.keys();
            await Promise.all(nama.map(n => caches.delete(n)));
        }
        // segarkan juga cache HTTP browser: berkas dari daftar di sw.js + yang dirujuk halaman ini (termasuk ?v=)
        let daftar = ['index.html', 'style.css', 'script.js', 'pwa.js', 'manifest.webmanifest'];
        try {
            const teks = await (await fetch('sw.js', { cache: 'reload' })).text();
            const m = teks.match(/const ASSETS = \[([\s\S]*?)\];/);
            if (m) daftar = (m[1].match(/'([^']+)'/g) || []).map(x => x.slice(1, -1)).filter(x => x !== './');
        } catch (e) { /* pakai daftar bawaan */ }
        document.querySelectorAll('link[rel="stylesheet"][href], script[src]').forEach(el => daftar.push(el.getAttribute('href') || el.getAttribute('src')));
        await Promise.all(daftar.map(u => fetch(u, { cache: 'reload' }).catch(() => {})));
    } catch (e) { /* tetap lanjut memuat ulang */ }
    location.reload();
}

function tukarSuhu() {
    const a = document.getElementById("suhuFrom"), b = document.getElementById("suhuTo");
    const t = a.value; a.value = b.value; b.value = t;
    if (document.getElementById("suhuInput").value.trim()) konversiSuhu();
}

function tukarUang() {
    const a = document.getElementById("uangFrom"), b = document.getElementById("uangTo");
    const t = a.value; a.value = b.value; b.value = t;
    if (document.getElementById("uangInput").value.trim()) konversiUang();
}

// UANG
function konversiUang() {
    const rates = { IDR: 1, USD: 0.00005543, EUR: 0.000057, JPY: 0.0091, SGD: 0.000083 };
    let val = parseNumber(document.getElementById("uangInput").value.trim());
    let from = document.getElementById("uangFrom").value;
    let to = document.getElementById("uangTo").value;
    let hasil = document.getElementById("hasilUang");
    hasil.style.display = "block";

    if (isNaN(val)) {
        hasil.innerText = "Masukkan jumlah valid!";
        hasil.classList.add("error");
        return;
    }

    let inIDR = val / rates[from];
    let result = inIDR * rates[to];
    hasil.innerText = `${val} ${from} = ${result.toFixed(1)} ${to}`;
    hasil.classList.remove("error");
}

// EXPORT
function exportPNG() {
    const canvas = document.getElementById("canvasDiagram");
    const link = document.createElement("a");
    link.download = "diagram.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
}

function exportJPG() {
    const canvas = document.getElementById("canvasDiagram");
    const link = document.createElement("a");
    link.download = "diagram.jpg";
    link.href = canvas.toDataURL("image/jpeg", 0.9);
    link.click();
}

// THEME
function toggleTheme() {
    const body = document.body;
    const btn = document.getElementById('themeBtn');
    if (body.hasAttribute('data-theme')) {
        body.removeAttribute('data-theme');
        btn.innerText = '🌙 Dark Mode';
        localStorage.setItem('theme', 'light');
    } else {
        body.setAttribute('data-theme', 'dark');
        btn.innerText = '☀️ Light Mode';
        localStorage.setItem('theme', 'dark');
    }
}

// SEARCH
function doSearch() {
    const query = document.getElementById("searchInput").value.trim().toLowerCase();
    const resultsDiv = document.getElementById("searchResults");

    if (!query) {
        resultsDiv.style.display = "none";
        return;
    }

    let results = [];
    const note = localStorage.getItem('note') || "";
    const calcHistory = bacaDaftar('calcHistory');

    if (note.toLowerCase().includes(query)) {
        results.push(`📝 <b>Catatan:</b>\n${highlightText(note, query)}`);
    }

    tasks.forEach((t, i) => {
        if (t.text.toLowerCase().includes(query)) {
            results.push(`✅ <b>To-Do ${i+1}:</b> ${highlightText(t.text, query)} ${t.done? '[Selesai]' : ''}`);
        }
    });

    calcHistory.forEach((h, i) => {
        if (h.toLowerCase().includes(query)) {
            results.push(`🧮 <b>History ${i+1}:</b> ${highlightText(h, query)}`);
        }
    });

    if (results.length === 0) {
        resultsDiv.innerHTML = `Gak ketemu hasil untuk "<b>${escapeHTML(query)}</b>"`;
    } else {
        resultsDiv.innerHTML = `<b>Ditemukan ${results.length} hasil:</b>\n\n` + results.join("\n\n");
    }
    resultsDiv.style.display = "block";
}

function escapeHTML(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function highlightText(text, query) {
    const safe = escapeHTML(text);
    const q = escapeHTML(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return safe.replace(new RegExp(`(${q})`, "gi"), "<mark>$1</mark>");
}