# Panduan Pemakaian Bot Raid GDN

Panduan lengkap untuk host, seller, dan member.

---

## 1. Slash Command

| Command | Fungsi |
|---------|--------|
| `/start event:<…>` | Buat panel signup party (semua event) |
| `/raid event:<…>` | Buat signup single raid |
| `/marathon event:<…>` | Buat signup marathon |
| `/nest event:<…>` | Buat signup nest |
| `/loot title:<…> [tim:<Tim 1/Tim 2>]` | Buat loot panel manual (di dalam salary thread) |
| `/loot-action id:<panelId> action:<…>` | Jalankan aksi loot panel lewat command |
| `/state` | (Co-Leader) lihat event & loot panel aktif |
| `/clear id:<…>` | (Co-Leader) hapus event/panel dari state |
| `/bounty-char add\|edit\|list\|remove\|apply` | Roster karakter bounty |
| `/bounty character:<…> [replace]` | Catat bounty quest minggu ini |
| `/bounty-me` | Quest, sisa claim, reward kamu minggu ini |

> **Catatan:** `/start`, `/raid`, `/marathon`, `/nest`, `/memo` punya opsi
> `closed_to_bounty` — lihat bagian 14.
>
> **Catatan:** `/loot` hanya bisa dipakai **di dalam salary thread**. Opsi `tim` mengisi member otomatis dari role tim (kamu harus punya role tim itu).

---

## 2. Panel Signup (raid / marathon)

- **Member:** klik tombol role untuk join. Role MT/MC akan minta pilih class (sub-role).
- **Cancel My Role:** keluar dari slot.
- **Host:**
  - 🔒 **Lock** — kunci party (tidak bisa join).
  - **Remove Member** — keluarkan member.
  - 🛑 **Cancel Run** — batalkan run.
  - ✅ **Done Run** — selesai → bot bikin **thread loot** + **loot panel**.

Setelah **Done Run**, pesan signup menampilkan link thread (`Thread: #…`) di bagian bawah embed + tombol **👤 Set Seller**.

---

## 3. Loot Panel — Tombol

```
Baris 1  [👤 Seller] [✍️ Type Items] [📋 Browse Item] [🗑️ Remove Item]
Baris 2  [🏷️ Price All] [🏷️ Price One] [💰 Add Gold] [🗑️ Remove Gold]
Baris 3  [👥 Add Member] [➖ Remove Member]
Baris 4  [✅ Mark Paid] [🔒 Close Panel]
```

**Siapa boleh apa:**
- **Seller:** Add/Remove Item, Price All/One, Add/Remove Gold.
- **Host:** Set Seller, Add/Remove Member, Close Panel. **Mark Paid** = host **atau** seller.

**Alur normal:** Set Seller → tambah item → set harga → add gold → Mark Paid → panel auto-close saat semua dibayar (atau Close manual).

---

## 4. Set Seller

Klik **👤 Seller** → pilih member → muncul modal **nama in-game (IGN)** seller.
IGN dipakai untuk mengganti placeholder `(seller)` di judul thread.

---

## 5. ✍️ Type Items — Format Ketik

Satu item per baris (atau dipisah `|`). Bisa campur item + gold.

### Rune (Thorns / Storm / Forest / Hot Sand)
- Kata kunci family: `thorns`/`thorn`/`destroy`, `forest`/`guardian`, `storm`/`triangular`, `hot`/`sand`/`circular`.
- Tier: `l`/`lower`/`legend`, `u`/`upper`/`unique`.
- Kondisi: `junk`, `good`/`perfect`.
- Kalau **junk/good lupa diisi** → bot kasih pilihan bernomor (1=Junk, 2=Good).

```
thorns l junk
thorn destroy legend good
storm triangular u junk
forest guardian l good
hot sand circular u junk
```

### Accessory
Format: `<dungeon> <tier> <type> <subtype>`
- Tier: `legend`/`l`/`hunter`/`hc` = Legend · `unique`/`u`/`squad` = Unique
- Type: `ring`, `neck` (necklace), `ear` (earrings)
- Subtype Ring: `atk`/`atp`/`attack`, `magic`/`matk`/`mtp`, `hyb`/`hybrid`
- Subtype Neck/Ear: `int vit`, `agi int`, `str agi`

```
gdn squad ring atk
gdn hc neck int vit
ddn hunter ear agi int
gdn unique accessory ring hybrid   (bentuk panjang juga boleh)
```

### Equipment biasa (DDN/GDN Armor & Weapon)
Format: `<dungeon> <armor/weapon> <class> <part>`
- Class: Kali, Academic, Sorceress, Warrior, Cleric, Archer
- Part armor: Head/Top/Lower/Gloves/Shoes · weapon: Main/Second

```
gdn armor warrior head
ddn weapon kali main
```

### Named Equipment (item bernama, modal-only)
- Pakai keyword: `gdn (chakram)` atau tanpa kurung `gdn chakram` / `gdn chak`.
- Atau nama lengkap persis: `GDN Sword`.
- `gdn armor` / `ddn armor` langsung = piece **Cleric "Armor"**.
- Kalau keyword cocok ke beberapa item → bot kasih pilihan bernomor (Resolve).

### Fragment
```
gdn fragment x5
ddn fragment
```

### Quantity & Note
- Jumlah: `x5`, `5x`, atau `5` di mana saja pada baris.
- **Note inline:** apa pun setelah `#` jadi catatan item.
```
gdn (chakram) #buat Budi
thorns l junk #retak
```

### Gold (lewat Type Items juga bisa)
- `gold 294/7` (HC ÷7) atau `258/8` (normal ÷8). Bisa pakai koma: `1,000,000/8`.
- **÷7 wajib tag 1 member yang TIDAK dapat:** `gold 294/7 @ol` (cocokkan dengan nama member di panel). Kalau tidak di-tag → muncul peringatan.

---

## 6. 📋 Browse Item

Versi tap (cocok untuk HP): pilih kategori → pilih item → (class/part kalau perlu).
Hanya untuk item katalog struktural; item **named** hanya lewat Type Items.

---

## 7. Harga Item

### 🏷️ Price All (sekaligus)
Modal terisi otomatis. Ketik harga setelah tanda `=`, note opsional setelah `#`:
```
1. GDN Chakram x1 = 50000
2. GDN Fragment x5 = 100000/8 #split
3. GDN Armor (Priest) x1 = (50000+10000)*2
```
- Baris yang dikosongkan setelah `=` → harga tidak berubah (bisa isi sebagian dulu).

### 🏷️ Price One (satu-satu)
Pilih item dari dropdown → modal harga + note. Picker tetap terbuka untuk item berikutnya, sampai semua punya harga.

### Kalkulasi harga (di kedua mode)
Boleh tulis rumus: `* + - /` dan kurung `()`.
```
50000*2        → 100000
100000/8       → 12500
(50000+10000)*2 → 120000
```
Hasil dibulatkan ke bawah. Koma & akhiran `g` ditoleransi.

---

## 8. Gold

- **💰 Add Gold** (tombol) — alur terpandu: pilih HC (÷7) / Normal (÷8), untuk ÷7 pilih member yang dikecualikan, lalu isi jumlah.
- **Lewat Type Items** — `gold 294/7 @nama` / `258/8` (lihat bagian 5).
- **🗑️ Remove Gold** — hapus entry gold.

---

## 9. Pembayaran & Tutup Panel

- **✅ Mark Paid** — centang member yang sudah dibayar (multi-select). Panel **auto-close** begitu semua dibayar.
- **🔒 Close Panel** — host menutup manual (wajib semua sudah dibayar). Setelah ditutup, panel jadi laporan final (read-only).

---

## 10. Member (Add / Remove)

- **👥 Add Member** — dropdown cari member, bisa pilih **beberapa sekaligus**.
- **➖ Remove Member** — dropdown member panel, bisa pilih **beberapa sekaligus**.

---

## 11. Resolve (pilihan bernomor)

Kalau ada baris yang ambigu (rune tanpa junk/good, atau keyword named cocok ke banyak item), bot menampilkan daftar bernomor + tombol **Resolve**. Klik Resolve → ketik nomor pilihan per baris, dipisah koma (`1, 2`), `0` untuk skip.

---

## 12. Judul Thread Otomatis

- Saat **semua item sudah diberi harga** → judul thread jadi `💵 <gaji>g — <judul>`.
- Saat **semua member sudah dibayar** → jadi `✅ <gaji>g — <judul>`.
- Kamu boleh rename judul manual; bot hanya mengganti prefix `💵/✅` dan nama seller `(seller)`.

---

## 13. Rumus Gaji

```
Gaji/orang = ( total item + gold÷8 − total stamp ) ÷ 8  +  ( gold÷7 ÷ 7 )
```
Member yang dikecualikan dari gold ÷7 hanya dapat bagian `÷ 8`.

---

## 14. 🎯 Group Bounty

Bounty quest mingguan. Reset tiap **Sabtu 08:00 WIB** bareng reset in-game.

### Daftar karakter (sekali aja)

```
/bounty-char add name:Chelssea role:FU dps:high account:1
```

- `role` — sama persis dengan tombol di panel signup (SM/DA, FU, Healer, MC, MT,
  Ice Stacker, Acro, Support, DPS). Ini yang nentuin slot kamu di party bounty.
- `dps` — high / good / low. Buat ngecek party sanggup clear apa nggak.
- `account` — akun game. **Char di akun yang sama nggak bisa jalan barengan**,
  beda akun bisa (misal dimainin orang lain). Autocomplete, tapi ketik yang baru
  juga langsung jadi.

Mau ubah? `/bounty-char edit name:Chelssea dps:good` — isi yang mau diganti aja,
sisanya nggak kesentuh. `add` khusus char baru.

### Catat quest — `/bounty character:<nama>`

Modal kebuka, **1 baris = 1 quest**:

```
ddn hc u wep
gdn cl leg acc box
memo 1 rl wtd
sdn core rl acc
tkn hell u arm
```

Formatnya: **nest + varian + rarity + scroll** (+ `box` kalau ada card box).

| Bagian | Pilihan |
|--------|---------|
| Nest | `ddn` `gdn` `sdn` `tkn` `pkn` `abn` `gn` (atau nama panjangnya) |
| Varian | `cl` `norm` `hc` `hell` `chal` `core` `1`–`4` |
| Rarity | `u` (unique) · `leg` (legendary) · `rl` (rare legendary) |
| Scroll | `wep` `wtd` `acc` `arm` |
| Card box | `box` |

- **Urutan bebas** — `u wep hc ddn` sama aja dengan `ddn hc u wep`.
- **`memo 1` nggak usah ditulis nest-nya** — cuma DDN yang punya Memoria.
- Salah ketik nest → bot kasih 5 tebakan terdekat.
- Lupa nulis varian → bot nanya yang mana (`ddn u wep` → Classic? HC? Memoria?).
- Mau ulang dari nol: tambah `replace:true`. Quest yang udah kelar tetap aman.

### Board

Muncul sendiri di channel bounty tiap Sabtu, ke-update tiap ada yang ngisi.
Isinya siapa punya quest di nest apa, dikelompokkan per orang. Nggak ada tombol
— cuma buat dilihat.

### Party bounty

```
/raid event:gdn_cl closed_to_bounty:true
```

Sembilan tombol role jadi **satu tombol Join**, dan cuma yang punya data bounty
minggu ini yang bisa masuk. Karakter yang kamu pilih nentuin slot-nya, jadi
batas per-role dimatikan — nggak ada yang ditolak gara-gara "FU udah penuh".

Host bisa bolak-balik lewat tombol **🎯 Khusus bounty** / **🔓 Buka untuk semua**.

Pas klik join, kalau kamu punya quest di nest itu bot nanya bawa char mana.
**Pilih dulu baru masuk party** — kalau menunya ditutup, kamu nggak jadi ikut.
Punya satu char doang? Langsung duduk.

### Selesai

Host pencet **Done** → bounty satu party ditandai selesai sekalian, quest-nya
hilang dari board. Nggak pencet Done = nggak ada yang ketandai (sama kayak loot
panel).

### Baca angka `Stack 3/6`

3 quest ke-share di run itu. Tiap orang yang ikut **pakai 3 claim dan dapat
ketiga-tiganya** — termasuk yang nggak punya quest di situ.

- Maksimal 6, karena jatah claim seminggu per karakter emang 6.
- Quest ke-7 **nggak masuk stack** — tetap di board buat run lain, nggak ditandai
  selesai.
- Satu char punya 2 quest di nest yang sama → dua-duanya kelar sekali clear,
  kehitung 2 slot stack.
- Marathon (GDN HC + CL) tetap **satu** batas 6, bukan 6 per varian.

Cek punyamu sendiri: `/bounty-me`.

### Kalau fitur ini dikunci

`/bounty-char apply` → pengajuan masuk ke admin → nunggu role Bounty Hunter
dipasang manual. Kalau server-nya nggak nyalain kunci, semua orang langsung bisa
pakai.
