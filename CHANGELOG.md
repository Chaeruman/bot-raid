# Balance Bot — Update Terbaru

- **Command terpisah untuk raid dan marathon** — sekarang ada `/raid` dan `/marathon` selain `/start`

- **Event baru** — SDN HC dan SDN Core sudah masuk sebagai pilihan di `/raid`

- **Urutan run marathon langsung keliatan** — panel party untuk marathon menampilkan urutan run-nya, misalnya GDN HC > GDN Classic > SDN HC

- **Loot tracking otomatis** — setelah run selesai, bot langsung bikin panel loot di thread. Seller bisa catat item drop dan gold boss, set harga, dan bot otomatis hitung berapa yang harus dibayar tiap orang sudah dipotong biaya stamp

- **Pencatatan item detail** — item seperti armor, weapon, dan accessory bisa dicatat lengkap dengan bagian, tipe, dan job class

- **Perhitungan gold otomatis** — gold dari boss langsung dibagi sesuai jumlah member, HC dibagi 7 dan yang lain dibagi 8, tanpa perlu hitung manual

- **Status bayar per member** — host bisa tandai siapa yang member yang telah dibayar langsung dari panel

- **Panel loot manual** — kalau butuh catat loot di luar alur run biasa, tinggal pakai `/loot`

---

# Cara Pakai

**Memulai party**

Gunakan `/raid`, `/marathon`, atau `/start` lalu pilih event yang mau dijalankan. Bot akan mengirim panel party ke channel. Member yang mau ikut tinggal klik tombol role yang sesuai.

**Setelah run selesai**

Host klik tombol Done di panel party. Bot otomatis membuat thread baru berisi ringkasan siapa saja yang ikut run tersebut, sekaligus panel loot langsung tersedia di dalam thread itu.

Di sini ada dua hal yang bisa dilakukan bersamaan. Pertama, judul thread bisa diganti langsung oleh member yang ikut run, biasanya diisi nama seller untuk run tersebut. Kedua, host memilih seller lewat panel loot supaya pencatatan item bisa dimulai.

**Mencatat loot**

Setelah seller dipilih, seller bisa mulai tambahkan item yang drop. Item dari raid dicatat dulu, lalu kalau ada yang masuk lewat mail, pindah ke sumber Mail dan catat lagi di sana. Setelah semua item masuk, seller isi harga tiap item. Bot langsung hitung totalnya.

Untuk gold drop dari boss, seller tinggal klik Add Gold dan masukkan jumlahnya. Bot otomatis bagi sesuai jumlah member.

**Pembayaran**

Setelah semua tercatat, ringkasan di panel sudah menampilkan berapa yang harus dibayar tiap orang. Host tinggal tandai siapa yang sudah bayar lewat tombol Mark Paid.
