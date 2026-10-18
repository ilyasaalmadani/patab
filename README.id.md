# PATAB — Bahasa Indonesia

**Papan tab yang tenang, lokal, dan milik Anda.**

PATAB adalah dashboard untuk tab baru: jam besar, pencarian cepat, shortcut, folder,
catatan, daftar tugas, timer fokus, dan cuaca dalam satu halaman. Tidak ada akun, tidak
ada server, dan tidak ada analytics.

[English README](README.md) · [Demo langsung](https://ilyasaalmadani.github.io/patab/)

<p align="center">
  <img src="docs/screenshots/dashboard-dark.png" alt="Dashboard PATAB" width="100%" />
</p>

## Kenapa PATAB

Tab baru seharusnya membantu, bukan mengganggu. PATAB memberi satu tempat yang tenang
untuk hal-hal yang benar-benar Anda buka setiap hari — tanpa onboarding panjang, tanpa
login, dan tanpa data yang dikirim ke mana-mana.

Seluruh aplikasi ditulis dengan HTML, CSS, dan JavaScript biasa. Tidak ada framework,
tidak ada proses build, dan tidak ada dependensi saat runtime. Anda bisa membaca
seluruh kodenya, memodifikasinya, dan meng-host sendiri.

## Fitur

- Jam, tanggal, sapaan, dan cuaca opsional.
- Pencarian fuzzy ke semua board dan folder, plus bang seperti `!g`, `!gh`, `!yt`,
  `!w`, `!npm`, dan `!maps`.
- Command palette dengan `⌘K` / `Ctrl K`.
- Board terpisah untuk konteks berbeda (Daily, Workshop, Research, dan lainnya).
- Folder untuk mengelompokkan link.
- Drag and drop tile, atau `Alt + ←/→` lewat keyboard.
- Scratchpad yang tersimpan otomatis.
- Daftar tugas dengan progress bar.
- Timer fokus 25, 50, atau 15 menit.
- Tema gelap, terang, atau mengikuti sistem; lima warna aksen; tiga gaya latar.
- Ekspor dan impor backup JSON.
- PWA yang bisa dipasang dan bekerja offline.
- Responsif di ponsel, tablet, dan desktop.
- Aksesibel: navigasi keyboard, focus ring, label ARIA, dan reduced motion.

## Menjalankan secara lokal

Butuh Node.js 20 atau lebih baru untuk server lokalnya.

```bash
git clone https://github.com/ilyasaalmadani/patab.git
cd patab
npm run dev
```

Buka <http://localhost:4173>. Tidak perlu `npm install` untuk menjalankan aplikasi.

Server statis lain juga bisa:

```bash
python3 -m http.server 4173
```

## Menjadikan tab baru

Buka URL demo atau hasil host Anda, lalu jadikan halaman homepage/startup di browser.
Untuk mengganti tab baru sepenuhnya, gunakan ekstensi pengalih seperti "New Tab
Redirect" dan arahkan ke `https://ilyasaalmadani.github.io/patab/`. Di Chrome/Edge,
PATAB juga bisa dipasang sebagai PWA dari address bar.

## Pintasan keyboard

| Aksi | Pintasan |
| --- | --- |
| Buka command palette | `⌘K` / `Ctrl K` |
| Fokus ke pencarian | `/` |
| Tambah link | `N` |
| Bantuan pintasan | `?` |
| Tutup dialog/pencarian | `Esc` |
| Geser tile yang fokus | `Alt` + `←` / `→` |
| Buka tile yang fokus | `Enter` |

## Privasi

- Semua data disimpan di `localStorage` browser dengan key `patab:state:v1`.
- Tidak ada backend, akun, atau analytics.
- Ikon situs memakai `google.com/s2/favicons` dan bisa dimatikan di Settings.
- Cuaca memakai Open-Meteo dan baru aktif setelah Anda mengizinkannya.
- Ekspor backup kapan saja dari Settings atau panel Local-first.

Detail lengkap ada di [PRIVACY.md](PRIVACY.md).

## Struktur proyek

```text
index.html              shell aplikasi
assets/core.js          model state, validasi, pencarian (bisa diuji tanpa DOM)
assets/app.js           render, event, dialog, drag and drop, PWA
assets/app.css          design system dan layout responsif
sw.js                   cache app shell untuk offline
tests/core.test.mjs     unit test state layer
scripts/                dev server, check, screenshot, smoke test
```

## Testing

```bash
npm test
npm run check
```

Smoke test UI opsional (butuh Google Chrome dan `npm install`):

```bash
npm run test:e2e
```

Lighthouse 12.8.2 (mobile, Chrome headless): **98 Performance, 100 Accessibility,
100 Best Practices, 100 SEO**. Skor bisa berbeda tergantung perangkat dan jaringan.

## Lisensi

[MIT](LICENSE) © 2026 Ilyas Akbar Almadani.

Jika PATAB membuat browser Anda sedikit lebih tenang, bintang di GitHub sangat
membantu orang lain menemukannya.
