# Cara Pakai Loot Panel (Lengkap)

Dokumen ini menjelaskan loot panel dari awal sampai selesai — alur kerjanya, dan terutama **cara mengetik di Type Items** karena di situ semua keajaibannya. Ditulis santai, anggap saja saya lagi ngajarin kamu langsung.

---

## Gambaran besar dulu

Loot panel itu papan kerja untuk membagi hasil jualan satu run. Urutannya kira-kira begini, dan tombol-tombolnya memang sengaja disusun mengikuti urutan ini dari kiri ke kanan, atas ke bawah:

1. **Tentukan seller** — siapa yang pegang barang dan jualan.
2. **Masukkan item** yang didapat (dan gold kalau ada).
3. **Kasih harga** tiap item.
4. **Tandai siapa yang sudah dibayar.**
5. Panel **menutup sendiri** begitu semua orang dibayar.

Selama panel terbuka, embed-nya selalu nunjukin kondisi terbaru: daftar item, gold, ringkasan gaji, dan status siapa yang sudah/belum dibayar. Jadi kamu nggak perlu mikir "ini udah sampai mana" — tinggal lihat panelnya.

Satu hal soal izin yang penting dipahami dari awal: **seller** yang ngurus barang & harga (Add Item, Price, Add/Remove Gold), sedangkan **host** yang ngurus orang (Set Seller, Add/Remove Member, Close). **Mark Paid** boleh dua-duanya. Kalau kamu pencet tombol yang bukan jatahmu, bot bakal nolak dengan pesan ⛔ — jadi aman, nggak akan kacau.

---

## Langkah 1 — Set Seller

Begitu loot panel muncul (otomatis setelah Done Run, atau dari `/loot`), tombol pertama yang aktif cuma **👤 Seller**. Sisanya ngunci dulu sampai seller ditentukan, karena semua aksi item butuh tahu siapa sellernya.

Pencet **👤 Seller** → muncul dropdown isi anggota party → pilih satu. Habis itu langsung muncul kotak isian kecil: **nama in-game (IGN) seller**. Isi nama karakternya. Gunanya dua: ditampilkan di panel, dan dipakai untuk mengganti tulisan `(seller)` di judul thread jadi nama beneran.

Setelah seller di-set, tombol-tombol lain baru kebuka.

---

## Langkah 2 — Masukkan item: **✍️ Type Items** (cara utama)

Ini bagian intinya. Pencet **✍️ Type Items**, muncul kotak teks besar. Aturannya sederhana:

> **Satu baris = satu item.** Atau pisahkan beberapa item dalam satu baris pakai tanda `|`.

Bot membaca tiap baris dan mencoba menebak item apa yang kamu maksud. Kamu nggak perlu nulis nama persis — ada banyak singkatan yang dikenali. Yang cocok langsung masuk; yang ragu-ragu dia tanya balik; yang nggak ketemu dia laporin biar kamu betulin. Jadi salah ketik nggak bikin semua gagal — cuma baris yang bermasalah aja.

Sekarang kita bedah per jenis barang.

### Rune (Thorns / Storm / Forest / Hot Sand)

Tiga hal yang perlu ada: **jenis rune**, **tier** (L atau U), dan **kondisi** (junk atau good).

- **Jenis** boleh ditulis macam-macam, ngambil dari nama lengkapnya:
  - Thorns → `thorns`, `thorn`, atau `destroy`
  - Forest → `forest` atau `guardian`
  - Storm → `storm` atau `triangular`
  - Hot Sand → `hot`, `sand`, atau `circular`
- **Tier:** `l` / `lower` / `legend` untuk L, dan `u` / `upper` / `unique` untuk U.
- **Kondisi:** `junk`, atau `good` / `perfect`.

Jadi ini semua valid dan menghasilkan barang yang sama:

```
thorns l junk
thorn destroy legend junk
```

Nah, sering kejadian orang lupa nulis junk/good. Kalau itu terjadi, bot **nggak nebak sembarangan** — dia tampilkan pilihan bernomor:

```
thorn destroy legend
  1) Thorns L (Junk)
  2) Thorns L (Good/Perfect)
```

Tinggal Resolve (cara Resolve dijelaskan di bawah). Praktis kalau kamu lagi buru-buru ngetik dulu, mikir junk/good belakangan.

### Accessory

Polanya: **dungeon → tier → tipe → subtipe.**

- **Tier:** `legend` / `l` / `hunter` / `hc` = **Legend**, dan `unique` / `u` / `squad` = **Unique**. (`hc` masuk karena legend memang drop dari dungeon HC, dan kadang kita panggil "gdn hc".)
- **Tipe:** `ring`, `neck` (necklace), `ear` (earrings).
- **Subtipe Ring:** `atk` / `atp` / `attack`, `magic` / `matk` / `mtp`, `hyb` / `hybrid`.
- **Subtipe Neck & Ear:** tulis kata aslinya — `int vit`, `agi int`, `str agi`.

Contoh:

```
gdn squad ring atk        → GDN Unique · Ring (Attack)
gdn hc neck int vit       → GDN Legend · Necklace (INT VIT)
ddn hunter ear agi int    → DDN Legend · Earrings (AGI INT)
```

Bentuk panjang juga tetap jalan kalau kamu lebih nyaman: `gdn unique accessory ring hybrid`.

### Named Equipment (item yang punya nama sendiri)

Armor/weapon yang punya nama unik (ratusan item) cuma bisa lewat **ketik**, bukan dropdown — karena dropdown Discord cuma muat 25 pilihan. Caranya gampang, sebut dungeon-nya lalu kata kunci namanya:

```
gdn (chakram)      ← pakai kurung
gdn chakram        ← tanpa kurung juga boleh
gdn chak           ← potongan kata pun dikenali
GDN Sword          ← atau nama lengkap persis
```

Dua catatan:
- Kalau kata kunci kamu cocok ke beberapa item (misal `gdn (bow)` kena Shortbow/Longbow/Crossbow), bot kasih pilihan bernomor — tinggal Resolve.
- Khusus `gdn armor` atau `ddn armor` (cuma itu, tanpa embel-embel) → langsung jadi piece **Cleric "Armor"**, karena nama aslinya memang persis "GDN Armor".

### Equipment biasa (generic DDN/GDN Armor & Weapon)

Kalau bukan item bernama, sebutkan **dungeon, jenis, class, part**:

```
gdn armor warrior head
ddn weapon kali main
```

Class: Kali, Academic, Sorceress, Warrior, Cleric, Archer, Assassin. Part armor: Head/Top/Lower/Gloves/Shoes; weapon: Main/Second.

### Fragment

```
gdn fragment x5
ddn fragment
```

---

## Hal-hal yang bisa dicampur di tiap baris

Ini yang bikin Type Items enak: beberapa "bumbu" bisa ditempel di baris mana pun.

**Jumlah (quantity).** Tulis `x5`, `5x`, atau `5` di mana saja:
```
gdn fragment x5
thorns l junk x2
```

**Catatan (note).** Apa pun setelah tanda `#` jadi catatan yang nempel ke item itu. Catatan ikut kebawa walaupun barangnya masih harus di-Resolve:
```
gdn (chakram) #buat Budi
thorns l junk #retak, jual murah
```

**Gold.** Gold juga boleh diketik di sini, bukan cuma lewat tombol:
```
gold 294/7 @ol
258/8
gold 1,000,000/8
```
Artinya: `jumlah / pembagi`. Pembagi cuma boleh **7** (HC) atau **8** (normal). Untuk **÷7 wajib men-tag satu orang yang TIDAK kebagian** pakai `@nama` — bot cocokkan dengan nama member di panel. Kalau ÷7 tapi lupa nge-tag, dia kasih peringatan supaya kamu lengkapi. Untuk ÷8 nggak perlu tag.

**Gabung semuanya dalam satu setoran:**
```
gdn (one piece) #priority
thorns l junk
gdn fragment x5
gold 294/7 @azka
258/8
```

---

## Langkah 2b — **📋 Browse Item** (alternatif buat HP)

Kalau lagi di HP dan males ngetik, pakai **📋 Browse Item**: pilih kategori → pilih item → (kalau perlu pilih class/part). Cocok untuk item katalog standar (rune, fragment, accessory, equipment generic). Tapi ingat, item **bernama** tetap hanya lewat Type Items.

---

## Langkah 3 — Kasih harga

Ada dua gaya, pilih sesuai selera:

**🏷️ Price All — sekaligus.** Modal kebuka sudah terisi daftar item bernomor. Tinggal ketik harga setelah tanda `=`:
```
1. GDN Chakram x1 = 50000
2. GDN Fragment x5 = 100000/8 #split berlima
3. GDN Armor (Priest) x1 = (50000+10000)*2
```
Baris yang kamu biarkan kosong setelah `=` → harganya nggak berubah. Jadi boleh isi sebagian sekarang, sisanya nanti (harga lama ikut muncul lagi pas kamu buka ulang).

**🏷️ Price One — satu per satu.** Pilih item dari dropdown → kotak harga + note. Setelah submit, picker-nya tetap terbuka untuk item berikutnya, sampai semua item ada harganya.

**Boleh pakai hitungan.** Di dua mode itu, kotak harga menerima rumus: `* + - /` dan kurung `()`:
```
50000*2          → 100000
100000/8         → 12500
(50000+10000)*2  → 120000
```
Hasilnya dibulatkan ke bawah. Koma (`50,000`) dan akhiran `g` (`50000g`) aman, tetap kebaca.

---

## Langkah 4 — Mark Paid & menutup

**✅ Mark Paid** — buka daftar member, centang yang sudah dibayar. Bisa **pilih beberapa sekaligus**. Begitu **semua** member tercentang, panel **menutup otomatis** jadi laporan final.

**🔒 Close Panel** — kalau host mau menutup manual. Syaratnya semua sudah dibayar dulu. Setelah ditutup, panel berubah jadi rekap final yang rapi (read-only, tombol hilang) dan datanya dibersihkan dari memori bot.

---

## Mengelola member

- **👥 Add Member** — dropdown cari nama, bisa pilih **banyak sekaligus**. Yang sudah ada di panel otomatis dilewati.
- **➖ Remove Member** — dropdown member panel, centang **beberapa** untuk dikeluarkan bareng.

---

## Soal Resolve (pilihan bernomor)

Setiap kali bot ragu — entah rune tanpa junk/good, atau keyword yang kena banyak item — dia kumpulin baris-baris itu dan tampilkan daftar bernomor lengkap dengan tombol **Resolve**. Pencet **Resolve**, lalu ketik nomor pilihan untuk tiap baris, dipisah koma. Contoh kalau ada dua baris yang nanya:
```
2, 1
```
Artinya baris pertama pilih opsi 2, baris kedua pilih opsi 1. Ketik `0` untuk melewati satu baris. Catatan yang tadi kamu tempel (`#…`) tetap ikut ke item yang akhirnya kamu pilih.

---

## Judul thread yang berubah sendiri

Thread loot punya judul yang ikut bergerak:
- Begitu **semua item sudah dihargai**, judul jadi `💵 <gaji per orang>g — <judul kamu>`.
- Begitu **semua sudah dibayar**, berubah jadi `✅ <gaji>g — <judul>`.

Kamu bebas rename judulnya manual; bot cuma mengganti bagian prefix `💵/✅` dan nama `(seller)`. Jadi kalau kamu kasih nama thread sesuai seller, itu tetap dipertahankan.

---

## Rumus gajinya (biar transparan)

```
Gaji/orang = ( total hasil item + gold÷8 − total stamp ) ÷ 8  +  ( gold÷7 ÷ 7 )
```

Orang yang kamu kecualikan dari gold ÷7 (lewat `@nama`) cuma dapat bagian `÷ 8`-nya, dan di panel ditandai khusus. Ringkasan di embed menampilkan perhitungan ini apa adanya, jadi semua orang bisa lihat angkanya dari mana.

---

## Lewat command (kalau tombol kurang praktis)

Setiap aksi panel juga bisa dipanggil pakai command, berguna kalau panelnya ke-scroll jauh:
```
/loot-action id:<Panel ID> action:<aksi>
```
**Panel ID** ada di footer embed loot panel. Aksinya sama persis dengan tombol (Type Items, Price All/One, Add Gold, Mark Paid, dll.) dan izinnya juga sama (seller/host dicek otomatis).

---

### Ringkasan satu layar

- **Seller** dulu → baru bisa input item.
- **Type Items**: satu baris satu item · `x5` jumlah · `#` catatan · `|` pemisah · gold `294/7 @nama` / `258/8`.
- Ragu? Bot **tanya bernomor** → **Resolve**.
- **Harga** boleh pakai rumus, pisah `=` (Price All).
- **Mark Paid** semua → panel **auto-close**.
