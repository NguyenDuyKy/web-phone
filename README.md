# Stringee Webphone

> [Tiếng Việt](#tiếng-việt) · [English](#english)

<a id="tiếng-việt"></a>

## 🇻🇳 Tiếng Việt

Web-based call center client cho [Stringee](https://stringee.com), build bằng Vue 3 + Vite. Hỗ trợ gọi thoại GSM, gọi nội bộ, và gọi video qua WebRTC.

## Tính năng

- **Outbound call** — Gọi thoại GSM (ra số ngoài mạng), gọi thoại nội bộ (User ID Stringee), gọi video
- **Inbound call** — UI nhận cuộc gọi nằm trong softphone, tự mở/đóng theo trạng thái
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

1. Nhấn **Cấu hình** ở header → lưu Access Token, Hotline, số đích mặc định.
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
├── src/
│   ├── main.js                    # Vue app entrypoint
│   ├── App.vue                    # Layout chính (header + sidebar + main + modals)
│   ├── store.js                   # Reactive store + Stringee SDK actions
│   ├── constants.js               # Cấu hình Stringee servers
│   ├── styles.css                 # Design tokens + toàn bộ styles
│   └── components/
│       ├── AppHeader.vue          # Header: brand, server, config, theme, softphone trigger
│       ├── LoginPanel.vue         # Sidebar: token, hotline, connect/disconnect
│       ├── LogPanel.vue           # Sidebar: activity log real-time
│       ├── CallModal.vue          # Softphone popover: dialpad + incoming call UI
│       ├── CallView.vue           # Active call UI (audio/video container, controls)
│       ├── ConfigModal.vue        # Modal lưu cấu hình mặc định
│       ├── InfoModal.vue          # Modal gửi info trong cuộc gọi
│       └── ErrorModal.vue         # Modal hiển thị lỗi
└── .github/workflows/
    └── deploy.yml                 # Auto-deploy lên GitHub Pages
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

---

<a id="english"></a>

## 🇬🇧 English

Web-based call center client for [Stringee](https://stringee.com), built with Vue 3 + Vite. Supports GSM voice calls, internal calls, and video calls over WebRTC.

## Features

- **Outbound call** — GSM voice (external numbers), internal voice (Stringee User ID), video call
- **Inbound call** — Incoming call UI embedded in the softphone, auto open/close by state
- **In-call controls** — Mute mic, send DTMF via dialpad, send info, toggle camera (video), hang up
- **Default config** — Token / hotline / destination number persisted in `localStorage`
- **Multi-server** — Pick a Stringee region (ASIA_1 / ASIA_2 / ASIA_3) or auto
- **Theme** — Dark / Light mode, persisted in `localStorage`
- **Activity log** — Real-time log panel for debugging

## Requirements

- Node.js ≥ 18
- WebRTC-capable browser (modern Chrome / Edge / Firefox / Safari)
- A Stringee Access Token (from the Stringee dashboard or your backend)
- Must be served over **HTTPS** or `localhost` (required by `getUserMedia`)

## Local setup

```sh
npm install
npm run dev
```

Defaults to `http://localhost:5173`.

## Usage

1. Click **Cấu hình** (Settings) in the header → save Access Token, Hotline, and default destination.
2. Click **Kết nối** (Connect) in the left panel to connect to the Stringee server.
3. Open the **softphone** (phone button at the top-right) → enter number / User ID → pick call type → **Gọi** (Call).
4. When an incoming call arrives, the softphone auto-opens with Answer / Reject UI.
5. During a call: use the dialpad to send DTMF, mute, send info, or hang up.

## Production build

```sh
npm run build
```

Output goes to `dist/`. Preview locally:

```sh
npm run preview
```

## Deploy to GitHub Pages

A workflow is provided at [.github/workflows/deploy.yml](.github/workflows/deploy.yml):

1. Push the repo to GitHub (public, or private with GitHub Pro).
2. Go to **Settings → Pages → Source** and pick **GitHub Actions**.
3. Each push to `main` triggers the build & deploy. App is live at `https://<user>.github.io/<repo>/`.

Vite's `base` path is auto-derived from the repo name via the `VITE_BASE` env var — no hard-coding required.

## Project layout

```
├── src/
│   ├── main.js                    # Vue app entrypoint
│   ├── App.vue                    # Main layout (header + sidebar + main + modals)
│   ├── store.js                   # Reactive store + Stringee SDK actions
│   ├── constants.js               # Stringee server configuration
│   ├── styles.css                 # Design tokens + all styles
│   └── components/
│       ├── AppHeader.vue          # Header: brand, server, settings, theme, softphone trigger
│       ├── LoginPanel.vue         # Sidebar: token, hotline, connect/disconnect
│       ├── LogPanel.vue           # Sidebar: real-time activity log
│       ├── CallModal.vue          # Softphone popover: dialpad + incoming UI
│       ├── CallView.vue           # Active call UI (audio/video container, controls)
│       ├── ConfigModal.vue        # Modal for default settings
│       ├── InfoModal.vue          # Modal for sending info during a call
│       └── ErrorModal.vue         # Error modal
└── .github/workflows/
    └── deploy.yml                 # Auto-deploy to GitHub Pages
```

**Stringee SDK** is loaded from CDN in [index.html](index.html) (not via npm) — `StringeeClient`, `StringeeCall`, `StringeeCall2` are exposed as globals.

## Stack

- [Vue 3](https://vuejs.org/) (Options API + SFC)
- [Vite 5](https://vitejs.dev/)
- [Stringee Web SDK](https://developer.stringee.com/docs/web-sdk) (CDN)
- [Bootstrap Icons](https://icons.getbootstrap.com/) (CDN)
- Vanilla CSS with design tokens

## Security notes

- **Never commit Access Tokens** to the repo. Tokens are kept only in the browser's `localStorage`.
- In production, tokens should be minted by your own backend (signing JWTs with your Stringee API key), not hard-coded in the frontend.
- `.env*` and `env.json` are already in [.gitignore](.gitignore).

## License

[MIT](LICENSE) © Andy
