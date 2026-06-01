# Balance Bot — Update Terbaru

- **Command terpisah untuk raid dan marathon** — sekarang ada `/raid` dan `/marathon` selain `/start`

- **Event baru** — DDN HC, SDN HC, dan SDN Core sudah masuk sebagai pilihan di `/raid`

- **Urutan run marathon langsung keliatan** — panel party untuk marathon menampilkan urutan run-nya, misalnya GDN HC > GDN Classic > SDN HC

- **Loot tracking otomatis** — setelah run selesai, bot langsung bikin panel loot di thread. Seller mencatat item drop dan gold boss, set harga jual, lalu bot hitung otomatis berapa gaji yang diterima tiap member setelah dipotong biaya stamp

- **Pencatatan item detail** — item seperti armor, weapon, dan accessory bisa dicatat lengkap dengan bagian, tipe, dan job class

- **Perhitungan gaji otomatis** — hasil jual item dibagi rata ke semua member. Gold boss juga dibagi otomatis, HC dibagi 7 dan yang lain dibagi 8

- **Status penerimaan gaji** — host bisa tandai siapa yang sudah menerima gajinya dari seller

- **Panel loot manual** — kalau butuh catat loot di luar alur run biasa, tinggal pakai `/loot`

---

# Tombol di Panel Party

- **Role (SM, FU, Healer, dst)** — klik untuk daftar ke slot tersebut. Tombol berubah warna kalau sudah penuh
- **Cancel My Role** — batalkan slot kamu sendiri
- **Lock Party** — host mengunci party, tidak ada yang bisa daftar atau keluar sampai dibuka lagi
- **Remove Member** — host memilih member tertentu untuk dikeluarkan dari party
- **Cancel Run** — host membatalkan run dan menghapus panel
- **Done** — host menandai run selesai. Bot otomatis membuat thread dan panel loot di dalamnya

---

# Tombol di Panel Loot

- **Seller** — host memilih siapa yang jadi seller untuk run ini
- **Add Item** — seller menambahkan item yang drop. Bot akan meminta pilihan kategori, lalu item spesifiknya, lalu detail seperti bagian armor atau tipe accessory
- **Add Gold** — seller mencatat gold drop dari boss. Untuk HC, bot akan tanya dulu siapa yang tidak dapat bagian gold, baru minta jumlahnya
- **Raid / Mail** — seller berpindah antara sumber Raid Drops dan Mail sebelum menambahkan item
- **Set Price** — seller mengisi harga jual per item. Bot langsung update perhitungan total per orang
- **Sudah Terima** — host menandai member yang sudah menerima gajinya dari seller
