/* ==========================================================================
   PWA — pendaftaran service worker, tombol pasang, penanda offline, dan pemberitahuan versi baru.
   Dipakai bersama oleh index.html, advanced.html, dan catur.html.
   Semua bagian bersifat opsional: kalau file ini tidak ada atau browser tidak mendukung, halaman tetap normal.
   ========================================================================== */
(function () {
    'use strict';

    // ---- gaya kecil untuk penanda & toast (nilai warna tetap supaya cocok di semua halaman/tema) ----
    const css = document.createElement('style');
    css.textContent =
        '.pwa-pil{position:fixed;top:10px;left:0;right:0;margin:0 auto;width:max-content;white-space:nowrap;z-index:9999;padding:7px 16px;border-radius:999px;' +
        'background:rgba(30,30,46,.94);color:#fff;font:600 13px "Times New Roman",serif;box-shadow:0 4px 14px rgba(0,0,0,.35);pointer-events:none}' +
        '.pwa-toast{position:fixed;left:0;right:0;bottom:16px;margin:0 auto;width:max-content;z-index:9999;display:flex;align-items:center;gap:12px;' +
        'max-width:calc(100% - 24px);padding:10px 12px 10px 16px;border-radius:14px;background:rgba(30,30,46,.96);color:#fff;' +
        'font:600 14px "Times New Roman",serif;box-shadow:0 6px 20px rgba(0,0,0,.4)}' +
        '.pwa-toast button{border:none;border-radius:10px;padding:8px 14px;background:linear-gradient(135deg,#b57aff,#ff8ac7);color:#fff;' +
        'font:700 14px "Times New Roman",serif;cursor:pointer}' +
        '.pwa-toast .x{background:transparent;padding:6px 8px;opacity:.7}';
    document.head.appendChild(css);

    // ---- toast ----
    let toastEl = null;
    function toast(teks, aksiTeks, aksi) {
        if (toastEl) toastEl.remove();
        toastEl = document.createElement('div');
        toastEl.className = 'pwa-toast';
        toastEl.setAttribute('role', 'status');
        const t = document.createElement('span'); t.textContent = teks; toastEl.appendChild(t);
        if (aksiTeks) {
            const b = document.createElement('button'); b.textContent = aksiTeks;
            b.addEventListener('click', () => { aksi(); if (toastEl) toastEl.remove(); });
            toastEl.appendChild(b);
        }
        const x = document.createElement('button'); x.className = 'x'; x.textContent = '✕'; x.setAttribute('aria-label', 'Tutup');
        x.addEventListener('click', () => toastEl.remove()); toastEl.appendChild(x);
        document.body.appendChild(toastEl);
        if (!aksiTeks) setTimeout(() => { if (toastEl) toastEl.remove(); }, 3500);
    }

    // ---- penanda offline ----
    let pil = null;
    function perbaruiOffline() {
        const offline = !navigator.onLine;
        if (offline && !pil) { pil = document.createElement('div'); pil.className = 'pwa-pil'; pil.textContent = '📴 Mode offline'; document.body.appendChild(pil); }
        if (!offline && pil) { pil.remove(); pil = null; }
    }
    window.addEventListener('online', perbaruiOffline);
    window.addEventListener('offline', perbaruiOffline);
    perbaruiOffline();

    // ---- warna bilah browser mengikuti tema terang/gelap ----
    function sinkronTema() {
        const dark = document.body.hasAttribute('data-theme');
        let m = document.querySelector('meta[name="theme-color"]');
        if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
        m.content = dark ? '#1a1a2e' : '#b57aff';
    }
    new MutationObserver(sinkronTema).observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    sinkronTema();

    // ---- service worker ----
    if ('serviceWorker' in navigator && window.isSecureContext) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
                reg.addEventListener('updatefound', () => {
                    const baru = reg.installing;
                    if (!baru) return;
                    baru.addEventListener('statechange', () => {
                        // sudah ada versi lama yang mengendalikan halaman = ini pembaruan, bukan pemasangan pertama
                        if (baru.state === 'installed' && navigator.serviceWorker.controller)
                            toast('Versi baru tersedia.', 'Muat ulang', () => location.reload());
                    });
                });
            }).catch(() => { /* tidak didukung di sini (mis. dibuka lewat file://): abaikan */ });
        });
    }

    // ---- tombol "Pasang di layar utama" (hanya ada di index.html) ----
    const kotak = document.getElementById('pasangApp');
    if (!kotak) return;
    const tombol = document.getElementById('pasangTombol'), nanti = document.getElementById('pasangNanti'), ket = document.getElementById('pasangKet');
    const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    const ditunda = () => { try { return Number(localStorage.getItem('pwa_tunda')) > Date.now(); } catch (e) { return false; } };
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    let tawaran = null;

    function tampil(mode) {
        if (standalone() || ditunda()) return;
        kotak.dataset.mode = mode;
        if (mode === 'ios') {
            ket.textContent = 'Di Safari: ketuk tombol Bagikan, lalu pilih "Tambah ke Layar Utama".';
            tombol.classList.add('hidden');
        } else {
            tombol.classList.remove('hidden');
        }
        kotak.classList.remove('hidden');
    }
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); tawaran = e; tampil('prompt'); });
    window.addEventListener('appinstalled', () => { kotak.classList.add('hidden'); tawaran = null; toast('Aplikasi terpasang 🎉'); });
    tombol.addEventListener('click', async () => {
        if (!tawaran) return;
        tawaran.prompt();
        try { await tawaran.userChoice; } catch (e) {}
        tawaran = null; kotak.classList.add('hidden');
    });
    nanti.addEventListener('click', () => {
        kotak.classList.add('hidden');
        try { localStorage.setItem('pwa_tunda', String(Date.now() + 7 * 24 * 3600 * 1000)); } catch (e) {}   // jangan tawarkan lagi 7 hari
    });
    if (ios && !standalone()) tampil('ios');
})();
