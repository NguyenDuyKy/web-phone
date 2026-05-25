// Cloudflare Worker: proxy Google Translate TTS (alternative cho Edge TTS bị MS block CF IPs)
// Deploy: dán nội dung file này vào Worker tại https://dash.cloudflare.com
// Usage:
//   GET  /?text=Xin+chào&voice=vi
//   POST /  body: { "text": "...", "voice": "vi" }
// Returns: audio/mpeg (MP3)
//
// Voice param có thể là:
//   - lang code: "vi", "en", "ja"...
//   - lang-region: "vi-VN", "en-US"...
//   - Edge voice name: "vi-VN-HoaiMyNeural" (worker chỉ dùng phần lang prefix)

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// Google TTS giới hạn ~200 ký tự/request → cần chunk
function chunkText(text, maxLen) {
    if (text.length <= maxLen) return [text];
    const out = [];
    const sentences = text.split(/(?<=[.!?。！？\n])\s*/);
    let current = '';
    const flush = () => {
        if (current.trim()) out.push(current.trim());
        current = '';
    };
    for (const sent of sentences) {
        if ((current + sent).length <= maxLen) {
            current += sent;
            continue;
        }
        flush();
        if (sent.length <= maxLen) {
            current = sent;
            continue;
        }
        const words = sent.split(/\s+/);
        for (const w of words) {
            if (w.length > maxLen) {
                flush();
                for (let i = 0; i < w.length; i += maxLen) {
                    out.push(w.slice(i, i + maxLen));
                }
            } else if ((current + ' ' + w).trim().length > maxLen) {
                flush();
                current = w;
            } else {
                current = (current ? current + ' ' : '') + w;
            }
        }
    }
    flush();
    return out.filter((c) => c.length > 0);
}

function voiceToLang(voice) {
    if (!voice) return 'vi';
    return voice.split('-')[0].toLowerCase();
}

async function googleTts(text, lang) {
    const chunks = chunkText(text, 180);
    const parts = [];
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const url = `https://translate.google.com/translate_tts` +
            `?ie=UTF-8&q=${encodeURIComponent(chunk)}` +
            `&tl=${encodeURIComponent(lang)}` +
            `&total=${chunks.length}&idx=${i}` +
            `&textlen=${chunk.length}` +
            `&client=tw-ob&prev=input`;
        const res = await fetch(url, {
            headers: {
                'User-Agent': UA,
                Referer: 'https://translate.google.com/',
                Accept: 'audio/mpeg, */*',
            },
        });
        if (!res.ok) {
            throw new Error(`Google TTS HTTP ${res.status} ${res.statusText} (chunk ${i + 1}/${chunks.length})`);
        }
        const buf = await res.arrayBuffer();
        if (buf.byteLength === 0) {
            throw new Error(`Audio rỗng tại chunk ${i + 1}`);
        }
        parts.push(new Uint8Array(buf));
    }
    const total = parts.reduce((s, c) => s + c.length, 0);
    const combined = new Uint8Array(total);
    let off = 0;
    for (const c of parts) {
        combined.set(c, off);
        off += c.length;
    }
    return combined.buffer;
}

export default {
    async fetch(request) {
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: CORS });
        }
        try {
            let text;
            let voice;
            const url = new URL(request.url);
            if (request.method === 'GET') {
                text = url.searchParams.get('text');
                voice = url.searchParams.get('voice') || 'vi';
            } else if (request.method === 'POST') {
                const body = await request.json();
                text = body.text;
                voice = body.voice || 'vi';
            } else {
                return new Response('Method not allowed', { status: 405, headers: CORS });
            }
            if (!text || !text.trim()) {
                return new Response(JSON.stringify({ error: 'Thiếu tham số text' }), {
                    status: 400,
                    headers: { ...CORS, 'Content-Type': 'application/json' },
                });
            }
            if (text.length > 3000) {
                return new Response(JSON.stringify({ error: 'Text quá dài (max 3000 ký tự)' }), {
                    status: 400,
                    headers: { ...CORS, 'Content-Type': 'application/json' },
                });
            }
            const lang = voiceToLang(voice);
            const audioBuffer = await googleTts(text.trim(), lang);
            return new Response(audioBuffer, {
                headers: {
                    ...CORS,
                    'Content-Type': 'audio/mpeg',
                    'Cache-Control': 'public, max-age=3600',
                },
            });
        } catch (err) {
            return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), {
                status: 500,
                headers: { ...CORS, 'Content-Type': 'application/json' },
            });
        }
    },
};
