// ==========================================================================
// ADVANCED TOOLS — logika halaman
// Urutan: 1 Pembantu  2 Tema  3 Navigasi  4 Cari  5 Gambar  6 Game  7 Hadist  8 Tools lama
// Tool baru ada di advanced-tools.js
// ==========================================================================

// ===== 1. PEMBANTU =====
const $ = id => document.getElementById(id);

// catat kegagalan saat memuat advanced-tools.js (file tidak ada / error saat dibaca)
// supaya bisa ditampilkan ke pengguna. Dari file:// browser menyembunyikan detail error, jadi semua error saat muat dicatat.
window.__toolsError = null;      // diisi atribut onerror pada <script> kalau file tidak bisa dibuka
window.__loadErrors = [];
window.__moduleError = {};      // file tambahan yang gagal dibuka: { 'advanced-qr.js': 'penyebab' }
window.addEventListener('error', e => { if (e.message) window.__loadErrors.push(e.message); });

let _audio = null;
function getAudio() {
    try {
        if (!_audio) _audio = new (window.AudioContext || window.webkitAudioContext)();
        if (_audio.state === 'suspended') _audio.resume();
    } catch (e) { return null; }
    return _audio;
}

// salin ke clipboard (dengan cadangan untuk browser lama); tombol sementara berubah jadi "Tersalin ✓"
async function copyText(text, btn) {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; }
    catch (e) {
        try {
            const ta = document.createElement('textarea');
            ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
            document.body.appendChild(ta); ta.select();
            ok = document.execCommand('copy'); ta.remove();
        } catch (e2) { ok = false; }
    }
    if (btn) {
        if (btn.dataset.old === undefined) btn.dataset.old = btn.textContent;
        btn.textContent = ok ? 'Tersalin ✓' : 'Gagal menyalin';
        clearTimeout(btn._t);
        btn._t = setTimeout(() => { btn.textContent = btn.dataset.old; }, 1400);
    }
    return ok;
}
document.addEventListener('click', e => {
    const b = e.target.closest('[data-copy]');
    if (b) copyText(b.dataset.copy, b);
});

// ===== 2. TEMA (kunci 'theme' dipakai bersama halaman lain) =====
function applyTheme(dark) {
    if (dark) document.body.setAttribute('data-theme', 'dark');
    else document.body.removeAttribute('data-theme');
    const btn = $('themeBtn');
    if (btn) btn.innerText = dark ? '☀️ Light Mode' : '🌙 Dark Mode';
}
function toggleTheme() {
    const dark = !document.body.hasAttribute('data-theme');
    applyTheme(dark);
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) {}
}

// ===== 3. NAVIGASI =====
function switchTab(tab, e) {
    const el = $('tab-' + tab);
    if (!el) return;
    document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(x => x.classList.toggle('active', x.dataset.tab === tab));
    el.classList.add('active');
    if (tab === 'hadist') filterHadist();
    try { localStorage.setItem('adv_tab', tab); } catch (err) {}
}

// daftar tool tidak bisa ditampilkan: beri tahu penyebab & langkah perbaikan (bukan layar kosong)
function tampilGalatTools() {
    const galat = window.__loadErrors.length ? window.__loadErrors[window.__loadErrors.length - 1] : '';
    const sebab = window.__toolsError || (galat ? 'file termuat tetapi error: ' + galat : 'file belum termuat');
    $('toolFilter').classList.add('hidden');
    $('toolEmpty').classList.add('hidden');
    $('toolGrid').innerHTML =
        `<div class="galat-box"><b>⚠️ Daftar tool gagal dimuat</b>` +
        `<p>Penyebab: <code>${escapeHTML(String(sebab))}</code></p>` +
        `<ol><li>Pastikan file <code>advanced-tools.js</code> ada di folder yang sama dengan <code>advanced.html</code>.</li>` +
        `<li>Muat ulang tanpa cache (tahan tombol refresh, atau hapus cache browser).</li></ol>` +
        `<button class="btn-accent" onclick="location.reload()">Muat ulang</button></div>`;
}

function renderToolGrid() {
    if (typeof TOOLS === 'undefined') { tampilGalatTools(); return; }
    $('toolGrid').innerHTML = TOOLS.map(t =>
        `<button class="tool-card" data-id="${t.id}" onclick="openTool('${t.id}')">` +
        `<span class="ico">${t.icon}</span><span class="nama">${t.nama}</span><span class="desk">${t.desk}</span></button>`
    ).join('');
}

function filterTools() {
    const kartu = document.querySelectorAll('.tool-card');
    if (!kartu.length) return;              // daftar belum ada: jangan tampilkan "tidak ditemukan"
    const q = $('toolFilter').value.trim().toLowerCase();
    let n = 0;
    kartu.forEach(c => {
        const t = TOOLS.find(x => x.id === c.dataset.id);
        const hit = !q || (t.nama + ' ' + t.desk + ' ' + t.kata).toLowerCase().includes(q);
        c.classList.toggle('hidden', !hit);
        if (hit) n++;
    });
    $('toolEmpty').classList.toggle('hidden', n > 0);
}

// tool yang butuh file tambahan (mis. QR Code → advanced-qr.js): kalau file-nya tidak ada, jelaskan di panelnya
function tampilGalatPanel(id, file) {
    const panel = $('tool-' + id);
    panel.querySelectorAll(':scope > .galat-box').forEach(x => x.remove());
    Array.from(panel.children).forEach(el => el.classList.add('hidden'));
    const sebab = window.__moduleError && window.__moduleError[file] ? window.__moduleError[file] : 'file tidak ditemukan atau belum termuat';
    const box = document.createElement('div');
    box.className = 'galat-box';
    box.innerHTML = `<b>⚠️ Tool ini belum bisa dipakai</b><p>Penyebab: <code>${escapeHTML(String(sebab))}</code></p>` +
        `<ol><li>Pastikan file <code>${escapeHTML(file)}</code> ada di folder yang sama dengan <code>advanced.html</code>.</li>` +
        `<li>Muat ulang tanpa cache.</li></ol><button class="btn-accent" onclick="location.reload()">Muat ulang</button>`;
    panel.appendChild(box);
}

function openTool(id) {
    if (typeof TOOLS === 'undefined') return;
    const t = TOOLS.find(x => x.id === id);
    if (!t) return;
    $('toolHome').classList.add('hidden');
    $('toolView').classList.remove('hidden');
    document.querySelectorAll('.tool-panel').forEach(p => p.classList.toggle('hidden', p.id !== 'tool-' + id));
    $('toolTitle').innerHTML = `<span class="t-ico">${t.icon}</span> ${t.nama}`;   // ikon di luar efek gradasi supaya tetap berwarna
    if (t.butuh && typeof window[t.butuh] !== 'function') {
        tampilGalatPanel(id, t.file);
        try { history.replaceState(null, '', '#' + id); } catch (e) {}
        window.scrollTo({ top: 0 });
        return;
    }
    try { history.replaceState(null, '', '#' + id); } catch (e) {}
    if (typeof TOOL_OPEN !== 'undefined' && typeof TOOL_OPEN[id] === 'function') TOOL_OPEN[id]();
    window.scrollTo({ top: 0 });
}

function closeTool() {
    $('toolView').classList.add('hidden');
    $('toolHome').classList.remove('hidden');
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
}

// pilih mode di dalam satu tool: tombol segmen + panel "<awalan>-<mode>"
function segPilih(prefix, mode, btn) {
    const seg = btn.closest('.seg');
    seg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b === btn));
    seg.parentElement.querySelectorAll('.seg-pane').forEach(p => p.classList.toggle('hidden', p.id !== prefix + '-' + mode));
}

document.addEventListener('DOMContentLoaded', () => {
    let saved = null, tab = null;
    try { saved = localStorage.getItem('theme'); tab = localStorage.getItem('adv_tab'); } catch (e) {}
    applyTheme(saved === 'dark');
    renderToolGrid();
    // judul mengikuti jumlah data yang benar-benar ada (bukan angka tetap)
    $('hadistInfo').textContent = `${hadistData.hadist.length} hadist · ${hadistData.dalil.length} dalil`;
    $('hadistTabBtn').textContent = `Hadist (${hadistData.hadist.length})`;
    $('dalilTabBtn').textContent = `Dalil Al-Quran (${hadistData.dalil.length})`;
    if (tab && $('tab-' + tab)) switchTab(tab);
    const id = location.hash.slice(1);                    // contoh: advanced.html#sandi
    if (typeof TOOLS !== 'undefined' && TOOLS.some(t => t.id === id)) { switchTab('tools'); openTool(id); }
});

// ===== 4. CARI =====
function doSearch() {
    const query = document.getElementById("searchInput").value.trim().toLowerCase();
    const resultsDiv = document.getElementById("searchResults");

    if (!query) {
        resultsDiv.style.display = "none";
        return;
    }

    let results = [];

    const note = localStorage.getItem('note') || "";
    const todos = JSON.parse(localStorage.getItem('tasks')) || [];
    const historyList = JSON.parse(localStorage.getItem('calcHistory')) || [];

    // 1. Cari di Catatan
    if (note.toLowerCase().includes(query)) {
        results.push(`📝 <b>Catatan:</b>\n${highlightText(note, query)}`);
    }

    // 2. Cari di To-Do
    todos.forEach((t, i) => {
        if (t.text.toLowerCase().includes(query)) {
            results.push(`✅ <b>To-Do ${i+1}:</b> ${highlightText(t.text, query)} ${t.done? '[Selesai]' : ''}`);
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

// ===== 5. GAMBAR =====
function generateImage() {
  const prompt = document.getElementById("imagePrompt").value.trim();
  const resultDiv = document.getElementById("imageResult");

  if (!prompt) {
    alert("Masukin prompt dulu!");
    return;
  }

  const petunjuk = { square: "", landscape: ", landscape 16:9 composition", vertical: ", vertical 9:16 composition" };
  const finalPrompt = prompt + (petunjuk[document.getElementById("imageOrientation").value] || "");

  resultDiv.innerHTML = `
    <p>Pilih situs untuk dibuka:</p>
    <div class="two">
      <button id="btnPixAI" class="btn-accent">Buka PixAI</button>
      <button id="btnCraiyon" class="btn-accent">Buka Craiyon</button>
    </div>
  `;
  document.getElementById("btnPixAI").addEventListener("click", () => openPixAI(finalPrompt));
  document.getElementById("btnCraiyon").addEventListener("click", () => openCraiyon(finalPrompt));
}

async function openPixAI(prompt) {
  try {
    await navigator.clipboard.writeText(prompt);
    const tab = window.open('https://pixai.art/', '_blank');

    setTimeout(() => {
      if (!tab || tab.closed || typeof tab.closed == 'undefined') {
        openCraiyon(prompt);
      }
    }, 800);

    alert("Prompt udah ke-copy! Tinggal paste di PixAI");
  } catch (err) {
    openCraiyon(prompt);
  }
}

function openCraiyon(prompt) {
  const url = `https://www.craiyon.com/?prompt=${encodeURIComponent(prompt)}`;
  window.open(url, '_blank');
}

// ===== TIC TAC TOE =====
// ===== 6. GAME: CATUR BULAN =====
let tttBoard = ["", "", "", "", "", "", "", "", ""];
let tttCurrentPlayer = "X";
let tttGameActive = false;
let tttMoves = { X: [], O: [] };

let tttTimer = null;
let tttTimeLeft = { X: 5, O: 5 };
const TTT_TIME_LIMIT = 5;

// Audio beep (AudioContext dibuat saat pertama dipakai, bukan saat halaman dibuka)
function playBeep() {
    const ac = getAudio();
    if (!ac) return;
    const oscillator = ac.createOscillator();
    const gainNode = ac.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ac.destination);
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(800, ac.currentTime);
    gainNode.gain.setValueAtTime(0.2, ac.currentTime);
    oscillator.start();
    oscillator.stop(ac.currentTime + 0.1);
}

function startGame() {
    getAudio();

    document.getElementById("ttt-setup").style.display = "none";
    document.getElementById("ttt-game").style.display = "block";

    tttCurrentPlayer = Math.random() < 0.5? "X" : "O";
    tttGameActive = true;
    tttBoard = ["", "", "", "", "", "", "", "", ""];
    tttMoves = { X: [], O: [] };
    tttTimeLeft = { X: TTT_TIME_LIMIT, O: TTT_TIME_LIMIT };

    document.querySelectorAll(".ttt-cell").forEach(cell => {
        cell.textContent = "";
        cell.disabled = false;
        cell.style.color = "";
    });

    document.getElementById("ttt-status").textContent = `Giliran: ${tttCurrentPlayer}`;
    document.getElementById("ttt-playagain-btn").style.display = "none";
    updateTimerUI();
    startTimer();
}

function resetTTT() {
    clearInterval(tttTimer);
    document.getElementById("ttt-setup").style.display = "block";
    document.getElementById("ttt-game").style.display = "none";

    tttBoard = ["", "", "", "", "", "", "", "", ""];
    tttGameActive = false;
    tttMoves = { X: [], O: [] };
    tttTimeLeft = { X: TTT_TIME_LIMIT, O: TTT_TIME_LIMIT };
}

function playAgain() {
    clearInterval(tttTimer);

    tttCurrentPlayer = Math.random() < 0.5? "X" : "O";
    tttGameActive = true;
    tttBoard = ["", "", "", "", "", "", "", "", ""];
    tttMoves = { X: [], O: [] };
    tttTimeLeft = { X: TTT_TIME_LIMIT, O: TTT_TIME_LIMIT };

    document.querySelectorAll(".ttt-cell").forEach(cell => {
        cell.textContent = "";
        cell.disabled = false;
        cell.style.color = "";
    });

    document.getElementById("ttt-status").textContent = `Giliran: ${tttCurrentPlayer}`;
    document.getElementById("ttt-playagain-btn").style.display = "none";

    updateTimerUI();
    startTimer();
}

function startTimer() {
    clearInterval(tttTimer);
    tttTimeLeft[tttCurrentPlayer] = TTT_TIME_LIMIT;
    updateTimerUI();

    document.getElementById("timerX").parentElement.classList.remove("active");
    document.getElementById("timerO").parentElement.classList.remove("active");
    document.getElementById(`timer${tttCurrentPlayer}`).parentElement.classList.add("active");

    tttTimer = setInterval(() => {
        tttTimeLeft[tttCurrentPlayer]--;
        updateTimerUI();

        if (tttTimeLeft[tttCurrentPlayer] <= 3 && tttTimeLeft[tttCurrentPlayer] > 0) {
            playBeep();
            document.getElementById(`timer${tttCurrentPlayer}`).style.color = "red";
            setTimeout(() => {
                document.getElementById(`timer${tttCurrentPlayer}`).style.color = "";
            }, 200);
        }

        if (tttTimeLeft[tttCurrentPlayer] <= 0) {
            clearInterval(tttTimer);
            tttCurrentPlayer = tttCurrentPlayer === "X"? "O" : "X";
            document.getElementById("ttt-status").textContent = `Giliran: ${tttCurrentPlayer} - Time Up!`;
            startTimer();
        }
    }, 1000);
}

function updateTimerUI() {
    document.getElementById("timerX").textContent = tttTimeLeft.X;
    document.getElementById("timerO").textContent = tttTimeLeft.O;
}

function handleTTTClick(e) {
    const cell = e.target.closest(".ttt-cell");
    if (!cell) return;

    const index = parseInt(cell.dataset.index);
    if (isNaN(index) || tttBoard[index]!== "" ||!tttGameActive) return;

    clearInterval(tttTimer);

    if (tttMoves[tttCurrentPlayer].length >= 3) {
        const oldIndex = tttMoves[tttCurrentPlayer].shift();
        tttBoard[oldIndex] = "";
        const oldCell = document.querySelector(`.ttt-cell[data-index="${oldIndex}"]`);
        oldCell.textContent = "";
        oldCell.disabled = false;
    }

    tttBoard[index] = tttCurrentPlayer;
    tttMoves[tttCurrentPlayer].push(index);
    cell.textContent = tttCurrentPlayer;
    cell.style.color = tttCurrentPlayer === "X"? "#0066cc" : "#e74c3c"; // X biru, O merah
    cell.disabled = true;

    if (checkTTTWin()) {
        document.getElementById("ttt-status").textContent = `Menang: ${tttCurrentPlayer}! 🎉`;
        tttGameActive = false;
        clearInterval(tttTimer);
        return;
    }

    if (tttBoard.every(cell => cell!== "")) {
        document.getElementById("ttt-status").textContent = "Seri!";
        tttGameActive = false;
        clearInterval(tttTimer);
        document.getElementById("ttt-playagain-btn").style.display = "inline-block";
        return;
    }

    tttCurrentPlayer = tttCurrentPlayer === "X"? "O" : "X";
    document.getElementById("ttt-status").textContent = `Giliran: ${tttCurrentPlayer}`;
    startTimer();
}

function checkTTTWin() {
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

    const isWin = winPatterns.some(pattern => {
        return pattern.every(index => tttBoard[index] === tttCurrentPlayer && tttBoard[index]!== "");
    });

    if (isWin) {
        document.getElementById("ttt-playagain-btn").style.display = "inline-block";
    }

    return isWin;
}

// Event listener
document.addEventListener("DOMContentLoaded", () => {
    const boardEl = document.getElementById("ttt-board");
    if (boardEl) {
        boardEl.addEventListener("click", handleTTTClick);
    }

    const startBtn = document.getElementById("ttt-start-btn");
    if (startBtn) {
        startBtn.addEventListener("click", startGame);
    }

    const playAgainBtn = document.getElementById("ttt-playagain-btn");
    if (playAgainBtn) {
        playAgainBtn.addEventListener("click", playAgain);
    }
});
// ===== 7. HADIST & DALIL =====
let currentHadistTab = 'hadist';

const hadistData = {
  hadist: [
    {arab: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ", terjemah: "Sesungguhnya amal itu tergantung niatnya.", sumber: "HR. Bukhari & Muslim"},
    {arab: "الْمُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ", terjemah: "Seorang muslim adalah orang yang kaum muslimin selamat dari lisan dan tangannya.", sumber: "HR. Bukhari & Muslim"},
    {arab: "مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ", terjemah: "Barangsiapa beriman kepada Allah dan hari akhir, hendaklah ia berkata baik atau diam.", sumber: "HR. Bukhari & Muslim"},
    {arab: "لاَ يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ", terjemah: "Tidak beriman salah seorang di antara kalian sampai ia mencintai saudaranya sebagaimana ia mencintai dirinya sendiri.", sumber: "HR. Bukhari & Muslim"},
    {arab: "اتَّقِ اللَّهَ حَيْثُمَا كُنْتَ", terjemah: "Bertakwalah kepada Allah di mana saja kamu berada.", sumber: "HR. Tirmidzi"},
    {kategori: "Percintaan", arab: "يَا مَعْشَرَ الشَّبَابِ مَنِ اسْتَطَاعَ مِنْكُمُ الْبَاءَةَ فَلْيَتَزَوَّجْ فَإِنَّهُ أَغَضُّ لِلْبَصَرِ وَأَحْصَنُ لِلْفَرْجِ وَمَنْ لَمْ يَسْتَطِعْ فَعَلَيْهِ بِالصَّوْمِ فَإِنَّهُ لَهُ وِجَاءٌ", terjemah: "Wahai para pemuda, siapa di antara kalian yang mampu menikah, hendaklah ia menikah, karena menikah lebih menundukkan pandangan dan lebih menjaga kemaluan. Siapa yang belum mampu, hendaklah berpuasa, karena puasa adalah perisai baginya.", perawi: "Abdullah bin Mas'ud (sahabat); mukharrij: Al-Bukhari & Muslim", sanad: "Al-Bukhari ← Umar bin Hafsh bin Ghiyats ← Hafsh bin Ghiyats (ayahnya) ← Sulaiman al-A'masy ← Umarah bin Umair ← Abdurrahman bin Yazid ← Abdullah bin Mas'ud ← Nabi ﷺ", sumber: "HR. Bukhari no. 5066, Muslim no. 1400"},
    {kategori: "Percintaan", arab: "تُنْكَحُ الْمَرْأَةُ لأَرْبَعٍ لِمَالِهَا وَلِحَسَبِهَا وَلِجَمَالِهَا وَلِدِينِهَا فَاظْفَرْ بِذَاتِ الدِّينِ تَرِبَتْ يَدَاكَ", terjemah: "Wanita dinikahi karena empat hal: hartanya, keturunannya, kecantikannya, dan agamanya. Pilihlah yang taat beragama, niscaya engkau beruntung.", perawi: "Abu Hurairah (sahabat); mukharrij: Al-Bukhari & Muslim", sanad: "Al-Bukhari ← Musaddad ← Yahya bin Sa'id al-Qaththan ← Ubaidullah bin Umar ← Sa'id bin Abi Sa'id al-Maqburi ← Abu Sa'id (ayahnya) ← Abu Hurairah ← Nabi ﷺ", sumber: "HR. Bukhari no. 5090, Muslim no. 1466"},
    {kategori: "Percintaan", arab: "خَيْرُكُمْ خَيْرُكُمْ لأَهْلِهِ وَأَنَا خَيْرُكُمْ لأَهْلِي", terjemah: "Sebaik-baik kalian adalah yang terbaik terhadap keluarganya, dan aku adalah yang terbaik di antara kalian terhadap keluargaku.", perawi: "Aisyah radhiyallahu 'anha; mukharrij: At-Tirmidzi, Ibnu Majah (shahih)", sanad: "At-Tirmidzi ← … ← Aisyah ← Nabi ﷺ", sumber: "HR. Tirmidzi no. 3895, Ibnu Majah no. 1977"},
    {kategori: "Percintaan", arab: "لاَ يَفْرَكْ مُؤْمِنٌ مُؤْمِنَةً إِنْ كَرِهَ مِنْهَا خُلُقًا رَضِيَ مِنْهَا آخَرَ", terjemah: "Janganlah seorang mukmin membenci mukminah (istrinya). Jika ia tidak menyukai satu akhlaknya, ia akan ridha dengan akhlaknya yang lain.", perawi: "Abu Hurairah (sahabat); mukharrij: Muslim", sanad: "Muslim ← … ← Abu Hurairah ← Nabi ﷺ", sumber: "HR. Muslim no. 1469"},
    {kategori: "Percintaan", arab: "لَمْ نَرَ لِلْمُتَحَابَّيْنِ مِثْلَ النِّكَاحِ", terjemah: "Tidak ada yang lebih baik bagi dua orang yang saling mencintai selain pernikahan.", perawi: "Abdullah bin Abbas (sahabat); mukharrij: Ibnu Majah (shahih)", sanad: "Ibnu Majah ← … ← Abdullah bin Abbas ← Nabi ﷺ", sumber: "HR. Ibnu Majah no. 1847"},
    {kategori: "Percintaan", arab: "الْمَرْءُ مَعَ مَنْ أَحَبَّ", terjemah: "Seseorang akan bersama orang yang dicintainya.", perawi: "Anas bin Malik (sahabat); mukharrij: Al-Bukhari & Muslim", sanad: "Al-Bukhari ← … ← Anas bin Malik ← Nabi ﷺ", sumber: "HR. Bukhari no. 6171, Muslim no. 2640"},
    {kategori: "Keteguhan", arab: "قُلْ آمَنْتُ بِاللَّهِ ثُمَّ اسْتَقِمْ", terjemah: "Katakanlah: aku beriman kepada Allah, kemudian istiqamahlah.", perawi: "Sufyan bin Abdullah ats-Tsaqafi (sahabat); mukharrij: Muslim", sanad: "Muslim ← … ← Sufyan bin Abdullah ats-Tsaqafi ← Nabi ﷺ", sumber: "HR. Muslim no. 38"},
    {kategori: "Keteguhan", arab: "وَمَنْ يَتَصَبَّرْ يُصَبِّرْهُ اللَّهُ وَمَا أُعْطِيَ أَحَدٌ عَطَاءً خَيْرًا وَأَوْسَعَ مِنَ الصَّبْرِ", terjemah: "Siapa yang berusaha bersabar, Allah akan menjadikannya sabar. Tidak ada seorang pun yang diberi anugerah yang lebih baik dan lebih luas daripada kesabaran.", perawi: "Abu Sa'id al-Khudri (sahabat); mukharrij: Al-Bukhari & Muslim", sanad: "Al-Bukhari ← Abdullah bin Yusuf ← Malik bin Anas ← Ibnu Syihab az-Zuhri ← Atha' bin Yazid al-Laitsi ← Abu Sa'id al-Khudri ← Nabi ﷺ", sumber: "HR. Bukhari no. 1469, Muslim no. 1053"},
    {kategori: "Keteguhan", arab: "عَجَبًا لأَمْرِ الْمُؤْمِنِ إِنَّ أَمْرَهُ كُلَّهُ خَيْرٌ وَلَيْسَ ذَاكَ لأَحَدٍ إِلاَّ لِلْمُؤْمِنِ إِنْ أَصَابَتْهُ سَرَّاءُ شَكَرَ فَكَانَ خَيْرًا لَهُ وَإِنْ أَصَابَتْهُ ضَرَّاءُ صَبَرَ فَكَانَ خَيْرًا لَهُ", terjemah: "Sungguh menakjubkan urusan seorang mukmin; semua urusannya baik baginya, dan itu tidak dimiliki siapa pun selain mukmin. Jika mendapat kesenangan ia bersyukur, maka itu baik baginya; jika ditimpa kesulitan ia bersabar, maka itu pun baik baginya.", perawi: "Shuhaib ar-Rumi (sahabat); mukharrij: Muslim", sanad: "Muslim ← Hadbah bin Khalid ← Sulaiman bin al-Mughirah ← Tsabit al-Bunani ← Abdurrahman bin Abi Laila ← Shuhaib ar-Rumi ← Nabi ﷺ", sumber: "HR. Muslim no. 2999"},
    {kategori: "Keteguhan", arab: "الْمُؤْمِنُ الْقَوِيُّ خَيْرٌ وَأَحَبُّ إِلَى اللَّهِ مِنَ الْمُؤْمِنِ الضَّعِيفِ وَفِي كُلٍّ خَيْرٌ احْرِصْ عَلَى مَا يَنْفَعُكَ وَاسْتَعِنْ بِاللَّهِ وَلاَ تَعْجَزْ", terjemah: "Mukmin yang kuat lebih baik dan lebih dicintai Allah daripada mukmin yang lemah, dan pada masing-masing ada kebaikan. Bersungguh-sungguhlah pada hal yang bermanfaat bagimu, mintalah pertolongan Allah, dan jangan lemah.", perawi: "Abu Hurairah (sahabat); mukharrij: Muslim", sanad: "Muslim ← … ← Abu Hurairah ← Nabi ﷺ", sumber: "HR. Muslim no. 2664"}
  ],
  dalil: [
    {arab: "يٰٓاَيُّهَا الَّذِيْنَ اٰمَنُوْا قُوْٓا اَنْفُسَكُمْ وَاَهْلِيْكُمْ نَارًا وَّقُوْدُهَا النَّاسُ وَالْحِجَارَةُ عَلَيْهَا مَلٰۤىِٕكَةٌ غِلَاظٌ شِدَادٌ لَّا يَعْصُوْنَ اللّٰهَ مَآ اَمَرَهُمْ وَيَفْعَلُوْنَ مَا يُؤْمَرُوْنَ", terjemah: "Wahai orang-orang yang beriman, jagalah dirimu dan keluargamu dari api neraka yang bahan bakarnya adalah manusia dan batu. Penjaganya adalah malaikat-malaikat yang kasar dan keras. Mereka tidak durhaka kepada Allah terhadap apa yang Dia perintahkan kepadanya dan selalu mengerjakan apa yang diperintahkan", sumber: "QS. At-Tahrim: 6"},
    {arab: "إِنَّ اللَّهَ مَعَ الصَّابِرِينَ", terjemah: "Sesungguhnya Allah bersama orang-orang yang sabar.", sumber: "QS. Al-Baqarah: 153"},
    {arab: "وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا", terjemah: "Barangsiapa bertakwa kepada Allah, niscaya Dia akan mengadakan baginya jalan keluar.", sumber: "QS. At-Talaq: 2"},
    {arab: "وَقُل رَّبِّ زِدْنِي عِلْمًا", terjemah: "Dan katakanlah: Ya Tuhanku, tambahkanlah kepadaku ilmu.", sumber: "QS. Thaha: 114"},
    {arab: "إِنَّ مَعَ الْعُسْرِ يُسْرًا", terjemah: "Sesungguhnya sesudah kesulitan itu ada kemudahan.", sumber: "QS. Al-Insyirah: 6"},
    {arab: "وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَى", terjemah: "Dan tolong-menolonglah kamu dalam kebajikan dan takwa.", sumber: "QS. Al-Maidah: 2"}
  ]
};

function renderHadist(data) {
  const listEl = document.getElementById('hadistList');
  if (!listEl) return;

  if (data.length === 0) {
    listEl.innerHTML = '<p class="empty">Hadist/dalil tidak ditemukan</p>';
    return;
  }

  listEl.innerHTML = data.map(item => `
      <div class="hadist-item">
        ${item.kategori ? `<span class="hadist-kategori">${item.kategori}</span>` : ''}
        <div class="hadist-arab">${item.arab}</div>
        <div class="hadist-terjemah">${item.terjemah}</div>
        ${item.perawi ? `<div class="hadist-detail"><b>Perawi:</b> ${item.perawi}</div>` : ''}
        ${item.sanad ? `<div class="hadist-detail"><b>Sanad:</b> ${item.sanad}</div>` : ''}
        <div class="hadist-sumber">${item.sumber}</div>
      </div>`).join('');
}

function filterHadist() {
  const keyword = document.getElementById('hadistSearch').value.toLowerCase();
  const data = hadistData[currentHadistTab];
  const filtered = data.filter(h =>
    h.terjemah.toLowerCase().includes(keyword) ||
    h.arab.includes(keyword) ||
    h.sumber.toLowerCase().includes(keyword) ||
    (h.kategori || '').toLowerCase().includes(keyword) ||
    (h.perawi || '').toLowerCase().includes(keyword) ||
    (h.sanad || '').toLowerCase().includes(keyword)
  );
  renderHadist(filtered);
}

function switchHadistTab(tab, e) {
    currentHadistTab = tab;
    document.querySelectorAll('.hadist-tab-btn').forEach(el => el.classList.remove('active'));
    if (e && e.target) e.target.closest('button').classList.add('active');
    document.getElementById('hadistSearch').value = '';
    renderHadist(hadistData[tab]);
}

// ===== 8. TOOLS LAMA (konverter, persen, massa -> liter) =====
function formatAngka(n) {
    if (n === 0) return "0";
    const abs = Math.abs(n);
    if (abs >= 1e-4 && abs < 1e12) return String(parseFloat(n.toPrecision(10)));
    return n.toExponential(4);
}

// pesan di kotak hasil; `live` = dihitung otomatis saat mengetik (kolom kosong = sembunyikan, bukan error)
function tampilHasil(id, html, isErr) {
    const box = $(id);
    box.classList.add('show');
    box.style.display = 'block';
    box.innerHTML = isErr ? `<span class="err">${html}</span>` : html;
}
function sembunyiHasil(id) {
    const box = $(id);
    box.classList.remove('show');
    box.style.display = 'none';
}

function hitungKonversi(live) {
    const raw = $('valConv').value;
    const val = parseFloat(raw);
    const from = $('fromUnit').value;
    const to = $('toUnit').value;

    if (isNaN(val)) {
        if (live === true && raw === '') { sembunyiHasil('hasilConv'); return; }
        tampilHasil('hasilConv', 'Masukkan angka yang valid!', true);
        return;
    }

    const satuan = {
        massa: {g: 1, kg: 1000, mg: 0.001},
        volume: {ml: 1, l: 1000},
        panjang: {cm: 1, m: 100, inch: 2.54, mm: 0.1}
    };
    const jenis = Object.keys(satuan).find(k => from in satuan[k] && to in satuan[k]);
    if (!jenis) { tampilHasil('hasilConv', 'Satuan tidak cocok (beda jenis, mis. massa ke panjang)', true); return; }

    const hasil = val * satuan[jenis][from] / satuan[jenis][to];
    tampilHasil('hasilConv', `${val} ${from} = <b>${formatAngka(hasil)} ${to}</b>`);
}

function tukarSatuan() {
    const a = $('fromUnit'), b = $('toUnit');
    const t = a.value; a.value = b.value; b.value = t;
    hitungKonversi(true);
}

function hitungPersen(live) {
    const hargaRaw = $('valPersen').value, diskonRaw = $('persen').value;
    const harga = parseFloat(hargaRaw);
    const diskon = parseFloat(diskonRaw);
    if (isNaN(harga) || isNaN(diskon)) {
        if (live === true) { sembunyiHasil('hasilPersen'); return; }
        tampilHasil('hasilPersen', 'Isi harga awal dan diskon dengan angka!', true);
        return;
    }
    const potongan = harga * diskon / 100;
    const total = harga - potongan;
    tampilHasil('hasilPersen', `Diskon ${diskon}% = Rp ${potongan.toLocaleString('id-ID')}<br>Total bayar: <b>Rp ${total.toLocaleString('id-ID')}</b>`);
}

function kgKeLiter(live) {
    const raw = $('kgInput').value;
    const kg = parseFloat(raw);
    const densitas = parseFloat($('bahan').value);
    if (isNaN(kg)) {
        if (live === true && raw === '') { sembunyiHasil('hasilKgLiter'); return; }
        tampilHasil('hasilKgLiter', 'Masukkan berat dalam angka!', true);
        return;
    }
    const liter = kg / densitas;
    const hasilText = liter % 1 === 0 ? liter.toFixed(0) : liter.toFixed(4);
    tampilHasil('hasilKgLiter', `${kg} kg = <b>${hasilText} liter</b><br><small>Densitas: ${densitas} kg/L</small>`);
}
