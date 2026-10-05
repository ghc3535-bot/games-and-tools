let historyList = JSON.parse(localStorage.getItem('calcHistory')) || [];
// Stopwatch variables
let stopwatchInterval = null;
let stopwatchTime = 0;
let isRunning = false;

// TO-DO + CATATAN GABUNG - hapus 'todos' lama biar gak bentrok
let tasks = JSON.parse(localStorage.getItem('tasks')) || [];

document.addEventListener("DOMContentLoaded", () => {
    // THEME
    const savedTheme = localStorage.getItem('theme');
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

    showTasks();
    loadNote();
    updateStopwatchDisplay();
});

function switchTab(tabName, event) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    if(event) event.target.classList.add('active');

    // Refresh pas buka tab gabungan
    if(tabName === 'catatanTodo') {
        showTasks();
        loadNote();
    }
}

function toggleAngka2() {
    const op = document.getElementById("operator").value;
    const angka2 = document.getElementById("angka2");
    if (op === "sqrt" || op === "lingkaran" || op === "kubus") {
        angka2.style.display = "none";
        angka2.value = "";
    } else {
        angka2.style.display = "block";
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

function parseNumber(val) {
    if (!val) return NaN;
    val = val.trim();
    if (val.includes(' ')) {
        const parts = val.split(/\s+/);
        const whole = parseFloat(parts[0]);
        const frac = parts[1] in unicodeFractions ? unicodeFractions[parts[1]] : parseFraction(parts[1]);
        return whole + frac;
    }
    if (val.includes('/')) return parseFraction(val);
    if (unicodeFractions[val] !== undefined) return unicodeFractions[val];
    return parseFloat(val.replace(',', '.'));
}

// buang noise floating point (0.1+0.2 -> 0.3)
function rapikan(n) {
    return Number.isFinite(n) ? parseFloat(n.toPrecision(12)) : n;
}

function parseFraction(frac) {
    const parts = frac.split('/');
    if (parts.length!== 2) return NaN;
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    if (isNaN(num) || isNaN(den) || den === 0) return NaN;
    return num / den;
}

// DIAGRAM
function gambarDiagram() {
    const labels = document.getElementById("labelData").value
 .split(',')
 .map(s => s.trim())
 .filter(s => s!== "");
    const values = document.getElementById("nilaiData").value
 .split(',')
 .map(s => parseFloat(s.trim()))
 .filter(x =>!isNaN(x));

    if (values.length === 0) {
        alert("Isi label dan nilai dulu!");
        return;
    }
    if (labels.length!== values.length) {
        alert("Jumlah label dan nilai harus sama!");
        return;
    }

    const canvas = document.getElementById("canvasDiagram");
    const ctx = canvas.getContext("2d");
    const tipe = document.getElementById("tipeDiagram").value;

    const isMany = labels.length > 20;
    const barWidth = isMany? 18 : 35;
    const gap = isMany? 12 : 25;
    const startX = 50;
    const minWidth = 400;
    const neededWidth = startX + labels.length * (barWidth + gap) + 50;
    canvas.width = neededWidth > minWidth? neededWidth : minWidth;

    let neededHeight = 220;
    if (tipe === "pie" && labels.length > 12) {
        const itemsPerRow = Math.max(1, Math.floor(canvas.width / 120));
        const rows = Math.ceil(labels.length / itemsPerRow);
        neededHeight = 220 + rows * 18 + 20;
    } else if (tipe === "bar") {
        neededHeight = 220;
    }
    canvas.height = neededHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const bg = document.getElementById("bgDiagram").value;
    ctx.fillStyle = bg === "gelap"? "#1e1e2e" : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const colors = getColors(document.getElementById("paletWarna").value, values.length);
    const judul = document.getElementById("judulDiagram").value || "Diagram";
    const total = values.reduce((a, b) => a + b, 0);
    const mean = total / values.length;

    if (tipe === "bar")
        drawBar(ctx, labels, values, colors, judul, bg, total, mean, barWidth, gap, startX);
    else
        drawPie(ctx, labels, values, colors, judul, bg, total, mean);
}

function getColors(palet, n) {
    const palets = {
        catppuccin: ["#89b4fa", "#a6e3a1", "#f9e2af", "#f38ba8", "#cba6f7", "#74c7ec"],
        pastel: ["#FF6B6B", "#4ECDC4", "#FFE66D", "#95E1D3", "#A18CD1", "#FBC4AB"],
        neon: ["#00FF87", "#00D4FF", "#FF00FF", "#FFFF00", "#FF6B00", "#FF007F"],
        monokrom: ["#333", "#555", "#777", "#999", "#BBB", "#DDD"],

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

function drawBar(ctx, labels, values, colors, judul, bg, total, mean, barWidth, gap, startX) {
    const max = Math.max(...values);
    const startY = 180;
    const centerX = ctx.canvas.width / 2;
    const textColor = bg === "terang"? "#1e1e2e" : "#cdd6f4";

    ctx.fillStyle = textColor;
    ctx.font = "14px Times New Roman";
    ctx.textAlign = "center";
    ctx.fillText(judul, centerX, 20);
    ctx.font = "12px Times New Roman";
    ctx.fillText(`Rata-rata: ${mean.toFixed(2)}`, centerX, 35);

    values.forEach((v, i) => {
        const h = max > 0? (v / max) * 130 : 0;
        const persen = total > 0? (v / total * 100).toFixed(1) : 0;
        const x = startX + i * (barWidth + gap);

        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(x, startY - h, barWidth, h);

        ctx.fillStyle = textColor;
        ctx.font = labels.length > 20? "9px Times New Roman" : "11px Times New Roman";
        ctx.fillText(labels[i], x + barWidth/2, startY + 15);

        if (labels.length <= 25) {
            ctx.font = "11px Times New Roman";
            ctx.fillText(v, x + barWidth/2, startY - h - 15);
            ctx.font = "10px Times New Roman";
            ctx.fillText(`${persen}%`, x + barWidth/2, startY - h - 5);
        }
    });
}

function drawPie(ctx, labels, values, colors, judul, bg, total, mean) {
    let startAngle = 0;
    const centerX = ctx.canvas.width / 2;
    const centerY = 130;
    const radius = 70;
    const textColor = bg === "terang"? "#1e1e2e" : "#cdd6f4";
    const showLabelsOnPie = labels.length <= 12;

    ctx.fillStyle = textColor;
    ctx.font = "14px Times New Roman";
    ctx.textAlign = "center";
    ctx.fillText(judul, centerX, 20);
    ctx.font = "12px Times New Roman";
    ctx.fillText(`Rata-rata: ${mean.toFixed(2)}`, centerX, 35);

    values.forEach((v, i) => {
        const angle = total > 0? (v / total) * Math.PI * 2 : 0;
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + angle);
        ctx.closePath();
        ctx.fill();
        startAngle += angle;
    });

    if (showLabelsOnPie) {
        startAngle = 0;
        ctx.font = "11px Times New Roman";
        values.forEach((v, i) => {
            const angle = total > 0? (v / total) * Math.PI * 2 : 0;
            const midAngle = startAngle + angle / 2;
            const persen = total > 0? (v / total * 100).toFixed(1) : 0;
            const x = centerX + Math.cos(midAngle) * 95;
            const y = centerY + Math.sin(midAngle) * 95;
            ctx.fillStyle = textColor;
            ctx.fillText(`${labels[i]}: ${persen}%`, x, y);
            startAngle += angle;
        });
    } else {
        drawPieLegend(ctx, labels, values, colors, total, bg);
    }
}

function drawPieLegend(ctx, labels, values, colors, total, bg) {
    const textColor = bg === "terang"? "#1e1e2e" : "#cdd6f4";
    const startY = 220;
    const itemsPerRow = Math.max(1, Math.floor(ctx.canvas.width / 120));
    const itemWidth = ctx.canvas.width / itemsPerRow;

    ctx.font = "11px Times New Roman";
    ctx.textAlign = "left";

    labels.forEach((label, i) => {
        const persen = total > 0? (values[i] / total * 100).toFixed(1) : 0;
        const row = Math.floor(i / itemsPerRow);
        const col = i % itemsPerRow;
        const x = 20 + col * itemWidth;
        const y = startY + row * 18;

        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(x, y - 8, 12, 12);
        ctx.fillStyle = textColor;
        const shortLabel = label.length > 15? label.substring(0, 12) + "..." : label;
        ctx.fillText(`${shortLabel}: ${persen}%`, x + 18, y);
    });
}

// STATISTIK DASAR
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

    const values = dataInput.split(',').map(s => parseNumber(s.trim())).filter(x =>!isNaN(x));
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

    let langkah = `JALAN PENYELESAIAN STATISTIK DASAR:\n`;
    langkah += `Data: ${values.join(", ")}\n`;
    langkah += `Total: ${total}\nMean: ${mean.toFixed(2)}\nMedian: ${median}\nModus: ${modus}\n\n`;
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

    hasil.innerHTML = `
        <b>Hasil:</b><br>
        Q1: ${q1.toFixed(2)}<br>
        Q2/Median: ${q2.toFixed(2)}<br>
        Q3: ${q3.toFixed(2)}<br>
        IQR: ${iqr.toFixed(2)}<br>
        Outlier: ${outlier.length > 0? outlier.join(", ") : "Tidak ada"}
    `;
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

    historyList = JSON.parse(localStorage.getItem('calcHistory')) || [];
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
  list.innerHTML = "";
  tasks.forEach((task, i) => {
    list.innerHTML += `
      <li class="${task.done? 'done' : ''}">
        <input type="checkbox" ${task.done? 'checked' : ''} onchange="toggleTask(${i})">
        <span onclick="toggleTask(${i})">${escapeHTML(task.text)}</span>
        <button onclick="deleteTask(${i})">x</button>
      </li>
    `;
  });
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
    const calcHistory = JSON.parse(localStorage.getItem('calcHistory')) || [];

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