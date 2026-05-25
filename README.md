# Stringee Webphone

Web-based call center client cho [Stringee](https://stringee.com), build bằng Vue 3 + Vite. Hỗ trợ gọi thoại GSM, gọi nội bộ, và gọi video qua WebRTC.

## Tính năng

- **Outbound call** — Gọi thoại GSM (ra số ngoài mạng), gọi thoại nội bộ (User ID Stringee), gọi video
- **Inbound call** — Popup nhận cuộc gọi nằm trong softphone, tự mở/đóng theo trạng thái
- **In-call controls** — Mute mic, gửi DTMF qua dialpad, gửi info, tắt/bật camera (video call), cúp máy
- **Cấu hình mặc định** — Token / hotline / số đích lưu trong `localStorage`
- **Multi-server** — Chọn giữa các Stringee region (ASIA_1 / ASIA_2 / ASIA_3) hoặc auto
- **Theme** — Dark / Light mode, persist qua `localStorage`
- **Activity log** — Panel log real-time cho debug

## Yêu cầu

- Node.js ≥ 18
- Trình duyệt hỗ trợ WebRTC (Chrome / Edge / Firefox / Safari mới)
- Stringee Access Token (lấy từ dashboard Stringee hoặc backend của bạn)
- Phải chạy qua **HTTPS** hoặc `localhost` (yêu cầu của `getUserMedia`)

## Setup local

```sh
npm install
npm run dev
```

Mặc định mở tại `http://localhost:5173`.

## Sử dụng

1. Nhấn **Cấu hình** ở header → lưu Access Token, Hotline, số đích mặc định vào localStorage (hoặc nhập trực tiếp ở sidebar).
2. Nhấn **Kết nối** ở panel trái để kết nối tới Stringee Server.
3. Mở **softphone** (nút phone ở góc trên phải) → nhập số / User ID → chọn loại cuộc gọi → **Gọi**.
4. Khi có cuộc gọi đến, softphone tự mở với UI Trả lời / Từ chối.
5. Trong cuộc gọi: dùng nút dialpad để gửi DTMF, mute, info, hangup.

## Build production

```sh
npm run build
```

Output ở `dist/`. Preview local:

```sh
npm run preview
```

## Deploy GitHub Pages

Đã có sẵn workflow [.github/workflows/deploy.yml](.github/workflows/deploy.yml). Cách deploy:

1. Push code lên GitHub repo (public, hoặc private nếu có GitHub Pro).
2. Vào **Settings → Pages → Source** chọn **GitHub Actions**.
3. Mỗi lần push lên `main`, workflow tự build + deploy. App live tại `https://<user>.github.io/<repo>/`.

`base` path của Vite được set tự động từ tên repo qua env `VITE_BASE`, không cần hard-code.

## Cấu trúc

```
src/
├── main.js               # Vue app entrypoint
├── App.vue               # Layout chính (header + sidebar + main + modals)
├── store.js              # Reactive store + Stringee SDK actions
├── constants.js          # Cấu hình Stringee servers
├── styles.css            # Design tokens + toàn bộ styles
└── components/
    ├── AppHeader.vue     # Header: brand, server select, config, theme, softphone trigger
    ├── LoginPanel.vue    # Sidebar: token, hotline, connect/disconnect
    ├── LogPanel.vue      # Sidebar: activity log
    ├── CallModal.vue     # Softphone popover: dialpad + incoming call UI
    ├── CallView.vue      # Active call UI (audio/video container, controls)
    ├── ConfigModal.vue   # Modal lưu cấu hình mặc định
    ├── InfoModal.vue     # Modal gửi info trong cuộc gọi
    └── ErrorModal.vue    # Modal hiển thị lỗi
```

**Stringee SDK** được load từ CDN trong [index.html](index.html) (không qua npm) — `StringeeClient`, `StringeeCall`, `StringeeCall2` available global.

## Stack

- [Vue 3](https://vuejs.org/) (Options API + SFC)
- [Vite 5](https://vitejs.dev/)
- [Stringee Web SDK](https://developer.stringee.com/docs/web-sdk) (load qua CDN)
- [Bootstrap Icons](https://icons.getbootstrap.com/) (load qua CDN)
- Vanilla CSS với design tokens

## Lưu ý bảo mật

- **Không commit Access Token** vào repo. Token chỉ lưu trong `localStorage` của trình duyệt.
- Trong production, token nên được sinh từ backend riêng (sign JWT với API key của Stringee), không hard-code trong frontend.
- File `.env*` và `env.json` đã được [.gitignore](.gitignore).

## License

[MIT](LICENSE) © Andy
