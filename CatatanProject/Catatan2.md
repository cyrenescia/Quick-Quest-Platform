# Catatan Ke-2

## Tanggal & Waktu

2026-06-22 00:00 UTC

## Deskripsi Pekerjaan

Indexing project GitHub Quick Quest Platform sekaligus peninjauan kode awal untuk menangkap bug kritis pada alur autentikasi frontend. Fokus utama: memastikan Algoritma Inti aplikasi tetap memakai backend `/api/profile` sebagai source of truth session, bukan hanya state browser lokal.

## Penjelasan Teknis

Perbaikan kritis dilakukan pada `src/app/auth.context.tsx`:

1. `AuthProvider` sekarang memulai state `isAuthReady` dari `false` agar guard tidak langsung percaya pada cache browser.
2. Saat provider mount, `refreshSession()` otomatis memanggil backend `GET /api/profile` melalui `GlobalEndpoint().profile.detail`.
3. Jika backend mengembalikan profile valid, data profile dipersist ulang ke `sessionStorage` dan user dianggap authenticated.
4. Jika request profile gagal atau response invalid, frontend menghapus `qqm-auth-profile` dan access token fallback agar user dipaksa kembali ke login.
5. `logoutClient()` tetap memanggil backend logout, tetapi selalu membersihkan state lokal walaupun request logout gagal.

Bug yang ditangkap:

- Sebelum perbaikan, `AuthProvider.refreshSession()` hanya membaca `sessionStorage`. Dampaknya, user bisa dianggap authenticated oleh frontend selama `qqm-auth-profile` masih tersimpan walaupun cookie/session backend sudah expired, logout dari tab lain, atau tidak valid lagi.
- Ini berlawanan dengan catatan awal proyek yang menegaskan `/api/profile` harus menjadi source of truth saat init session.

## Alur

1. App render `RootShell`.
2. Mode user app membungkus aplikasi dengan `AuthProvider`.
3. `AuthProvider` membaca cache profile hanya sebagai state awal sementara.
4. `AuthProvider` set `isAuthReady=false` dan menjalankan `refreshSession()`.
5. Frontend request `GET /api/profile` dengan credentials include + bearer fallback jika ada.
6. Jika valid:
   - simpan profile terbaru,
   - set `isAuthenticated=true`,
   - set `isAuthReady=true`,
   - `AuthGuard` boleh render home.
7. Jika invalid:
   - hapus profile lokal,
   - hapus access token,
   - set `isAuthenticated=false`,
   - set `isAuthReady=true`,
   - `AuthGuard` redirect ke login.

## Catatan Review Lanjutan

- `RoleProvider` masih hanya menjalankan init role sekali saat mount. Jika `userProfile` berubah setelah refresh async, perlu dipertimbangkan dependency ke `userProfile` agar role selalu ikut sinkron.
- `global.service.ts` masih menyimpan fungsi testing `Container()` di production source. Bisa dibersihkan pada hardening berikutnya.
- Social login button di halaman login masih UI-only dan belum punya handler backend.
