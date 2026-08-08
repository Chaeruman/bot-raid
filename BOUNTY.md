# 🎯 Group Bounty — Command

| Command | Buat apa |
|---|---|
| `/bounty-char add` | Daftar char baru. Butuh `name` `role` `dps` `account`. |
| `/bounty-char edit` | Ubah char yang udah ada. Isi yang mau diganti aja. |
| `/bounty-char list` | Lihat char kamu. |
| `/bounty-char remove` | Hapus char. |
| `/bounty-char apply` | Ajukan role Bounty Hunter ke admin (kalau server-nya ngunci fitur ini). |
| `/bounty` | Catat quest minggu ini. Char-nya dipilih di dalam form. Tambah `replace:true` kalau mau ulang dari nol. |
| `/bounty-me` | Quest kamu, sisa claim, reward yang udah dapet. |
| `closed_to_bounty:true` | Option di `/raid` `/start` `/marathon` `/memo` `/nest`. Bikin party khusus bounty. |

## Nulis quest — 1 baris 1 quest
```
ddn hc u wep          DDN HC · unique · scroll weapon
gdn cl leg acc box    GDN Classic · legendary + card box · accessory
memo 1 rl wtd         Memoria 1 (nggak usah tulis ddn) · rare legendary
```
Urutan bebas. Rarity `u` `leg` `rl` · scroll `wep` `wtd` `acc` `arm` · card box `box`.
Salah ketik nest → bot kasih tebakan. Lupa varian → bot nanya.

## Yang jalan sendiri
- **Board** di `#bounty-board` — muncul tiap Sabtu 08:00, update tiap ada yang ngisi. Cuma buat dilihat, nggak ada tombol.
- **Panel signup** nongol di `#public-raid` (8 orang) / `#public-nest` (4 orang), preview + link ketinggalan di channel tempat kamu ketik command.
- **Pas join**, kalau punya quest di nest itu bot nanya bawa char mana. Pilih dulu baru masuk party.
- **Host pencet Done** → bounty satu party ketandai selesai, hilang dari board. Nggak pencet = nggak ketandai.

## Sering bikin bingung
- `Stack 3/6` = 3 quest ke-share, tiap orang pakai 3 claim dan dapat semuanya. Maks 6 karena jatah seminggu emang 6.
- Quest ke-7 nggak masuk stack, tetep di board buat run lain.
- 1 char 2 quest di nest sama → dua-duanya kelar sekali clear, kehitung 2 slot.
- Nggak punya quest di nest itu tapi ikut → tetep dibayar.
- `account` = akun game. Char satu akun nggak bisa jalan barengan, beda akun bisa.
