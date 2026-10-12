/* ==========================================================================
   SERVICE WORKER — membuat Multi Tool bisa dipakai tanpa internet.

   Strategi "jaringan dulu, cache cadangan":
   - Online (atau server lokal hidup): selalu ambil file TERBARU, lalu simpan salinannya.
   - Offline / server mati / jaringan lambat (> 4 detik): pakai salinan yang tersimpan.
   Jadi kalau kamu mengganti file, versi barunya langsung tampil; tidak ada versi lama yang "nyangkut".

   Daftar ASSETS di bawah diunduh sekali saat pertama kali dibuka (butuh internet/server aktif),
   supaya semua halaman siap dipakai offline. Kalau kamu menambah file baru, tambahkan juga ke daftar ini.
   ========================================================================== */
const VERSI = 'multitool-v1';
const BATAS_TUNGGU_MS = 4000;

const ASSETS = [
    './', 'index.html', 'style.css', 'script.js',
    'advanced.html', 'advanced.css', 'advanced.js', 'advanced-tools.js', 'advanced-qr.js',
    'catur.html', 'catur.css', 'catur.js', 'catur-engine.js',
    'pwa.js', 'manifest.webmanifest',
    'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-48.png'
];

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(VERSI);
        // satu file gagal (mis. belum ada) tidak boleh menggagalkan seluruh pemasangan
        await Promise.all(ASSETS.map(url => cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const nama = await caches.keys();
        await Promise.all(nama.filter(n => n !== VERSI).map(n => caches.delete(n)));   // buang cache versi lama
        await self.clients.claim();
    })());
});

// simpan salinan BARU dulu, baru hapus varian lama dengan nama sama tapi ?v= berbeda
// (urutan ini penting: tidak boleh ada saat di mana tidak ada salinan sama sekali)
async function simpan(cache, req, res) {
    const url = new URL(req.url);
    await cache.put(req, res);
    const keys = await cache.keys();
    await Promise.all(keys.filter(k => {
        const u = new URL(k.url);
        return u.pathname === url.pathname && u.search !== url.search;
    }).map(k => cache.delete(k)));
}

// Setelah satu permintaan terbukti lambat, permintaan berikutnya langsung memakai cache
// (kalau tidak, tiap file menunggu 4 detik sendiri-sendiri dan halaman baru muncul setelah ~8 detik).
let anggapLambatSampai = 0;
const DURASI_ANGGAP_LAMBAT_MS = 30000;

async function jaringanDulu(event) {
    const req = event.request;
    const cache = await caches.open(VERSI);
    const jaringan = fetch(req).then(res => {
        if (res && res.ok && res.type === 'basic') event.waitUntil(simpan(cache, req, res.clone()));
        return res;
    });
    jaringan.catch(() => {});                       // cegah error "unhandled" saat dipakai sebagai cadangan
    if (Date.now() < anggapLambatSampai) {          // jaringan baru saja terbukti lambat: pakai cache sekarang, perbarui di latar belakang
        const cepat = await cache.match(req, { ignoreSearch: true });
        if (cepat) { event.waitUntil(jaringan.catch(() => {})); return cepat; }
    }
    try {
        return await Promise.race([
            jaringan,
            new Promise((_, tolak) => setTimeout(() => { anggapLambatSampai = Date.now() + DURASI_ANGGAP_LAMBAT_MS; tolak(new Error('lambat')); }, BATAS_TUNGGU_MS))
        ]);
    } catch (e) {
        const salinan = await cache.match(req, { ignoreSearch: true });
        if (salinan) return salinan;
        if (req.mode === 'navigate') {
            const beranda = await cache.match('index.html');
            if (beranda) return beranda;
        }
        return jaringan.catch(() => Response.error());   // tidak ada cadangan: tunggu hasil jaringan apa adanya
    }
}

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;   // font Google dsb. tidak dicegat
    event.respondWith(jaringanDulu(event));
});
