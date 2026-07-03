# Changelog

Semua perubahan penting untuk **raid-gdn** dicatat di sini.
Format mengikuti [Keep a Changelog](https://keepachangelog.com/) dan proyek ini
memakai [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`).

- **MAJOR** — perubahan yang memecah alur/data lama (breaking).
- **MINOR** — fitur baru yang kompatibel ke belakang.
- **PATCH** — bugfix / perbaikan kecil.

Cara bump: `npm run release:patch` (atau `:minor` / `:major`). Perintah ini
mengubah `version` di `package.json` lalu membuat commit + tag `vX.Y.Z`.
Pindahkan isi **[Unreleased]** ke section versi baru sebelum bump.

## [Unreleased]

## [1.4.1] — 2026-07-04

### Fixed
- **`/digest-now`** — sebelumnya selalu bilang "terkirim" walau leaderboard
  kosong (belum ada gaji tercatat di `salaryLog`). Sekarang jujur kalau nggak
  ada yang diposting.

## [1.4.0] — 2026-07-04

### Added
- **`/digest-now`** (Co-Leader) — trigger manual buat weekly digest, mitigasi
  kalau jadwal otomatis kelewat (misal Render restart pas maintenance
  bertepatan sama jam digest).

## [1.3.1] — 2026-07-04

### Changed
- **Weekly digest** — jadwal post digeser dari Senin 09:00 ke Sabtu 08:00 WIB.

## [1.3.0] — 2026-07-04

### Added
- **Weekly digest** — top 10 gaji terbanyak minggu ini diposting ke channel
  (`DIGEST_CHANNEL_ID`) tiap Senin 09:00 WIB. Mati secara default, nyalakan
  lewat `DIGEST_ENABLED=true` — kill-switch via env var, nggak perlu redeploy
  buat matiin kalau bermasalah. Jalan di proses yang sama (bukan Render
  service/cron baru), jadi nggak nambah usage free tier.
- **`/state filter:`** — tiap loot panel di `/state` sekarang nampilin status
  thread-nya (🟢 aktif / 🔒 stale / ❌ gone), plus opsi filter buat cuma
  nampilin yang stale/gone.

## [1.2.0] — 2026-07-04

### Added
- **`/kirim-gaji`** — link ke tiap panel (thread) ditampilkan di daftar,
  jadi seller bisa buka panelnya langsung tanpa nyari manual.
- **`/kirim-gaji`** — panel di-skip dari daftar kalau thread-nya sudah
  archived/locked (atau thread-nya sudah hilang), bukan cuma cek `panel.closed`.
- **Pajak mail 0.3%** — gaji/orang (termasuk member yang di-exclude HC)
  dipotong 0.3% lalu dibulatkan ke bawah.
- **`/gaji-saya [range]`** — tiap member bisa cek total gaji yang sudah
  diterima (7/14/30/90 hari), dengan rincian per panel (judul + link thread +
  nama seller). Disimpan di collection Mongo terpisah `salaryLog`, satu
  dokumen per (panel, member) yang di-upsert saat mark-paid dan dihapus kalau
  di-unmark — storage tidak bengkak, hanya sebesar jumlah pembayaran yang
  benar-benar terjadi. Cuma berlaku untuk panel yang dibuat sejak hari ini
  (bareng dengan rollout stamp rate 5g).
- **Stamp rate 5g/stamp** — new loot panels snapshot the current rate at
  creation (`panel.stampRate`); panels already open keep their original rate
  (defaults to the old 4g/stamp when the field is missing), so the bump
  doesn't retroactively change salaries already in progress.
- **Named fragments** — Spitflower Ignis, Storm Master Zuu, Canyon Guardian
  Abubbah, Sandworm Hazal, Loyal Follower Kajif addable via Type Items (exact
  name or a keyword like "zuu"); no stamp fee, priced like existing fragments.

### Fixed
- **Gold exclude `@tag`** — `@ol` sekarang cocok exact dulu, baru fallback ke
  substring; sebelumnya `@ol` bisa nyangkut ke `NOLtiga` dan gagal ke-resolve
  meski nama persis "ol" ada di panel.

## [1.1.0] — 2026-07-03

### Added
- **`/kirim-gaji`** — seller melihat daftar gaji belum-dibayar tiap member
  (gabungan lintas semua loot panel terbuka miliknya, presisi termasuk potongan
  HC untuk member yang di-exclude), lalu multi-select untuk menandai lunas di
  semua panel sekaligus. Loot panel ikut ter-refresh; panel yang jadi lunas
  auto-close. Tanpa cek thread satu-satu.

## [1.0.0] — 2026-07-03

Rilis pertama yang ter-versioning. Merangkum seluruh fitur yang sudah jalan.

### Added
- **Panel signup party** — `/start`, `/raid`, `/marathon`, `/nest`; tombol role
  (dengan sub-role class untuk MT/MC), Cancel My Role, Lock, Remove Member,
  Cancel Run, Done Run.
- **Loot panel otomatis** — Done Run bikin forum thread + loot panel; embed
  signup menampilkan `Thread: #…` + tombol Set Seller.
- **Type Items parser** — satu baris per item: rune (alias family + tier
  `l/u` + junk/good), accessory (`legend/l/hunter/hc`, `unique/u/squad`),
  named gear (keyword ± kurung), equipment biasa, fragment, quantity `x5`,
  note inline `#…`, dan gold (`294/7 @tag`, `258/8`).
- **Resolve flow** — baris ambigu ditawarkan bernomor → tombol Resolve.
- **Pricing** — Price All (modal, `= <expr>`) & Price One; ekspresi matematika
  `+ - * / ()` via `evalPrice`.
- **Member & pembayaran** — Add/Remove Member dan Mark Paid multi-select;
  panel auto-close saat semua dibayar; Close Panel manual.
- **Judul thread otomatis** — prefix `💵` (semua diberi harga) / `✅` (lunas).
- **Panel role-scoped** — `/loot [tim:Tim 1|Tim 2]` isi member dari role tim.
- **Command operasional** — `/loot-action`, `/state`, `/clear` (Co-Leader gate).
- **Persistence** — state disimpan ke MongoDB Atlas (`saveState`/`loadState`).
- **Versioning** — semver di `package.json`, dibaca lewat `app/version.js`,
  tampil di log boot & `/state`.

[Unreleased]: https://github.com/Chaeruman/bot-raid/compare/v1.4.1...HEAD
[1.4.1]: https://github.com/Chaeruman/bot-raid/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/Chaeruman/bot-raid/compare/v1.3.1...v1.4.0
[1.3.1]: https://github.com/Chaeruman/bot-raid/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/Chaeruman/bot-raid/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/Chaeruman/bot-raid/compare/v1.1.1...v1.2.0
[1.1.0]: https://github.com/Chaeruman/bot-raid/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Chaeruman/bot-raid/releases/tag/v1.0.0
