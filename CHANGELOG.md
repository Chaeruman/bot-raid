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

## [1.15.9] — 2026-08-05

### Fixed
- **`_selftest.js` no-bracket test false-failed on named fragments** — items
  with no dungeon (Spitflower Ignis dkk) got tested as literal `"null <name>"`
  instead of just `<name>`, since the test always prefixed `${e.dungeon}`
  without checking it could be `null`. Parser itself was never broken.

## [1.15.8] — 2026-08-05

### Added
- **Type Items: Desert Dragon Research Book (DDN HC)** — ketik `ddn research
  book`, `ddn res`, atau cukup `res`/`research` (default DDN, satu-satunya
  varian). Stamp 3, muncul di Browse Item kategori 📖 Research.

## [1.15.7] — 2026-07-27

### Fixed
- **`/kirim-gaji` — sisa underscore di "(bukan IGN mereka)"** — italic
  `_..._` di note ini kadang nggak ke-pair rapi sama underscore escaped di
  `g\_balance` pada baris yang sama, ninggalin `_` literal nyantol di teks.
  Note-nya sekarang plain text, nggak pakai markdown italic sama sekali.

## [1.15.6] — 2026-07-26

### Fixed
- **`/kirim-gaji` — underscore `_balance` kemakan markdown Discord** — jadi
  ngilang dan malah bikin teks di sekitarnya (termasuk `_(bukan IGN
  mereka)_`) ke-italic bareng. Sekarang di-escape (`\_`) biar literal.

## [1.15.5] — 2026-07-26

### Changed
- **`/kirim-gaji` — gold diikat `_balance`** — `35.393g` jadi `35.393g_balance`
  (nempel, tanpa spasi) biar double-click nyeleksi seluruh angka gold sebagai
  satu token, bukan kepotong di huruf `g`.

## [1.15.4] — 2026-07-26

### Added
- **`/kirim-gaji` — jumlah panel balik ke baris member** — sekarang
  `35.393g (3 panel) [ santenaz | Rubiq ]`. Daftar IGN di-dedupe, jadi
  jumlah IGN nggak selalu sama dengan jumlah panel (satu karakter bisa jual
  beberapa panel). Angka panel jawab "berapa banyak", IGN jawab "karakter
  mana" — dua-duanya perlu, IGN tetap ada buat verifikasi.

## [1.15.3] — 2026-07-26

### Added
- **`/kirim-gaji` — daftar Panel nampilin gaji + waktu** — formatnya sekarang
  `9.970g/org - [santenaz](link) (23 Jul 11.22)`. Angka gaji pakai figure
  headline yang sama dengan judul thread (`salaryPerPerson`), ditandai
  `/org` biar nggak kebaca sebagai total panel. Tanggal diambil dari
  `eventTitle` (tahun & "WIB" dibuang karena cuma noise); panel `/loot`
  standalone judulnya bebas jadi nggak ada tanggal — bagian itu dilewat.
  Ini juga yang bikin dua panel dari karakter yang sama akhirnya bisa
  dibedain, masalah yang kebawa sejak 1.15.2.

## [1.15.2] — 2026-07-26

### Changed
- **`/kirim-gaji` — daftar Panel cukup IGN seller** — teks link yang tadinya
  judul panel + tanggal + jam (`[GDN HC — 23 Jul 2026 11.22 WIB](…) — santenaz`)
  dipendekin jadi `[santenaz](…)` saja. Judul raid-nya sudah kelihatan begitu
  thread-nya kebuka, jadi ngulang di sini cuma makan jatah 2000 karakter.
  Hemat ~33 karakter per panel. Catatan: URL-nya sendiri 88 karakter, jadi
  kalau nanti beneran mepet, yang perlu dibuang link-nya, bukan label-nya.

## [1.15.1] — 2026-07-26

### Changed
- **`/kirim-gaji` — nomor panel diganti IGN seller** — link `panel 1 | 2 | 3`
  per member (1.15.0) dicabut, tiap link makan ~60 karakter dan bikin batas
  2000 cepat kepotong. Gantinya tiap baris member nutup dengan
  `[ Frzzy | Rubiq ]` — IGN karakter kamu yang masih ngutang ke member itu,
  di-dedupe. Limit mail itu per karakter, jadi IGN yang nentuin kamu harus
  login ke karakter mana, bukan panelnya.
- **`/kirim-gaji` — daftar Panel nampilin IGN seller** — tiap baris panel
  dikasih `— <IGN>` di belakang (atau _IGN belum diset_), biar panel yang
  judulnya mirip (raid sama, jam beda) bisa dibedain dari karakter jualannya.

## [1.15.0] — 2026-07-26

### Added
- **`/kirim-gaji` — nomor panel per member** — tiap baris member sekarang
  nutup dengan `panel 1 | 2 | 3`, tiap angka link langsung ke loot message
  panel yang bersangkutan. Daftar **Panel:** di bawah ikut dinomori supaya
  cocok. Seller nggak perlu cocokin judul panel satu-satu buat tahu member
  ini nunggak di panel mana. _(Dicabut lagi di 1.15.1 — boros karakter.)_

### Changed
- `aggregate()` — field `count` diganti `panelNums` (array 1-based); jumlah
  panel tinggal `panelNums.length`. Sengaja satu field, bukan dua yang harus
  sinkron — dua field yang bisa drift persis penyebab bug 1.14.3.

## [1.14.3] — 2026-07-26

### Fixed
- **`/kirim-gaji` nampilin panel yang belum ada isinya** — `myPanels()` punya
  salinan sendiri cek "siap bayar" yang ketinggalan guard `hasPayout` waktu
  `allItemsSold()` dibikin di 1.14.0. Karena `[].every()` selalu `true`,
  panel tanpa item sellable ikut kebawa dengan gaji 0g. Sekarang pakai
  `allItemsSold()` yang sama dengan tombol Mark Paid — satu sumber kebenaran.
  Panel gacha-only kena regresi ini sejak 1.14.0; panel kosong total
  sebenarnya sudah bocor sejak sebelum itu. Panel gold-only tetap muncul.
- `_gabtest.js` — ekspektasi total masih angka pra-pajak-mail 0.3% (basi sejak
  1.2.0), jadi test-nya crash di assert pertama dan bagian `myPanels()` di
  bawahnya nggak pernah kejalan — itu sebabnya regresi di atas lolos.

## [1.14.2] — 2026-07-22

### Changed
- **Item unique nggak pernah digabung** — equipment/rune/accessory yang
  diketik berkali-kali (baris terpisah atau `x3` dalam satu baris) sekarang
  selalu jadi baris terpisah (qty 1) di panel, bukan digabung jadi satu baris
  dengan qty ditotal. Tiap drop bisa di-price beda-beda ke buyer beda. Item
  quantity (fragment) tetap nge-stack seperti biasa.

## [1.14.1] — 2026-07-22

### Added
- **Price All: `gacha` keyword retroaktif** — item yang awalnya diketik tanpa
  `gacha` di Type Items sekarang bisa ditandai not-for-sale belakangan lewat
  Price All (ketik `gacha` di baris item itu sebelum `=`).

## [1.14.0] — 2026-07-22

### Added
- **Type Items: `gacha` keyword** — tandain item yang didapat tapi dibagikan
  lewat gacha/duck-race, bukan dijual (misal `gdn fragment gacha #buat siapa
  yang menang`). Item tetap tercatat & tampil di panel (🎁 gacha, tidak
  dijual), tapi nggak masuk hitungan stamp fee/gold, dan nggak perlu di-price.

### Fixed
- **Panel gold-raid tanpa item drop nggak dianggap ada data gaji** — panel
  yang cuma punya gold raw (item-nya di-gacha atau nggak drop sama sekali)
  sekarang bener dianggap "siap bayar" (thread dapat prefix 💵, muncul di
  `/kirim-gaji`) selama ada gold raid ATAU item sellable yang udah di-price.
- **Price All: blank di kanan `=` sekarang clear harga** (balik ke belum
  di-price), bukan dibiarkan nggak berubah.
- **Gaji nggak bisa minus lagi** — item yang ke-price di bawah stamp fee-nya
  sendiri dulu bisa bikin `memberSalary()` negatif; sekarang di-clamp ke 0.
- **Mark Paid hilang (bukan cuma disabled) sampai semua item sellable
  ke-price** — nyegah gaji yang udah kecatat di `/gaji-saya` jadi basi kalau
  ternyata masih ada item yang nyusul dijual setelah ada yang di-mark paid.
- `resolveItems.js` (flow Resolve buat baris ambigu) punya `addToPanel`
  sendiri yang ketinggalan fix note-merge dari sesi sebelumnya — disamakan.

## [1.13.1] — 2026-07-22

### Changed
- **`/memo`** — 4 separate boolean options diganti 1 opsi `tipe` dengan
  preset dropdown (Memo 1-4, "2 & 4", "3 & 4", "Semua"), biar host tinggal
  pilih satu dari list bukan toggle field satu-satu.

## [1.13.0] — 2026-07-22

### Added
- **`/memo`** — DDN Memo (Memoria) party signup: pick which of memo1-4 to
  run (booleans, combinable e.g. 2 & 4), builds one 4-slot party (`P1-P4`).
  Job buttons (same labels as raid roles) don't claim a fixed slot like raid
  — clicking one just assigns you to the next open position and labels it
  with that job; switching jobs keeps your position. Reuses the existing
  signup panel (lock/cancel/remove member/done run) untouched — `noThread`,
  so Done Run just closes the panel, no loot thread.

## [1.12.0] — 2026-07-10

### Added
- **`/soundboard-list`** (Co-Leader) — setup helper buat fitur voice/Party Up
  yang akan datang: nampilin nama + ID soundboard custom server ini (Discord
  client nggak nampilin ID lewat UI biasa, cuma bisa lewat API).

## [1.11.1] — 2026-07-10

### Fixed
- **`/kirim-gaji`** — ⚠️ (bukan IGN) sebelumnya nge-override ⭐ (rekomendasi)
  di bullet, jadi member yang direkomendasikan tapi nggak punya alias IGN
  keliatan cuma ⚠️. Sekarang keduanya muncul bareng (⭐⚠️) kalau dua-duanya
  berlaku.

## [1.11.0] — 2026-07-10

### Added
- **Raid signup — Ping Party** — begitu party full, dua tombol baru muncul
  gantiin slot role button (host-only): **📢 Ping Party (custom)** (modal
  minta teks, bot tag semua member + teks itu) dan **🎉 Party Up** (langsung
  tag semua member + teks "PT UP bala WOY jembod").

## [1.10.4] — 2026-07-10

### Changed
- **`/kirim-gaji`** — nama member sekarang dibungkus kurung `(Nama)` bukan
  bold `**Nama**`, biar double-click buat copy IGN nggak ikut kebawa spasi
  di belakangnya. Member tanpa alias IGN (nggak ada `" - "` di nickname)
  ditandai `⚠️` (ganti bullet-nya) + catatan singkat `_(bukan IGN mereka)_`,
  gampang di-scan sekilas daripada kalimat panjang tiap baris.

## [1.10.3] — 2026-07-10

### Changed
- **Raid signup** — tombol role hilang total (bukan cuma disabled) begitu
  party penuh (misal 8/8), sama seperti pas locked. Muncul lagi kalau ada
  slot kosong lagi (member keluar/di-remove).

## [1.10.2] — 2026-07-10

### Fixed
- **`/kirim-gaji` "Interaction failed"** — command dan tombol/select/modal
  terkait (mark-paid, budget lain, mark-paid rekomendasi) nggak pernah
  defer, jadi kalau fetch thread/member Discord-nya lewat 3 detik,
  interaction-nya keburu mati sebelum sempat dibalas. Semua sekarang defer
  duluan sebelum kerja berat, baru edit reply — jadi nggak perlu kirim
  command 2x lagi.

## [1.10.1] — 2026-07-10

### Added
- **`/kirim-gaji`** — member yang nickname-nya nggak punya `" - "` (nggak
  ada IGN alias) ditandai `_(bukan IGN, tolong konfirmasi ulang IGN-nya)_`
  di list, biar seller nggak salah kirim mail ke nama Discord biasa.

## [1.10.0] — 2026-07-10

### Added
- **`/kirim-gaji` — tombol "✅ Mark Paid Rekomendasi"** muncul kalau ada
  kombinasi yang cocok sama budget — klik langsung eksekusi mark-paid tanpa
  perlu buka select menu (yang cuma submit kalau ada perubahan, jadi
  buka-tutup tanpa ngutak-atik nggak ngapa-ngapain). Rekomendasi dihitung
  ulang fresh saat diklik, bukan trust state lama.
- **`/kirim-gaji budget:`** — kalau budget cuma cukup buat <3 orang padahal
  ada 3+ yang belum dibayar, muncul saran "naikin budget ke minimal Xg biar
  bisa bayar ke 3 orang sekaligus" (X udah termasuk pajak mail).

### Changed
- **`/kirim-gaji`** — nama yang ditampilkan sekarang motong bagian setelah
  `" - "` di nickname (misal "xFerb - Frzzy" → "xFerb"), biar double-click
  buat copy IGN ke game nggak ikut kebawa spasi/teks lain. Nickname tanpa
  alias (nggak ada `" - "`) nggak disentuh.

## [1.9.4] — 2026-07-10

### Fixed
- **Tombol "Cek Budget"/"Budget Lain" kena "This panel is no longer active"**
  — pre-check di `index.js` cuma whitelist prefix `loot-btn:`, jadi tombol
  `gab-budget:` yang baru ditambah kena tolak sebelum sempet nyampe
  handler-nya. Sekarang dikecualikan juga.

## [1.9.3] — 2026-07-10

### Added
- **`/kirim-gaji` — tombol "Cek Budget"/"Budget Lain"** di message yang sama:
  klik → modal minta angka gold → message ephemeral yang sama ter-update
  dengan rekomendasi budget baru. Nggak perlu ketik ulang command buat coba
  budget lain (misal buka karakter berikutnya).

## [1.9.2] — 2026-07-10

### Changed
- **`/kirim-gaji budget:`** — prioritas sekarang maksimalin jumlah orang
  (sampai 3, limit mail/hari) dulu, baru optimalin kedekatan ke budget di
  antara kombinasi seukuran itu. Sebelumnya bisa milih 2 orang yang lebih
  pas nominalnya walau masih ada 1 slot mail nganggur — sekarang cuma turun
  ke 2/1 orang kalau memang nggak ada kombinasi 3 orang yang muat.

## [1.9.1] — 2026-07-10

### Fixed
- **`/kirim-gaji budget:`** — sekarang motong 0.3% pajak mail dari budget
  dulu sebelum nyari kombinasi, biar rekomendasinya beneran muat pas dikirim
  (bukan cuma pas di atas kertas sebelum kena pajak).

## [1.9.0] — 2026-07-10

### Added
- **`/kirim-gaji budget:`** — kasih tahu jumlah gold yang kamu punya di satu
  karakter, bot saranin maks 3 orang (limit mail/hari) yang totalnya paling
  mendekati budget tanpa lebih — otomatis ke-pre-select di menu, tinggal
  submit atau ubah manual.

### Changed
- **`/kirim-gaji`** — setelah assign sebagian (nggak sekaligus semua), pesan
  yang sama sekarang ter-update nunjukin sisa yang belum lunas + menu baru,
  bukan langsung ditutup. Reply juga di-truncate ke 2000 karakter (bisa
  gagal kirim sebelumnya kalau daftar member panjang).
- **Raid signup** — tombol role hilang total (bukan cuma disabled) selama
  party locked, sama seperti loot panel; muncul lagi begitu di-unlock.

## [1.8.7] — 2026-07-10

### Changed
- **Loot panel tombol** — sebelum seller di-set, cuma **Set Seller** dan
  **Add Member** yang muncul; tombol lain (Type Items, Browse, Price,
  Add/Remove Gold, Remove Member, Mark Paid, Close Panel) hilang dulu,
  bukan cuma disabled. Semua tombol **Remove** (item/gold/member) juga
  cuma muncul kalau ada datanya buat dihapus.

## [1.8.6] — 2026-07-10

### Fixed
- **`/gaji-saya`** — reply nggak di-truncate ke 2000 karakter (beda dari
  command lain), bisa gagal kirim kalau riwayat gaji panjang. Ditambahkan
  `.slice(0, 2000)` biar konsisten sama command lain.

## [1.8.5] — 2026-07-10

### Changed
- **Weekly digest** — jadwal digeser dari Sabtu 08:00 ke **Jumat 23:00 WIB**.
- **Price All** — format baris dibalik: `#note` sekarang di depan `=`, harga
  di belakang (`N. Item x_qty #note = 139`) — `=` tetap nempel persis di
  depan harga biar jelas di situ yang harus diisi.

## [1.8.4] — 2026-07-07

### Fixed
- **Item notes ketimpa saat digabung** — nambah item yang sama dua kali
  dengan note beda (misal item sama buat 2 buyer berbeda) dulu digabung
  jadi satu baris dan note pertama hilang. Sekarang cuma digabung kalau
  note-nya sama; note beda tetap jadi baris terpisah.

## [1.8.3] — 2026-07-07

### Added
- **Type Items: DDN Smelted Rune** — sekarang bisa diketik langsung
  (`ddn smelted rune`, `rune x2`, dst) di Type Items, resolve ke
  `ddn_smelted_rune`. Nggak perlu sebut "ddn" karena cuma varian itu yang
  ada — default ke DDN kalau dungeon nggak disebut.

## [1.8.2] — 2026-07-07

### Fixed
- **LZ digest nggak pernah auto-post** — `/lz-now` ikut nge-update timestamp
  guard yang sama dipakai scheduler otomatis, jadi tiap kali dipakai buat
  cek manual, itu nge-block kiriman otomatis berikutnya selama ~23 jam.
  `/lz-now` sekarang cuma kirim tanpa menyentuh guard. Juga menambah log
  `📨 LZ digest terkirim` biar ketauan dari log kalau ini jalan, dan benerin
  log boot yang masih hardcode "08:00" padahal jamnya udah diubah ke 03:00.

## [1.8.1] — 2026-07-04

### Fixed
- **Crash on existing panels** — removing junk/good rune keys in 1.8.0 broke
  loot panels created before the change (`CATALOG[item.itemKey]` was
  `undefined` for items still using the old `_junk`/`_good` keys). Restored
  as aliases pointing at the merged entry — no data loss, no re-entry needed.

## [1.8.0] — 2026-07-04

### Changed
- **Rune junk/good dihapus** — Thorns/Storm/Forest/Hot Sand nggak lagi minta
  pilih junk vs good/perfect (dulu cuma label, stamp fee-nya sama persis).
  Sellernya tinggal ketik stat pakai `#note` kalau perlu dicatat.
- **`/kirim-gaji`** — sekarang cuma nampilin panel yang semua item-nya udah
  ada harga (payment-ready). Panel yang masih di-track harganya di-skip,
  biar nggak ada mark-paid nabrak sama harga yang masih berubah.

## [1.7.1] — 2026-07-04

### Added
- **`/lz-now`** (Co-Leader) — trigger manual buat post Lucky Zone ke
  `LZ_CHANNEL_ID`, mitigasi kalau jadwal 08:00 WIB kelewat.

## [1.7.0] — 2026-07-04

### Added
- **Daily Lucky Zone digest** — post otomatis ke `LZ_CHANNEL_ID` tiap hari
  08:00 WIB (kill-switch `LZ_DIGEST_ENABLED`, sama pola dengan weekly digest,
  jalan di proses yang sama tanpa nambah Render service). Kalau kelewat
  (misal restart pas jam segitu), dibiarkan — info ini bukan data kritis,
  `/lz` tetap ada sebagai fallback manual.
- `docs/daily-feature-plan.md` — rencana fitur rekomendasi kegiatan harian
  per karakter (belum dibangun, dicatat biar konteksnya nggak hilang).

### Changed
- `/lz` dan digest sekarang share format pesan yang sama
  (`formatLzMessage()` di `app/data/luckyZone.js`), nggak ada duplikasi teks.

## [1.6.0] — 2026-07-04

### Added
- **`/lz`** — Lucky Zone hari ini (2 map + reward Cap 60). Pattern rotasi
  1→2→3 tiap bulan, dihitung dari formula (Juli 2026 = pattern 3), bukan
  tabel manual — otomatis benar untuk bulan-bulan berikutnya.

## [1.5.2] — 2026-07-04

### Added
- **Local/staging setup** — `MONGODB_DB_NAME` env var (defaults to `bot-raid`,
  unchanged for production) lets a local run point at a separate Mongo
  database + Discord test server without touching production data.
  `.env.example` documents which vars should stay the same vs. differ.

## [1.5.1] — 2026-07-04

### Changed
- **Top 5 panel salary record** — sekarang posting ke channel sendiri
  (`TOP5_CHANNEL_ID`), terpisah dari weekly digest (`DIGEST_CHANNEL_ID`).

## [1.5.0] — 2026-07-04

### Added
- **Top 5 panel salary record** — saat panel ditutup (semua member lunas),
  bot cek apakah total gaji panel itu masuk top 5 sepanjang masa. Kalau iya,
  posting ke `DIGEST_CHANNEL_ID`: judul panel (link thread) — nama IGN
  seller — total gaji. Nyimpen 1 dokumen (`top5PanelSalary`, maks 5 entri),
  cuma posting kalau ranking/anggota top5 beneran berubah, terpisah dari
  fitur digest mingguan/`/gaji-saya`.

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

[Unreleased]: https://github.com/Chaeruman/bot-raid/compare/v1.15.9...HEAD
[1.15.9]: https://github.com/Chaeruman/bot-raid/compare/v1.15.8...v1.15.9
[1.15.8]: https://github.com/Chaeruman/bot-raid/compare/v1.15.7...v1.15.8
[1.15.7]: https://github.com/Chaeruman/bot-raid/compare/v1.15.6...v1.15.7
[1.15.6]: https://github.com/Chaeruman/bot-raid/compare/v1.15.5...v1.15.6
[1.15.5]: https://github.com/Chaeruman/bot-raid/compare/v1.15.4...v1.15.5
[1.15.4]: https://github.com/Chaeruman/bot-raid/compare/v1.15.3...v1.15.4
[1.15.3]: https://github.com/Chaeruman/bot-raid/compare/v1.15.2...v1.15.3
[1.15.2]: https://github.com/Chaeruman/bot-raid/compare/v1.15.1...v1.15.2
[1.15.1]: https://github.com/Chaeruman/bot-raid/compare/v1.15.0...v1.15.1
[1.15.0]: https://github.com/Chaeruman/bot-raid/compare/v1.14.3...v1.15.0
[1.14.3]: https://github.com/Chaeruman/bot-raid/compare/v1.14.2...v1.14.3
[1.14.2]: https://github.com/Chaeruman/bot-raid/compare/v1.14.1...v1.14.2
[1.14.1]: https://github.com/Chaeruman/bot-raid/compare/v1.14.0...v1.14.1
[1.14.0]: https://github.com/Chaeruman/bot-raid/compare/v1.13.1...v1.14.0
[1.13.1]: https://github.com/Chaeruman/bot-raid/compare/v1.13.0...v1.13.1
[1.13.0]: https://github.com/Chaeruman/bot-raid/compare/v1.12.0...v1.13.0
[1.12.0]: https://github.com/Chaeruman/bot-raid/compare/v1.11.1...v1.12.0
[1.11.1]: https://github.com/Chaeruman/bot-raid/compare/v1.11.0...v1.11.1
[1.11.0]: https://github.com/Chaeruman/bot-raid/compare/v1.10.4...v1.11.0
[1.10.4]: https://github.com/Chaeruman/bot-raid/compare/v1.10.3...v1.10.4
[1.10.3]: https://github.com/Chaeruman/bot-raid/compare/v1.10.2...v1.10.3
[1.10.2]: https://github.com/Chaeruman/bot-raid/compare/v1.10.1...v1.10.2
[1.10.1]: https://github.com/Chaeruman/bot-raid/compare/v1.10.0...v1.10.1
[1.10.0]: https://github.com/Chaeruman/bot-raid/compare/v1.9.4...v1.10.0
[1.9.4]: https://github.com/Chaeruman/bot-raid/compare/v1.9.3...v1.9.4
[1.9.3]: https://github.com/Chaeruman/bot-raid/compare/v1.9.2...v1.9.3
[1.9.2]: https://github.com/Chaeruman/bot-raid/compare/v1.9.1...v1.9.2
[1.9.1]: https://github.com/Chaeruman/bot-raid/compare/v1.9.0...v1.9.1
[1.9.0]: https://github.com/Chaeruman/bot-raid/compare/v1.8.7...v1.9.0
[1.8.7]: https://github.com/Chaeruman/bot-raid/compare/v1.8.6...v1.8.7
[1.8.6]: https://github.com/Chaeruman/bot-raid/compare/v1.8.5...v1.8.6
[1.8.5]: https://github.com/Chaeruman/bot-raid/compare/v1.8.4...v1.8.5
[1.8.4]: https://github.com/Chaeruman/bot-raid/compare/v1.8.3...v1.8.4
[1.8.3]: https://github.com/Chaeruman/bot-raid/compare/v1.8.2...v1.8.3
[1.8.2]: https://github.com/Chaeruman/bot-raid/compare/v1.8.1...v1.8.2
[1.8.1]: https://github.com/Chaeruman/bot-raid/compare/v1.8.0...v1.8.1
[1.8.0]: https://github.com/Chaeruman/bot-raid/compare/v1.7.1...v1.8.0
[1.7.1]: https://github.com/Chaeruman/bot-raid/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/Chaeruman/bot-raid/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/Chaeruman/bot-raid/compare/v1.5.2...v1.6.0
[1.5.2]: https://github.com/Chaeruman/bot-raid/compare/v1.5.1...v1.5.2
[1.5.1]: https://github.com/Chaeruman/bot-raid/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/Chaeruman/bot-raid/compare/v1.4.1...v1.5.0
[1.4.1]: https://github.com/Chaeruman/bot-raid/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/Chaeruman/bot-raid/compare/v1.3.1...v1.4.0
[1.3.1]: https://github.com/Chaeruman/bot-raid/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/Chaeruman/bot-raid/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/Chaeruman/bot-raid/compare/v1.1.1...v1.2.0
[1.1.0]: https://github.com/Chaeruman/bot-raid/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Chaeruman/bot-raid/releases/tag/v1.0.0
