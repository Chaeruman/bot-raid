# Rencana: rekomendasi kegiatan harian per karakter

Fitur besar (belum dibangun) — command/data terpisah dari `/lz` (Lucky Zone
sudah jalan sendiri, lihat `app/data/luckyZone.js` + `/lz`). Dokumen ini
dibaca ulang tiap kali lanjut kerjain fitur ini, biar konteksnya nggak hilang.

## Masalah yang mau diselesaikan

Reset mingguan tiap Sabtu 08:00 WIB. Sabtu–Senin biasanya fokus `/raid` penuh
(daily dungeon dikit). Harapannya: daily dungeon bisa di-skip kalau perlu,
lanjutin weekly dungeon dulu biar nggak numpuk mendekati reset. Rekomendasi
personal — bergantung job & gear tiap karakter, dan orang bisa punya 5-12 char.

## Data yang dibutuhkan (belum lengkap)

1. **Daily dungeon** — ✅ selesai. Itu Lucky Zone (`app/data/luckyZone.js`):
   3 pola siklus 31 hari, pattern bulan dihitung formula (Juli 2026 = pattern 3,
   geser 1→2→3 tiap bulan).
2. **Weekly content** — belum ada. 3 kategori:
   - Resource-generator (dungeon yang hasilnya banyak buat farming)
   - Gacha plate
   - Raid
   Tiap entri butuh: nama, effort (durasi/jumlah run), requirement stat kalau ada.
3. **Threshold stat per konten** — ATK/MATK minimal per job untuk raid vs
   weekly dungeon biasa. Bukan tier label (S/A/B) — user lebih suka angka
   asli (ATK power / MATK) karena lebih presisi daripada mendeskripsikan
   kombinasi gear. Tier label (kalau masih dipakai buat display) diturunkan
   dari angka via satu tabel threshold, bukan sistem tier terpisah.
4. **Job → stat mapping** — job mana dinilai dari ATK, mana dari MATK, mana
   dari stat lain (support).
5. **Profil char member** — belum, baru dikumpulin di Fase 3 (bukan hardcode).

## Fase & urutan bangun

| Fase | Isi | Command/fitur | Syarat mulai |
|---|---|---|---|
| 1 | Data statis (rotasi + tier/stat) | file `app/data/*.js` doang | Data weekly + threshold dikirim |
| 2 | Info harian gabungan (tanpa profil personal) | `/hari-ini` — daily (Lucky Zone) + weekly yang belum selesai minggu ini + saran umum "Sabtu-Senin fokus raid" | Fase 1 selesai |
| 3 | Profil char per member | `/char-set`, `/char-list` (Mongo, 1 dokumen/user, upsert — pola sama `salaryLog`) | Fase 2 jalan, ada permintaan riil |
| 4 | Rekomendasi personal | `/rekomendasi` — silang profil × data hari ini | Fase 3 selesai |
| 5 (opsional) | Pengingat otomatis, mirip `digest.js` | Post harian/mingguan ke channel, kill-switch env var | Fase 4 terbukti dipakai |

Prinsip: nggak ada fase dibangun mendahului data-nya siap. `/lz` berdiri
sendiri permanen, bukan bagian dari command besar ini — command besar nanti
boleh *baca* `luckyZone.js` sebagai salah satu input datanya.

## Status saat ini

Fase 1 baru punya Lucky Zone. Weekly content, threshold stat, dan job mapping
masih ditunggu dari user. Belum ada kode Fase 2 ke atas.
