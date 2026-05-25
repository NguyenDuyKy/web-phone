# TTS Cloudflare Worker

Proxy free cho web app — dùng Google Translate TTS, không cần API key.

## Deploy trong 5 phút

### 1. Tạo tài khoản Cloudflare (free)
- Vào https://dash.cloudflare.com/sign-up
- Đăng ký bằng email

### 2. Tạo Worker
- Vào dashboard → **Workers & Pages** (menu trái)
- Click **Create application** → **Create Worker**
- Đặt tên (vd: `tts-proxy`) → **Deploy**
- Click **Edit code**

### 3. Paste code
- Xoá toàn bộ code mặc định
- Copy hết nội dung file [google-tts.js](google-tts.js) vào editor
- Click **Save and deploy**

### 4. Copy URL Worker
- URL có dạng `https://tts-proxy.<your-subdomain>.workers.dev`
- Copy lại

### 5. Paste vào app
- Mở app Stringee Webphone
- Click **Cấu hình** ở header
- Paste URL vào field **TTS Worker URL**
- Lưu cấu hình

Xong! Giờ TTS sẽ dùng Google voices + có nút **Tải MP3**.

## Quota miễn phí

- **Cloudflare Workers Free:** 100,000 requests/ngày
- **Google Translate TTS:** không có quota chính thức nhưng rate-limit theo IP. Worker dùng IP của Cloudflare → đủ cho cá nhân/team nhỏ.

## Test thử worker

```
https://tts-proxy.<your-subdomain>.workers.dev/?text=Xin+ch%C3%A0o&voice=vi
```
→ Browser sẽ phát MP3.

## Ngôn ngữ hỗ trợ

Google TTS hỗ trợ **1 giọng/ngôn ngữ** (không có lựa chọn nam/nữ). Voice param truyền vào worker là lang code:

| Voice | Ngôn ngữ |
|---|---|
| `vi` | Tiếng Việt |
| `en-US` | English (US) |
| `en-GB` | English (UK) |
| `ja` | 日本語 |
| `zh-CN` | 中文 (Simplified) |
| `zh-TW` | 中文 (Traditional) |
| `ko` | 한국어 |
| `fr` | Français |
| `de` | Deutsch |
| `es` | Español |
| `it` | Italiano |
| `pt-BR` | Português (Brazil) |
| `ru` | Русский |
| `th` | ไทย |
| `id` | Bahasa Indonesia |
| `hi` | हिन्दी |
| `ar` | العربية |

## Giới hạn

- Tối đa **~200 ký tự / request** — worker tự động chunk text dài và ghép MP3 lại
- Không có pitch/rate/volume control
- Chỉ có 1 giọng / ngôn ngữ (chất lượng standard, không phải neural)
- Nếu Google rate-limit, request sẽ fail (thử lại sau vài giây)

## Bảo mật

Worker không có auth — bất kỳ ai có URL đều dùng được, ăn quota của bạn. Để giới hạn:
- Đổi `'Access-Control-Allow-Origin': '*'` thành domain cụ thể (vd: `https://your-domain.github.io`)
- Thêm secret token check ở đầu fetch handler
