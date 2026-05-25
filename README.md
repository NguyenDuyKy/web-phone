# Stringee Webphone

> [Tiếng Việt](#tiếng-việt) · [English](#english)

<a id="tiếng-việt"></a>

## 🇻🇳 Tiếng Việt

Web-based call center client cho [Stringee](https://stringee.com), build bằng Vue 3 + Vite. Hỗ trợ gọi thoại GSM, gọi nội bộ, gọi video qua WebRTC, và Text-to-Speech.

## Tính năng

- **Outbound call** — Gọi thoại GSM (ra số ngoài mạng), gọi thoại nội bộ (User ID Stringee), gọi video
- **Inbound call** — UI nhận cuộc gọi nằm trong softphone, tự mở/đóng theo trạng thái
- **In-call controls** — Mute mic, gửi DTMF qua dialpad, gửi info, tắt/bật camera (video call), cúp máy
- **Text-to-Speech** — Popover TTS trên header, chỉnh tốc độ 0.5×–2×, chọn ngôn ngữ. Hai mode:
  - **Local** (Web Speech API) — dùng giọng đọc hệ thống, không cần setup, không tải MP3 được
  - **Cloud** (Google TTS qua Cloudflare Worker proxy) — chất lượng tốt hơn, tải được MP3, ~5 phút setup
- **Cấu hình mặc định** — Token / hotline / số đích / TTS Worker URL lưu trong `localStorage`
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

1. Nhấn **Cấu hình** ở header → lưu Access Token, Hotline, số đích mặc định, (tuỳ chọn) TTS Worker URL.
2. Nhấn **Kết nối** ở panel trái để kết nối tới Stringee Server.
3. Mở **softphone** (nút phone ở góc trên phải) → nhập số / User ID → chọn loại cuộc gọi → **Gọi**.
4. Khi có cuộc gọi đến, softphone tự mở với UI Trả lời / Từ chối.
5. Trong cuộc gọi: dùng nút dialpad để gửi DTMF, mute, info, hangup.
6. **TTS**: nhấn icon loa trên header → chọn ngôn ngữ + tốc độ → nhập text → **Sinh giọng nói** (cloud) hoặc **Phát** (local).

## Text-to-Speech

App có 2 mode TTS tuỳ vào việc có set `TTS Worker URL` trong Cấu hình hay không:

### Local mode (mặc định)

- Dùng `Web Speech API` (built-in browser)
- Voices từ hệ thống (Windows 11 có HoaiMy/NamMinh tiếng Việt; Chrome có Google voices)
- Hỗ trợ điều chỉnh tốc độ qua `SpeechSynthesisUtterance.rate`
- **Không tải MP3 được** vì browser không expose audio stream

### Cloud mode (qua Cloudflare Worker)

- Tải được file MP3
- Chỉnh tốc độ playback real-time (qua `audio.playbackRate`)
- Hỗ trợ 17 ngôn ngữ qua Google Translate TTS
- Setup ~5 phút, miễn phí 100k requests/ngày

Xem hướng dẫn deploy worker tại [worker/README.md](worker/README.md).

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
│   ├── store.js                   # Reactive store + Stringee SDK + TTS actions
│   ├── constants.js               # Cấu hình Stringee servers
│   ├── styles.css                 # Design tokens + toàn bộ styles
│   └── components/
│       ├── AppHeader.vue          # Header: brand, server, config, TTS, theme, softphone trigger
│       ├── LoginPanel.vue         # Sidebar: token, hotline, connect/disconnect
│       ├── LogPanel.vue           # Sidebar: activity log real-time
│       ├── CallModal.vue          # Softphone popover: dialpad + incoming call UI
│       ├── CallView.vue           # Active call UI (audio/video container, controls)
│       ├── TtsModal.vue           # TTS popover: voice + speed + text + audio
│       ├── ConfigModal.vue        # Modal lưu cấu hình mặc định
│       ├── InfoModal.vue          # Modal gửi info trong cuộc gọi
│       └── ErrorModal.vue         # Modal hiển thị lỗi
├── worker/
│   ├── google-tts.js              # Cloudflare Worker proxy cho Google TTS
│   └── README.md                  # Hướng dẫn deploy worker
└── .github/workflows/
    └── deploy.yml                 # Auto-deploy lên GitHub Pages
```

**Stringee SDK** được load từ CDN trong [index.html](index.html) (không qua npm) — `StringeeClient`, `StringeeCall`, `StringeeCall2` available global.

## Stack

- [Vue 3](https://vuejs.org/) (Options API + SFC)
- [Vite 5](https://vitejs.dev/)
- [Stringee Web SDK](https://developer.stringee.com/docs/web-sdk) (load qua CDN)
- [Bootstrap Icons](https://icons.getbootstrap.com/) (load qua CDN)
- [Cloudflare Workers](https://workers.cloudflare.com/) (cho TTS proxy, tuỳ chọn)
- Vanilla CSS với design tokens

## Lưu ý bảo mật

- **Không commit Access Token** vào repo. Token chỉ lưu trong `localStorage` của trình duyệt.
- Trong production, token nên được sinh từ backend riêng (sign JWT với API key của Stringee), không hard-code trong frontend.
- TTS Worker mặc định CORS `*` — bất kỳ ai có URL đều dùng được, ăn quota của bạn. Cân nhắc restrict origin trong worker nếu deploy public.
- File `.env*` và `env.json` đã được [.gitignore](.gitignore).

## License

[MIT](LICENSE) © Andy

---

<a id="english"></a>

## 🇬🇧 English

Web-based call center client for [Stringee](https://stringee.com), built with Vue 3 + Vite. Supports GSM voice calls, internal calls, video calls over WebRTC, and Text-to-Speech.

## Features

- **Outbound call** — GSM voice (external numbers), internal voice (Stringee User ID), video call
- **Inbound call** — Incoming call UI embedded in the softphone, auto open/close by state
- **In-call controls** — Mute mic, send DTMF via dialpad, send info, toggle camera (video), hang up
- **Text-to-Speech** — TTS popover in the header with speed control 0.5×–2× and language picker. Two modes:
  - **Local** (Web Speech API) — uses system voices, zero setup, cannot download MP3
  - **Cloud** (Google TTS via Cloudflare Worker proxy) — better quality, MP3 download, ~5 min setup
- **Default config** — Token / hotline / destination number / TTS Worker URL persisted in `localStorage`
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

1. Click **Cấu hình** (Settings) in the header → save Access Token, Hotline, default destination, and optionally TTS Worker URL.
2. Click **Kết nối** (Connect) in the left panel to connect to the Stringee server.
3. Open the **softphone** (phone button at the top-right) → enter number / User ID → pick call type → **Gọi** (Call).
4. When an incoming call arrives, the softphone auto-opens with Answer / Reject UI.
5. During a call: use the dialpad to send DTMF, mute, send info, or hang up.
6. **TTS**: click the speaker icon in the header → pick language and speed → enter text → **Sinh giọng nói** (Generate, cloud) or **Phát** (Play, local).

## Text-to-Speech

The app provides two TTS modes depending on whether `TTS Worker URL` is set in Settings:

### Local mode (default)

- Uses the browser's built-in `Web Speech API`
- Voices come from the system (Windows 11 ships with HoaiMy/NamMinh for Vietnamese; Chrome adds Google voices)
- Speed control via `SpeechSynthesisUtterance.rate`
- **Cannot download MP3** because browsers do not expose the synthesized audio stream

### Cloud mode (via Cloudflare Worker)

- Downloads as an MP3 file
- Real-time playback speed via `audio.playbackRate`
- 17 languages via Google Translate TTS
- ~5 min setup, free 100k requests/day

See [worker/README.md](worker/README.md) for worker deployment.

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
│   ├── store.js                   # Reactive store + Stringee SDK + TTS actions
│   ├── constants.js               # Stringee server configuration
│   ├── styles.css                 # Design tokens + all styles
│   └── components/
│       ├── AppHeader.vue          # Header: brand, server, settings, TTS, theme, softphone trigger
│       ├── LoginPanel.vue         # Sidebar: token, hotline, connect/disconnect
│       ├── LogPanel.vue           # Sidebar: real-time activity log
│       ├── CallModal.vue          # Softphone popover: dialpad + incoming UI
│       ├── CallView.vue           # Active call UI (audio/video container, controls)
│       ├── TtsModal.vue           # TTS popover: voice + speed + text + audio
│       ├── ConfigModal.vue        # Modal for default settings
│       ├── InfoModal.vue          # Modal for sending info during a call
│       └── ErrorModal.vue         # Error modal
├── worker/
│   ├── google-tts.js              # Cloudflare Worker proxy for Google TTS
│   └── README.md                  # Worker deployment guide
└── .github/workflows/
    └── deploy.yml                 # Auto-deploy to GitHub Pages
```

**Stringee SDK** is loaded from CDN in [index.html](index.html) (not via npm) — `StringeeClient`, `StringeeCall`, `StringeeCall2` are exposed as globals.

## Stack

- [Vue 3](https://vuejs.org/) (Options API + SFC)
- [Vite 5](https://vitejs.dev/)
- [Stringee Web SDK](https://developer.stringee.com/docs/web-sdk) (CDN)
- [Bootstrap Icons](https://icons.getbootstrap.com/) (CDN)
- [Cloudflare Workers](https://workers.cloudflare.com/) (optional, for TTS proxy)
- Vanilla CSS with design tokens

## Security notes

- **Never commit Access Tokens** to the repo. Tokens are kept only in the browser's `localStorage`.
- In production, tokens should be minted by your own backend (signing JWTs with your Stringee API key), not hard-coded in the frontend.
- The TTS Worker defaults to CORS `*` — anyone with the URL can use it and consume your quota. Consider restricting the allowed origin in the worker for public deployments.
- `.env*` and `env.json` are already in [.gitignore](.gitignore).

## License

[MIT](LICENSE) © Andy
