# Okiya Online

Main Okiya berdua lewat internet. Tidak perlu login: satu orang membuat permainan, lalu membagikan **Game ID** (5 huruf/angka) atau link undangan ke lawannya.

## Yang dibutuhkan

- **Node.js** 18 atau lebih baru — https://nodejs.org
- **cloudflared** (gratis, tanpa akun untuk *quick tunnel*):
  ```
  winget install --id Cloudflare.cloudflared
  ```

## Menjalankan (Windows)

1. Klik dua kali `start-server.bat`. Saat pertama kali, file ini akan menjalankan `npm install`.
   Server berjalan di http://localhost:3000.
2. Klik dua kali `start-tunnel.bat`. Tunggu sampai muncul link seperti
   `https://kata-kata-acak.trycloudflare.com`. **Link itu yang dibagikan ke pemain.**
3. Buka link tersebut, isi nama, lalu klik **Buat permainan**. Bagikan Game ID atau tombol **Salin link** ke lawan.

Tanpa .bat (semua OS):

```
npm install
npm start                                   # atau: PORT=8080 npm start
cloudflared tunnel --url http://localhost:3000
```

## Menjalankan dengan Docker Compose

Butuh Docker Desktop (Windows/Mac) atau Docker Engine (Linux).

```
cp .env.example .env          # Windows: copy .env.example .env
docker compose up -d --build
docker compose logs tunnel    # cari baris https://....trycloudflare.com
```

Isi `.env.example` sudah mengaktifkan **quick tunnel** (`COMPOSE_PROFILES=quick`), jadi server dan
`cloudflared` jalan bersamaan. Tidak perlu memasang Node.js atau cloudflared di komputer.

| Mau apa | Perintah / pengaturan |
|---|---|
| Lihat link tunnel | `docker compose logs tunnel` |
| Hentikan | `docker compose down` |
| Perbarui setelah mengubah kode | `docker compose up -d --build` |
| Hanya lokal, tanpa tunnel | kosongkan `COMPOSE_PROFILES` di `.env` |
| Ganti port host | ubah `OKIYA_PORT` di `.env` |

**Alamat tetap (named tunnel):** di Cloudflare Zero Trust → Networks → Tunnels, buat tunnel jenis
*Cloudflared*, salin token-nya ke `TUNNEL_TOKEN` di `.env`, ubah `COMPOSE_PROFILES=named`, lalu di
*Public Hostname* arahkan domain ke service `http://okiya:3000`. Jalankan `docker compose up -d`.

Tanpa file `.env` pun bisa: `docker compose --profile quick up -d --build`.

## Catatan quick tunnel

- Link `trycloudflare.com` **berubah setiap kali** `cloudflared` dijalankan ulang.
  Kalau ingin alamat tetap (mis. `okiya.domainmu.com`), pakai *named tunnel* di akun Cloudflare gratis
  dengan domain sendiri, dan arahkan ke `http://localhost:3000`. WebSocket sudah didukung tanpa pengaturan tambahan.
- Selama komputer, server, dan tunnel menyala, game bisa dimainkan.

## Cara kerja

- Semua aturan dicek di **server** (`game.js`), jadi langkah curang dari browser ditolak.
- Pembuat permainan = **Merah**, yang bergabung pertama = **Hitam**, orang berikutnya dengan ID yang sama = **penonton**.
- Kursi disimpan dengan token di browser (localStorage). Kalau koneksi putus atau halaman di-refresh, pemain otomatis kembali ke kursinya.
- Bila ubin terakhir diambil tanpa pemenang, ronde **seri** (tidak ada kemenangan/poin) dan pemain yang tadi tidak memulai jalan lebih dulu.
- Ronde berikutnya selalu dimulai oleh yang kalah. Format: satu permainan, 3 kemenangan, atau poin (10/15/20).
- Room disimpan di memori. Room yang kosong lebih dari 2 jam dihapus, dan semua room hilang bila server dimatikan.
- `http://localhost:3000/health` menampilkan jumlah room aktif.

## Struktur

```
server.js        server HTTP + WebSocket (/ws), room per Game ID
Dockerfile       image Node 22 Alpine
docker-compose.yml  server + cloudflared (profil quick / named)
game.js          aturan Okiya
public/          halaman game + gambar tile & karakter (assets/)
```

Okiya © Bruno Cathala & Cyril Bouquet. Proyek ini untuk dimainkan secara pribadi.
