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

### Added
- **🗑️ Remove quest** di panel bounty. Sebelumnya quest cuma bisa *diganti*
  lewat ♻️ Edit quest, dan paste kosong sengaja diabaikan — jadi quest yang
  nempel di karakter salah tidak bisa dicabut sama sekali.
  - Menawarkan **quest yang belum kelar saja**, daftar yang sama dengan
    ✅ Mark done. Yang sudah kelar itu riwayat; cara membuangnya tekan
    ↩️ Undo dulu, supaya langkah merusaknya kelihatan.
  - Quest yang kebetulan selesai antara daftar dibuka dan pilihan ditekan
    tidak ikut terhapus — dicek ulang saat submit, bukan cuma saat menu
    dibangun.
  - Satu-satunya tombol merah di panel, dan **🔄 Refresh Panel** pindah ke
    baris atas supaya baris quest tetap utuh (lima tombol per baris).
- **Baca quest dari screenshot papan bounty.** Lempar gambar papan ke thread
  bounty-mu sendiri, bot membalas dengan hasil bacanya dan tombol **🎯 Add
  quest** yang membuka modal biasa dalam keadaan sudah terisi.
  - Dua layar diterima: papan pin, dan **Weekly Events → Group Bounty**. Yang
    kedua jauh lebih akurat — satu baris per quest, rarity di depan nama
    lengkapnya, tanpa kata terpotong dan tanpa kolom.
  - **Beberapa gambar dalam satu pesan** dibaca sekaligus (maks 4). Layar
    Weekly Events bisa di-scroll, jadi minggu berisi 6 quest butuh dua
    screenshot yang isinya beririsan. Semua masuk dalam satu panggilan supaya
    irisannya bisa disatukan — dibaca terpisah lalu digabung akan menghitung
    ganda, dan dibuang duplikatnya akan menghilangkan quest yang memang kembar.
  - **Jenis scroll ikut dibaca** dari ikon reward, dengan empat ikon referensi
    berlabel (`app/assets/scroll-*.png`) ikut dikirim tiap panggilan; model
    mencocokkan artwork ke artwork, bukan ke deskripsi. Kalau tidak ada yang
    cocok jelas, dikosongkan — bukan ditebak.
  - **Gambarnya dipotong jadi pita bertumpang tindih dan diperbesar 2×**
    sebelum dikirim — meniru zoom manual, yang terbukti membuat scroll-nya
    terbaca benar. Tiap pita dapat jatah petak sendiri, jadi emblem pojoknya
    selamat. Pita tidak perlu aturan baru: dia cuma tampilan beririsan
    tambahan, dan promptnya sudah tahu cara menyatukannya. Ini menambah
    dependency `sharp`.
  - Gambar diminta dibaca pada **resolusi tinggi**. Emblem pembeda jenis
    scroll cuma ~15px di pojok ikon ~40px; pada resolusi default screenshot
    layar penuh dipetak-kecilkan sampai emblem itu habis, dan jawabannya jadi
    `acc` untuk semuanya. Screenshot yang di-zoom terbaca benar — itu yang
    menunjukkan masalahnya piksel, bukan prompt. Model yang menolak field ini
    dicoba ulang tanpa itu, supaya yang hilang cuma scroll-nya, bukan
    seluruh pembacaan.
  - Rarity dibaca dari label `[...]` yang tertulis di kartu, bukan ditebak
    dari warnanya. Warna kartu di screenshot asli pucat dan menyesatkan —
    Archbishop Hell yang Epic sempat masuk sebagai Unique gara-gara itu.
  - Kartu `[Epic]`, `[Rare]`, `[Magic]` dan kartu non-nest (Abyss / FTG
    Stage) dibuang. Cuma Unique / Legendary / Rare Legendary yang dilacak.
  - **Quest yang sudah clear dilewat** — `1/1` dengan bar penuh di daftar,
    atau centang merah besar di kartu papan. Quest selesai yang masuk sebagai
    belum selesai persis kerugian yang mau dihindari ✅ Mark done: board-nya
    akan mengirim orang mencari yang sudah kelar.
  - Nama yang diketik di pesan yang sama ikut terbawa: kalau **persis** cocok
    dengan karakter di roster, dropdown-nya sudah terpilih waktu modal buka.
    Mirip-mirip saja tidak cukup — quest nempel di karakter salah lebih
    merepotkan daripada satu klik.
  - Tidak ada yang masuk DB tanpa lewat modal. Salah baca = satu koreksi,
    bukan data salah.
  - **Setelah submit**, gambar dan balasan bot-nya sama-sama dihapus, dan
    hanya kalau ada quest yang benar-benar tersimpan. Modal yang ditutup
    meninggalkan keduanya utuh; paste yang gagal total menyisakan tombolnya,
    supaya hasil bacanya tidak ikut hilang bersama kesempatan membetulkannya.
    Bot perlu **Manage Messages** di channel bounty; tanpa itu alurnya tetap
    jalan, pesannya cuma tidak terhapus.
  - Butuh env `GEMINI_API_KEY` (opsional `GEMINI_MODEL`) dan **Message Content
    Intent**. Tanpa itu fitur ini diam dan sisa bot jalan normal.
  - Model default `gemini-flash-latest` — alias, bukan versi yang dipatok.
    `gemini-2.5-flash` pensiun di tengah pengujian dan menjawab 404 "no longer
    available to new users"; alias tidak bisa kena itu.
  - Bagian `thought` dari jawaban model dibuang. Semua model Gemini sekarang
    `thinking: true`, dan penalarannya datang sebagai text part biasa — kalau
    ikut digabung, isi pikiran model masuk ke kotak quest.
  - Tanpa dependency baru — `fetch` bawaan Node, `yarn.lock` tidak tersentuh.
  - Diukur dulu: Tesseract lokal cuma dapat 6 dari 11 quest pada 8 screenshot
    asli, karena yang orang kirim lebarnya ±590px. Upscale tidak menambah
    piksel yang tidak ada.

## [1.30.1] — 2026-08-11

### Fixed
- **Nest: job ber-bounty tidak memunculkan modal konfirmasi.** Dua sebab,
  keduanya diperbaiki:
  - Tawaran bounty hanya terpasang di tombol **role** (raid). Panel nest
    memakai tombol **job** (`memojob_`), yang tidak pernah melewatinya — jadi
    di TKN Hell dan nest lain modalnya memang tidak pernah bisa muncul.
  - Andai lewat pun tetap tidak akan cocok: kursi nest bernama `P1`, dan
    `takenRole()` mengembalikan nama kursi itu. Penyaringnya membandingkan
    `"P1"` dengan role karakter (`Healer`, `FU`, …) sehingga selalu kosong.
    `offerBounty()` sekarang menerima role secara eksplisit — job yang baru
    ditekan — bukan menebaknya dari slot.
- **Ganti job menghapus bounty yang sudah dicatat.** `memoJobSelect` membangun
  ulang objek kursi dari nol, jadi `bountyChar` dan `bountyQuests` ikut hilang
  begitu seseorang pindah job setelah memilih karakter bounty-nya. Kursinya
  sekarang di-spread, bukan diganti — kelas bug yang sama dengan `subRole` MT.
- `saveState` dipakai tanpa di-import di router tombol.

### Tests
- Test 58 untuk jalur job nest (terbukti menangkap regresi seat-rebuild).
- Memulihkan test **54, 55, 56** — penyaringan tawaran ke kursi, label varian
  per quest di marathon, dan pemecahan board. Ketiganya terhapus tanpa sengaja
  di `c9d1bf0` saat menulis ulang test 53; suite tetap hijau, jadi tidak ada
  yang menyala. 414 check sekarang.

## [1.30.0] — 2026-08-10

### Added
- **Sumber dana Bonus Gold** — menandai gold mana yang dipakai membayar Bonus
  Gold, lewat dua jalan yang artinya sama:
  - **Prefix `!` di Type Items**: `!258/8` (juga `!gold 258/8` / `gold !258/8`,
    dan jalan untuk ÷7 maupun ÷8).
  - **Pilihan di tombol 💰 Add Gold**: dropdown "Sumber Bonus Gold?" — opsional,
    kosong berarti bukan. Muncul di ketiga jalur Add Gold (÷8 langsung, pemilih
    tipe marathon, dan pemilih member ÷7).
  - Bonus **keluar dari pool itu sebelum dibagi**, jadi yang menanggung
    kompensasi adalah gold run — biasanya GDN Classic — bukan kantong seller.
    Total gold yang keluar tidak berubah, cuma pembagiannya.
  - Panel menampilkan pengurangannya terang-terangan (`800 − 80 bonus = 720 🎁`)
    dan menyebut di Summary bahwa bonus diambil dari gold bertanda.
  - Kalau gold bertanda tidak cukup, sisanya ditanggung seller dan diberi
    peringatan — "party yang bayar" dan "seller yang bayar" menghasilkan angka
    per-orang yang identik, jadi panel harus bilang yang mana yang terjadi.
  - Tanpa ditandai, perilakunya sama seperti sebelumnya (bonus di atas pool).

### Changed
- Modal **Add Gold** disatukan jadi satu builder (`builders/goldModal.js`).
  Sebelumnya disalin identik di tiga tempat, jadi menambah satu field berarti
  mengedit tiga file — dan yang terlewat akan diam-diam kehilangan field itu.

### Fixed
- **Judul thread jadi `💵 0g — …` untuk panel yang baru berisi bonus.** Panel
  bonus-saja memang tidak punya angka per-orang — hanya orang tertentu yang
  dapat — jadi `0g` di daftar thread bukan informasi, melainkan terlihat seperti
  pembayaran rusak. Sekarang penanda dipasang tanpa angka sampai ada angka yang
  layak ditampilkan.

## [1.29.0] — 2026-08-10

### Added
- **🎁 Bonus Gold** — tombol baru di loot panel untuk menambah gold ke
  **orang tertentu saja**, bukan dibagi rata. Untuk kasus bug game di mana mail
  36g HC/CL tidak sampai ke sebagian orang, dan kekurangannya dititipkan ke
  pengiriman gaji supaya seller cukup kirim satu mail.
  - Satu modal: select member (bisa banyak, isinya hanya member panel itu) +
    jumlah gold. Kosong = **36**.
  - **Mengganti, bukan menambah.** Submit ulang dengan angka sama tidak
    melipatgandakan — modal bisa ke-submit dua kali kalau koneksi lambat, dan
    versi yang menjumlah akan diam-diam menggandakan uang orang. Isi `0` untuk
    membatalkan.
  - Masuk ke `memberSalary()`, jadi otomatis ikut ke `/kirim-gaji`, Mark Paid,
    dan catatan gaji — tidak ada jalur pembayaran yang perlu tahu soal ini.
  - Kena mail tax 0.3% sama seperti komponen gaji lain, karena berangkat di
    mail yang sama.
  - Yang gajinya beda dari angka umum (bonus dan/atau tidak dapat HC) dapat
    barisnya sendiri di Summary panel, lengkap dengan alasannya — uang yang
    tidak kelihatan adalah bug yang menunggu giliran.

## [1.28.0] — 2026-08-10

### Added
- **Class Assassin** di loot panel — 8 item GDN dan 8 item DDN. Weapon: Scimitar
  & Dagger (Main), Crook (Second). Armor: Mask (Helmet), Vest (Armor), Greave
  (Pants), Grip (Gloves), Walker (Boots). Stamp-nya ikut bucket-nya otomatis
  (GDN armor 1 · GDN weapon 3 · DDN armor 2 · DDN weapon 4), jadi tidak ada
  angka baru yang perlu diisi. `Assassin` juga masuk `CLASSES`, jadi dropdown
  equipment dan baris struktural (`gdn armor assassin head`) ikut mengenalinya.
- **Catatan baris yang gagal di-parse**, biar kosakata parser disetel dari input
  nyata, bukan tebakan. Berlaku untuk loot panel dan bounty quest.
  - Satu dokumen per **baris berbeda** (collection `parseFails`), bukan per
    percobaan: typo yang sama dari lima orang jadi satu baris `count: 5`. Jadi
    ukurannya dibatasi jumlah kesalahan unik, bukan jumlah traffic — tidak perlu
    TTL index atau job pembersih.
  - Dibedakan `failed` (baris dibuang) vs `needs_pick` (muncul daftar pilihan).
    Baris `needs_pick` yang sering berulang artinya parser mestinya bisa menebak
    sendiri.
  - **`/parse-fails`** (Co-Leader) menampilkannya dalam satu blok kode yang siap
    di-copy — terbanyak dulu, lengkap dengan alasan kegagalannya. Filter
    `source` (loot/bounty) dan `outcome`, plus `clear:true` untuk mengosongkan
    setelah satu batch selesai ditangani.
  - Ikut ditulis ke stdout juga, jadi log Render tetap punya jejaknya walau
    MongoDB sedang mati.

### Changed
- **Parser item (loot panel) dan parser quest (bounty) sekarang toleran typo.**
  Kata yang tidak dikenal dicocokkan ke kosakata terdekat lebih dulu, jadi
  `gdn fragmen`, `ddn hc legendry wep`, `gdn armour warrior head` langsung
  masuk. Batasnya 1 edit sampai 5 huruf, 2 di atas itu; token 2 huruf tidak
  pernah dikoreksi (`l` dan `u` beda tier tapi cuma beda 1 edit), dan kalau ada
  dua kandidat sama dekatnya parser bertanya, bukan menebak. Koreksi yang
  dipakai ditampilkan di balasan (`🔧 Dibaca sebagai: ...`) supaya tebakan yang
  salah kelihatan di layar yang sama dengan quest-nya.
- **Baris yang gagal sekarang menyebut alasannya**, bukan cuma mengulang
  barisnya. `sdn rune` → "no SDN smelted rune in the catalog"; token asing di
  bounty → saran yang ditandai jenisnya (`` `wep` (scroll) ``) alih-alih daftar
  nama nest untuk typo rarity. Semua token asing dilaporkan, bukan yang pertama
  saja.
- **Kurang satu kata = satu klik, bukan baris mati.** Loot: `gdn ring atk`
  (tanpa tier), `thorns` (tanpa L/U), `armor warrior head` (tanpa dungeon),
  `sdn armor` sekarang jadi daftar pilihan lewat tombol **Resolve**, dan
  pilihannya membawa detail-nya (`Ring@Attack` ikut tersimpan). Bounty: baris
  tanpa rarity/scroll jadi dropdown juga, bukan cuma baris ambigu nest —
  selama total kombinasinya ≤ 25 opsi.
- `gdn wep` / `ddn arm` (singkatan tanpa nama item) sekarang resolve ke
  equipment generic; sebelumnya tidak match sama sekali. Baris yang menyebut
  nama spesifik (`gdn wep voodoo doll`) tetap diambil pencarian named item.
- `parseItemLines()` mengembalikan `errors` sebagai objek `{ raw, reason }`,
  bukan string jadi. Formatnya dipegang `formatParseError()` — supaya balasan
  modal dan `/parse-fails` tidak bisa berbeda kata, dan supaya log kegagalan
  bisa memakai baris mentahnya sebagai kunci tanpa membedah kalimat error.
- **`/kirim-gaji` dikelompokkan per jumlah panel**, bukan satu daftar datar.
  Dua tingkat: header `**3 Panel**` sekali per jumlah, lalu daftar IGN seller
  `[ Santeterz | chelssea ]` sebagai sub-blok di bawahnya. Barisnya tinggal
  nama + gaji. Jumlah panel dan daftar IGN tidak bisa digabung jadi satu kunci
  (bikin header berulang dan daftarnya jadi tinggi), tapi juga tidak bisa cuma
  IGN — "2 panel [ santenaz ]" (satu karakter jual dua panel) beda urusan
  dengan "1 panel [ santenaz ]".

### Fixed
- **Market board dan bounty board diam total kalau channel ID-nya salah** —
  `channels.fetch` gagal, di-catch, lalu return tanpa jejak. Sekarang ada log
  sekali per proses yang menyebut ID dan env var-nya.

## [1.27.0] — 2026-08-10

### Added
- **Market board** — satu pesan di channel `MARKET_CHANNEL_ID` berisi item yang
  masih dijual, supaya pembeli cukup baca satu channel. Mati kalau env var-nya
  belum diset.
  - Sumbernya item tanpa harga di loot panel yang masih terbuka — tidak ada data
    baru yang disimpan. Item hilang begitu diberi harga, dan sisanya ikut hilang
    saat panel ditutup, jadi tidak ada yang perlu dicoret manual.
  - Dua embed terpisah: **Accessory** (blok Legend & Unique) dan **Equipment**
    (blok Level 60 untuk DDN, Level 50 untuk GDN/SDN). Blok yang kosong tidak
    ditampilkan.
  - Accessory ditulis pendek: `GDN Legend Accessory (Necklace@INT VIT)` jadi
    `GDN L Necklace · INT VIT`. Tidak ada dash di papan ini; seller dan umur
    masuk kurung, `GDN L Necklace · INT VIT (Rubiq | 2 jam)`.
  - Rune, fragment, smelted rune dan research book di luar papan — barang bulk
    yang tidak pernah dicari lewat papan.
  - Satu baris per item, bukan per panel: tiga orang memegang ring yang sama
    jadi satu baris dengan tiga nama.
  - Seller ditulis sebagai IGN biasa tanpa mention, dan tanpa link thread —
    keduanya mahal di budget 6000 karakter per pesan.
  - Update saat ada perubahan loot panel (debounce 5 detik), plus tick tiap jam
    sebagai jaring pengaman. Panel yang menganggur >14 hari tidak ditampilkan.

## [1.26.0] — 2026-08-09

### Added
- **Tombol di `#kirim-gaji` dan `#gaji-saya`** — pesan ter-pin dengan tombol
  hijau, jadi tidak perlu mengetik command. `/kirim-gaji` dan `/gaji-saya` tetap
  ada. Butuh `KIRIM_GAJI_CHANNEL_ID` dan `GAJI_SAYA_CHANNEL_ID`.
  - Satu tombol per rentang, bukan picker di balik tombol: tiga preset muat di
    satu baris, dan satu interaksi tambahan untuk membuka daftar berisi tiga
    itu menu tentang dirinya sendiri.

### Changed
- **Rentang gaji berjangkar, bukan bergulir.** `7 hari` dulu berarti tujuh hari
  mundur dari detik kamu bertanya — pertanyaan yang sama menjawab beda tiap jam,
  dan gaji yang masuk Sabtu pagi keluar dari "minggu ini" pada Sabtu sore.
  Sekarang **sejak reset Sabtu**, **bulan ini**, atau **semua**. Nilai lama
  (`7d`, `30d`) jatuh ke "minggu ini", tidak mati.

### Fixed
- **Gold drop tanpa pengecualian dibayarkan ke siapa pun.** "Tidak ada yang
  dikecualikan" disimpan sebagai `excludedUserId: null`, dan gaji headline
  dihitung dengan `uid = null` — jadi `g.excludedUserId !== uid` membaca
  `null !== null` dan membuang entri itu. Setiap gold ÷7 tanpa pengecualian,
  yaitu sebagian besarnya, hilang dari gaji semua orang. Panel menampilkan
  gold-nya, rumus mencetak `258 ÷ 7`, dan angka di sebelahnya dihitung tanpa
  itu. Tidak ada error, cuma angka yang lebih kecil.
- **`_lzDigestTest.js` menguji 08:00 WIB padahal digest-nya jam 00:00.** Suite
  yang selalu merah berhenti dibaca, dan itu lebih buruk daripada tidak punya
  test — kerusakan berikutnya ikut tersembunyi di baliknya.

## [1.25.0] — 2026-08-09

### Added
- **Tujuh nest yang tadinya tidak punya jalur signup sekarang punya:** TKN
  Challenge, PKN Hell & Challenge, ABN Hell & Challenge, GN Hell & Challenge.
  Tiga di antaranya ada di board dengan bounty nyata — tercatat, tampil, dan
  mustahil dibuatkan party, jadi Done tidak pernah menyala dan quest-nya terbuka
  selamanya.
- **Role picker di `ROLE_PICK_CHANNEL_ID`** — satu pesan, dua tombol, dan tombol
  yang sama untuk masuk dan keluar. Role menu yang tidak bisa dibatalkan itu
  yang tidak akan ditekan orang.
  - Balasannya menyebut **semua role yang kamu punya sekarang**, bukan cuma yang
    barusan diubah — itu satu-satunya hal yang reaction lakukan lebih baik, dan
    reaction sama sekali tidak bisa memberi kabar kalau gagal.
  - Role ditulis sebagai mention, jadi Discord merendernya dengan warna role itu
    sendiri. Tidak ada yang di-ping.
  - Role yang env-nya belum diset tidak ditampilkan, bukan muncul lalu gagal
    saat ditekan. Penolakan Discord menyebut sebabnya: role bot harus di atas
    role yang dibagikan.
  - Butuh `ROLE_PICK_CHANNEL_ID`, `RAID_ROLE_ID`, `NEST_ROLE_ID`.

### Changed
- **Semua nest pakai P1–P4 + tombol job**, termasuk TKN Hell yang tadinya
  `Healer · DPS · Support · Sup-DPS` masing-masing 1. Role bernama dengan cap
  per-role cuma pernah menolak orang dari nest yang tidak peduli siapa yang
  datang.
- **Pilihan `/start` `/raid` `/nest` `/marathon` dibangkitkan dari
  `templates.js`**, bukan empat daftar yang dijaga tangan. Itu yang membuat
  `SDN HC` bertahan di menu berminggu-minggu setelah template-nya hilang.
  `/memo` tetap di luar — dia punya opsi kombinasi yang tidak bisa dilewatkan
  pemilih event generik.

## [1.24.0] — 2026-08-09

### Changed
- **Tiap quest yang ter-stack menyebut clear-nya di panel marathon.** Marathon
  itu dua run, jadi `Unique · Weapon` saja membuat orang menebak apakah itu
  jatuh di clear HC atau Classic — dua malam yang berbeda untuk datang. Panel
  satu nest tidak mengulanginya; judulnya sudah menyebut nest-nya.
- **`Stack 1/6` jadi `Bounty stacked: 1/6`** — `Stack` sendirian tidak
  memberitahu apa yang dihitung. `· khusus bounty` jadi `· bounty only`.
- **Board pecah ke embed berikutnya hanya kalau satu embed hampir penuh**, bukan
  sejumlah nest tetap per embed. Nomor halaman (`· 1/2`) muncul hanya kalau
  memang ada halaman lain.
  - Batas sebenarnya 6000 karakter untuk seluruh pesan, bukan 4096 per embed,
    dan Discord menolak pesan yang lewat batas **seluruhnya** — board-nya bukan
    terpotong tapi tidak muncul sama sekali. Jadi ekornya dibuang, embed
    terakhir menyebut berapa bagian yang hilang, dan log mencatatnya.
  - Diukur dengan data produksi: 17 quest terbuka = 1361 karakter, ~80 per
    quest. Satu pesan memuat sekitar 75 quest.

## [1.23.0] — 2026-08-09

### Added
- **`SDN HC` punya template lagi.** `/start` dan `/raid` menawarkannya sejak dulu
  tapi template-nya sudah tidak ada — memilihnya mencari sesuatu yang tidak
  pernah ditemukan. Role dan `hcGoldSplit` mengikuti raid HC lainnya.

### Changed
- **Tawaran karakter bounty jadi modal**, bukan pesan ephemeral. Di channel yang
  ramai ephemeral ke-scroll hilang, dan orangnya tidak pernah tahu dia punya
  bounty untuk di-claim. Kursinya diambil begitu modal terbuka, jadi
  meng-dismiss tetap membuatmu masuk party — cuma tanpa bounty tercatat.
- **Hanya karakter yang role-nya cocok dengan kursi yang ditawarkan.** Kursi
  menentukan karakter mana yang dimainkan, jadi menawarkan FU ke orang yang
  duduk di SM/DA menawarkan sesuatu yang mustahil — dan memilihnya akan
  mencatatkan quest ke run yang karakter itu tidak pernah ikuti.

### Removed
- `FORUM_TAG_SDN_CORE` — tidak ada template yang menamainya.

### Fixed
- **Done menghapus run-nya sebelum punya tempat menaruhnya.** Event dihapus dulu
  dan thread loot dibuat setelahnya, jadi `threads.create` yang ditolak
  meninggalkan panel mati, tanpa thread, tanpa cara menekan Done lagi, dan
  "Something went wrong" sebagai satu-satunya petunjuk. Sekarang event bertahan
  sampai thread-nya ada.
- **Forum tag yang bukan milik forum itu membatalkan seluruh pembuatan thread.**
  Sekarang tag yang tidak dikenal dibuang (thread tetap jadi) dan dicatat ke log
  lengkap dengan nama env-nya.
- **`closePreview` di-import di `doneRun.js` tapi tidak pernah dipanggil**, jadi
  tiap run yang selesai meninggalkan preview yang masih terlihat terbuka.
- **Memilih karakter bounty me-reset kelas MT.** `seatUser` membangun ulang
  kursi dari nol, jadi Destroyer yang sudah dipilih di modal berubah jadi `null`.

## [1.22.0] — 2026-08-09

### Added
- **`✅ Mark done` / `↩️ Undo` di panel.** Sebelumnya bot cuma tahu quest selesai
  kalau host menekan Done di panel signup, jadi party yang dibentuk di chat
  meninggalkan quest itu `○` selamanya — dan board terus menyuruh orang mengajak
  seseorang yang sudah kelar. Itu memakan waktu orang lain, bukan cuma bikin
  angka meleset.
  - Satu select berisi semua quest terbuka dari seluruh roster, bisa pilih
    beberapa sekaligus. Tidak menambah asumsi kepercayaan baru: quest-nya sendiri
    memang dilaporkan sendiri sejak awal.
  - Ditandai `runId: "manual"`, bukan id panel run, supaya "ditutup lewat panel"
    dan "dilaporkan sendiri" tetap bisa dibedakan.
  - Tombolnya mati kalau tidak ada yang bisa dikerjakan — nol terbuka berarti
    tidak ada yang bisa diselesaikan, nol selesai berarti tidak ada yang bisa
    dikembalikan.

### Changed
- **Pemilih kelas MT jadi modal**, bukan pesan ephemeral berisi select. Submit-nya
  tidak meninggalkan apa pun untuk dibaca atau di-dismiss, karena panel di
  bawahnya sudah menunjukkan kursinya. Cek "party baru saja penuh" tetap
  dijalankan saat submit — party bisa terisi sementara orangnya masih memilih.

### Removed
- `select_subrole_` dan `handleSubRoleSelect` — tidak ada lagi yang memanggilnya.

## [1.21.0] — 2026-08-09

### Added
- **Approve sekaligus membuatkan thread-nya.** Yang baru disetujui tidak sedang
  menunggu di depan tombol, jadi thread-nya muncul sendiri di sidebar mereka.
  Gagal membuat thread tidak membatalkan persetujuan — role sudah terpasang dan
  tombolnya masih bisa ditekan sendiri.
- **Panel dikelompokkan per akun game.** Nama akun naik jadi judul, jadi tidak
  diulang di tiap baris karakter. Satu grup bukan pengelompokan: roster dengan
  satu akun, atau tanpa akun sama sekali, tidak dapat judul.

### Removed
- **`/bounty-char apply`** — tombol `🎯 Create My Thread` sudah mengajukan atas
  nama mereka, jadi command-nya cuma jalur kedua untuk didokumentasikan dan
  dijaga.

### Fixed
- **Karakter akun ter-link kehilangan role-nya di board.** Board mengelompokkan
  orang pakai akun primary, sementara tabel roster masih dikunci pakai akun yang
  benar-benar mendaftarkan karakternya — semua pencarian meleset dan board
  mencetak `?` untuk karakter yang role-nya terbaca normal di panel.
- **Huruf akun dinomori per dokumen, bukan per orang.** Dua akun ter-link
  masing-masing mulai lagi dari `A`, jadi dua akun game berbeda bisa tercetak
  `akun A` bersebelahan.
- **Hanya `Unknown Channel` yang berarti thread dihapus.** Sebelumnya semua
  kegagalan dianggap penghapusan, jadi rate limit atau gangguan sesaat membuat
  catatannya dibuang — dan penekanan berikutnya membangun thread **kedua** di
  samping yang masih hidup, meninggalkan panel lama yang tidak pernah ter-update.
- **Pemilih akun di modal link membaca Collection sebagai array**, jadi
  `Belum pilih akun` selalu muncul betapa pun telitinya memilih.

## [1.20.0] — 2026-08-09

### Added
- **Tombol `🎯 Create My Thread` sekarang sekaligus mengajukan.** Belum punya
  role Bounty Hunter? Menekannya mengirim pengajuan, bukan menolak lalu
  menyuruh mengetik `/bounty-char apply`. Command-nya tetap ada sebagai
  cadangan — keduanya memanggil fungsi yang sama.
  - Menekan lagi sambil menunggu **tidak** mengirim salinan kedua ke admin.
    Catatannya hilang sendiri begitu role-nya terpasang.
- **Tombol `✅ Approve` / `✖️ Decline`** di pesan pengajuan. Sekali tekan: role
  terpasang, pengajuan tertutup, pesannya diganti jadi catatan siapa yang
  menyetujui. Butuh izin **Manage Roles** di role bot, dan role bot harus
  berada **di atas** Bounty Hunter — Discord menolak mengelola role yang
  sederajat atau lebih tinggi dari role bot sendiri. Penolakan itu disebut apa
  adanya, dan pengajuannya dibiarkan terbuka untuk dicoba lagi.
  - Yang boleh memutuskan: siapa pun dengan izin Manage Roles. Diperiksa dari
    **izinnya**, bukan nama role-nya, jadi tetap benar waktu daftar staf berubah
    — dan channel staf bukan izin, siapa pun yang bisa melihat pesannya bisa
    mengkliknya.

### Fixed
- **`🎯 Khusus bounty` host-only di handler, bukan cuma diabu-abukan.**
  `setDisabled` menahan klik di sisi client; itu bukan izin, dan tombol ini
  menentukan siapa yang boleh masuk party. Id-nya juga jadi satu konstanta —
  sebelumnya ditulis literal di builder, router dan daftar host-only, sehingga
  ganti nama di dua tempat akan membukanya untuk semua orang tanpa error.
- **`/bounty-char apply` tidak membungkus `channel.send`.** Mengambil channel
  tidak butuh izin, mengirim butuh — jadi bot yang bisa melihat channel admin
  tapi tidak bisa memposting di situ sampai ke pengaju sebagai "Something went
  wrong". Sekarang menyebut izin mana yang kurang.

## [1.19.0] — 2026-08-09

### Added
- **Link akun Discord** — satu orang, beberapa akun, satu roster. Tombol
  `🔗 Link account` di panel; akun utama mengundang, **akun yang diundang yang
  memutuskan**, karena panelnya yang berubah.
  - Undangannya **data, bukan kiriman**: menunggu di panel akun yang diundang.
    DM tetap dikirim sebagai pemberitahuan saja — DM bisa tertutup, dan
    pengganti yang biasa dipakai (pesan publik) justru mengumumkan akun kedua
    seseorang ke seluruh guild.
  - Tidak ada data yang dipindah antar dokumen. Baca mengembalikan gabungan,
    tulis kembali ke dokumen asal tiap baris — jadi `🔓 Unlink` gratis dan tidak
    ada roster yang perlu diadu.
  - Board dan reminder menyebut satu mention per orang, bukan per akun.
  - Karakter bernama sama yang terdaftar di dua akun sebelum di-link digabung,
    lalu menyatu ke satu dokumen — kalau tidak, batas 6 quest dihitung dari
    pandangan sebagian dan bisa terlampaui.

## [1.18.0] — 2026-08-09

### Added
- **Reminder Kamis 20:00 WIB** di `BOUNTY_BOARD_CHANNEL_ID` — menyebut orangnya,
  bukan quest-nya, karena board sudah mendaftar isinya. Kalimatnya "belum
  tercatat", tidak pernah "belum selesai": bot cuma tahu quest selesai kalau
  run-nya ditutup lewat panel signup, jadi yang clear di party dadakan tetap
  ikut terdaftar. Digerbangi `BOUNTY_REMINDER_ENABLED=true`, saklarnya sendiri.
  Sekaligus menjaga thread pribadi tidak ter-archive — dua sentuhan seminggu
  (Kamis dan reset Sabtu) membuat jeda terpanjang ~4 hari.
- **Dropdown di modal quest** — Character, Dungeon, Rarity, Scroll, plus kotak
  "Type more quests". 14 dari 19 karakter cuma pegang 1 quest, jadi dropdown
  menutup kasus umum dengan jumlah interaksi yang sama seperti mengetik, tanpa
  sintaks dan tanpa kemungkinan salah parse. Card box digabung ke rarity supaya
  muat di 5 kolom.
- **Ambiguitas dijawab dropdown.** `hc u wep` yang cocok ke tiga nest sekarang
  membalas dengan tiga kandidat; sekali klik selesai. Nilai opsinya adalah quest
  yang sudah utuh, jadi tidak ada state yang disimpan sambil menunggu dipilih.
  Baris yang tidak punya kandidat tetap pesan teks.
- **Blok Marathon GDN** di board — jumlah per clear (`HC 0 · Classic 1`) plus
  baris per karakter dengan role-nya. `HC 0` langsung memberi tahu marathon
  minggu ini tidak jalan.

### Changed
- **Board dipisah** jadi dua embed dalam satu pesan: Raid (8 orang) dan Nest
  (4 orang).
- **Nama akun tidak lagi tampil di board.** Diganti huruf per orang (`akun A`,
  `akun B`) yang konsisten di seluruh board — pembaca cuma perlu tahu dua
  karakter bisa jalan bersamaan atau tidak.
- **Nama nest disingkat** di board dan panel: `GDN HC`, `DDN Memoria 4`. Diambil
  dari alias pertama, jadi tidak ada daftar kedua yang harus dijaga.
- **Label panel jadi Inggris**, kalimat penjelas tetap Indonesia.
- Pesan pinned di `#my-bounty` ditulis ulang dalam bahasa Inggris.

### Removed
- **Baris sisa claim di panel.** Ikut party 3-stack menghabiskan 3 claim bahkan
  pada karakter yang tidak pegang quest, dan party di luar panel tidak pernah
  terlapor — jadi angkanya selalu kelebihan, arah yang bikin orang
  merencanakan run yang tidak bisa di-claim.
- **`/bounty-char list`** — panel sudah menampilkan roster-nya.

### Fixed
- **Pesan pinned `#my-bounty` tidak pernah ditulis ulang.** `syncEntry` cuma
  memastikan pesannya ada; teksnya tinggal di kode, jadi tiap perubahan tidak
  pernah sampai. Sekarang di-edit tiap boot.
- `rankOf` di-import dari modul yang salah pada reminder — boot tetap sukses,
  dan crash-nya baru datang Kamis malam.

## [1.17.0] — 2026-08-09

### Added
- **Panel bounty** — satu pesan yang menampilkan roster, quest minggu ini, sisa
  claim dan reward, dengan semua aksinya sebagai tombol. Menggantikan membaca
  `/bounty-me` lalu `/bounty-char list` lalu mengetik command ketiga untuk
  mengubah apa pun. Muncul dari `/bounty-me`, dan permanen di thread pribadi.
- **Thread pribadi** — satu tombol di `BOUNTY_ME_CHANNEL_ID` membuat thread
  privat per orang dengan panel ter-pin di dalamnya. Sekali pencet seumur hidup;
  setelah itu thread-nya ada di sidebar dengan datanya sudah ter-render.
  Butuh izin **Create Private Threads** + **Manage Threads**. Tidak diset =
  fitur mati, sisanya normal.
- Tombol panel membawa pemiliknya dan tiap penekanan dicek — Discord tidak
  memberi izin per-tombol, dan moderator bisa melihat semua thread privat.

### Changed
- `/bounty` tidak lagi punya opsi `character`; pemilih karakternya ada di dalam
  modal. Ini yang membuat tombol bisa membukanya.
- **Akun game jadi opsional.** Dulu wajib diketik, padahal akun baru berarti
  apa-apa setelah ada karakter kedua. Begitu akun sudah ada, kolomnya jadi
  daftar pilihan — teks bebas adalah tempat typo lahir, dan dua ejaan berbeda
  membuat bot mengira kedua karakter itu bisa jalan bersamaan.
- Pesan yang muncul dari panel diterjemahkan ke Indonesia dan tidak lagi
  menyuruh mengetik slash command yang panelnya justru menggantikan.

### Fixed
- **`Stack 0/6` pada party yang sudah terisi.** `fitToStack` mengembalikan
  hitungan sementara panel membaca daftar quest-nya; `angka?.length` itu
  `undefined`, jadi kursi tersaring keluar dan yang join diberi tahu dia cuma
  numpang — padahal quest-nya tercatat benar sejak awal.
- **Tombol panel tidak pernah sampai ke handler-nya.** Router menyimpan salinan
  daftar prefix sendiri. Daftarnya sekarang diturunkan, bukan diduplikasi.
- Toggle `khusus bounty` hanya membalik satu dari dua flag, meninggalkan panel
  setengah jadi: tombol role hilang, batas per-role masih hidup.
- Kegagalan pencatatan bounty saat join tidak lagi ditelan diam-diam.

### Removed
- `buildCharSelect`, `handleBountyCharSelect`, autocomplete `/bounty`, dan
  scaffolding `bountyWeekThreads` yang tidak pernah terpakai.

## [1.16.0] — 2026-08-08

### Added
- **Group Bounty** — pencatatan bounty quest mingguan, papan pengumuman, dan
  party signup yang sadar bounty.
  - `/bounty-char add|edit|list|remove|apply` — roster karakter (nama, role,
    DPS tier, akun game). `add` untuk baru, `edit` untuk mengubah sebagian.
  - `/bounty character:<nama>` — catat quest minggu ini lewat modal, satu baris
    per quest: `ddn hc u wep`. Urutan token bebas, frasa seperti `memo 1` dan
    `rare legendary` dikenali, salah ketik nest dikasih lima tebakan terdekat.
  - `/bounty-me` — quest, sisa claim, dan reward yang sudah didapat.
  - **Bounty board** di `BOUNTY_BOARD_CHANNEL_ID` — satu pesan per minggu,
    dikirim saat reset Sabtu 08:00 WIB, di-edit tiap ada data baru, dihapus dan
    diganti minggu berikutnya. Dikelompokkan per nest → per orang → per
    karakter. Read-only, tanpa tombol.
  - **`closed_to_bounty`** di `/start`, `/raid`, `/marathon`, `/memo`, `/nest` —
    sembilan tombol role jadi satu tombol Join, batas per-role dimatikan, dan
    hanya yang punya data bounty minggu ini yang bisa masuk. Ada toggle
    host-only untuk membuka kembali ke semua orang.
  - Klik role di signup mana pun sekarang menanyakan karakter mana yang kamu
    bawa kalau kamu punya quest di lebih dari satu. **Tekan Done = seluruh
    party ditandai selesai** — satu-satunya tempat quest ditandai terpakai.
  - Gerbang opsional `BOUNTY_HUNTER_ROLE_ID` + `/bounty-char apply` yang kirim
    pengajuan ke `BOUNTY_ADMIN_CHANNEL_ID`. Role dipasang manual, bot tidak
    butuh Manage Roles. **Kalau role-nya tidak diset, semua orang tetap bisa
    pakai.**
- **Pemisahan channel signup** — panel dikirim ke `PUBLIC_RAID_CHANNEL_ID` (8
  slot) atau `PUBLIC_NEST_CHANNEL_ID` (4 slot), dengan preview hidup + link di
  channel tempat command diketik. **Env var kosong = panel tetap di tempat
  command diketik**, jadi tidak ada yang berubah sebelum channel-nya siap.

### Changed
- **Daftar role di panel signup** jadi kolom rata (`` `Ice Stacker` @user ``),
  lebar mengikuti role event itu sendiri. `*(empty)*` jadi `—`.

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
