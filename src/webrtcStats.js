import { reactive, toRaw } from 'vue';

const POLL_INTERVAL_MS = 1000;
const HISTORY_LENGTH = 40;

function emptyState() {
    return {
        status: 'idle', // idle | waiting | live | ended
        updatedAt: 0,
        peerCount: 0,
        conn: null,
        audioIn: null,
        audioOut: null,
        videoIn: null,
        videoOut: null,
        quality: null,
        history: { rtt: [], bitrateIn: [], bitrateOut: [], loss: [] },
    };
}

export const rtc = reactive(emptyState());

let pollTimer = null;
let getCall = null;
let sessionStart = 0;
let prevStats = new Map();
const peerIds = new WeakMap();
let nextPeerId = 1;

/* ─────────────────────────────────────────────────────────────
   POLLING LIFECYCLE
   ──────────────────────────────────────────────────────────── */
export function startRtcStats(callGetter) {
    stopTimer();
    Object.assign(rtc, emptyState());
    rtc.status = 'waiting';
    getCall = callGetter;
    // Allow a small window: an incoming call may create its PC slightly before we start.
    sessionStart = Date.now() - 2000;
    prevStats = new Map();
    pollTimer = setInterval(poll, POLL_INTERVAL_MS);
    poll();
}

export function stopRtcStats() {
    stopTimer();
    getCall = null;
    // Keep the last snapshot visible so it can be inspected after hang-up.
    rtc.status = rtc.updatedAt ? 'ended' : 'idle';
}

function stopTimer() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

function isPeerConnection(v) {
    return !!v && typeof v === 'object'
        && typeof v.getStats === 'function'
        && typeof v.createOffer === 'function';
}

function findPeers() {
    const found = new Set();
    // The call object lives in a reactive store → unwrap, or getStats() throws "Illegal invocation".
    const call = getCall ? toRaw(getCall()) : null;
    if (call) {
        Object.keys(call).forEach((k) => {
            let v;
            try { v = toRaw(call[k]); } catch (e) { return; }
            if (isPeerConnection(v)) found.add(v);
        });
    }
    (window.__rtcPeers || []).forEach((pc) => {
        if ((pc.__createdAt || 0) >= sessionStart) found.add(pc);
    });
    return [...found].filter((pc) => pc.signalingState !== 'closed');
}

function peerId(pc) {
    if (!peerIds.has(pc)) peerIds.set(pc, nextPeerId++);
    return peerIds.get(pc);
}

async function poll() {
    const peers = findPeers();
    rtc.peerCount = peers.length;
    if (!peers.length) return;

    let results;
    try {
        results = await Promise.all(peers.map(async (pc) => ({ pc, report: await pc.getStats() })));
    } catch (e) {
        return;
    }
    // Call ended while getStats() was in flight.
    if (!pollTimer) return;

    const nextPrev = new Map();
    const parsed = results.map(({ pc, report }) => parsePeer(pc, report, nextPrev));
    prevStats = nextPrev;

    const pickBy = (slot, field) => parsed
        .map((p) => p[slot])
        .filter(Boolean)
        .sort((a, b) => (b[field] || 0) - (a[field] || 0))[0] || null;

    const conn = parsed.map((p) => p.conn).find((c) => c && c.hasPair) || parsed[0].conn;
    const audioIn = pickBy('audioIn', 'bytes');
    const audioOut = pickBy('audioOut', 'bytes');
    const videoIn = pickBy('videoIn', 'bytes');
    const videoOut = pickBy('videoOut', 'bytes');

    if (conn && conn.rtt == null) {
        const fallback = (audioOut && audioOut.remoteRtt) ?? (videoOut && videoOut.remoteRtt);
        if (fallback != null) conn.rtt = fallback;
    }

    rtc.conn = conn;
    rtc.audioIn = audioIn;
    rtc.audioOut = audioOut;
    rtc.videoIn = videoIn;
    rtc.videoOut = videoOut;
    rtc.quality = estimateQuality(conn, audioIn);
    rtc.updatedAt = Date.now();
    rtc.status = 'live';

    const sum = (...vals) => {
        const xs = vals.filter((v) => v != null);
        return xs.length ? xs.reduce((a, b) => a + b, 0) : null;
    };
    pushHistory('rtt', conn ? conn.rtt : null);
    pushHistory('bitrateIn', sum(audioIn && audioIn.bitrate, videoIn && videoIn.bitrate));
    pushHistory('bitrateOut', sum(audioOut && audioOut.bitrate, videoOut && videoOut.bitrate));
    pushHistory('loss', audioIn ? audioIn.lossPct : null);
}

function pushHistory(key, value) {
    const arr = rtc.history[key];
    arr.push(value);
    if (arr.length > HISTORY_LENGTH) arr.splice(0, arr.length - HISTORY_LENGTH);
}

/* ─────────────────────────────────────────────────────────────
   STATS PARSING (W3C webrtc-stats)
   ──────────────────────────────────────────────────────────── */
function parsePeer(pc, report, nextPrev) {
    const id = peerId(pc);
    const byId = (sid) => (sid ? report.get(sid) : undefined);
    const out = { conn: null, audioIn: null, audioOut: null, videoIn: null, videoOut: null };

    const remoteInbound = new Map();
    let transport = null;
    report.forEach((s) => {
        if (s.type === 'remote-inbound-rtp' && s.localId) remoteInbound.set(s.localId, s);
        if (s.type === 'transport' && !transport) transport = s;
    });

    report.forEach((s) => {
        const key = id + ':' + s.id;
        if (s.type === 'inbound-rtp' || s.type === 'outbound-rtp') nextPrev.set(key, s);
        const prev = prevStats.get(key);
        const dt = prev ? (s.timestamp - prev.timestamp) / 1000 : 0;
        const delta = (f) => (prev && dt > 0 && s[f] != null && prev[f] != null ? s[f] - prev[f] : null);
        const kind = s.kind || s.mediaType;

        if (s.type === 'inbound-rtp') {
            const slot = kind === 'video' ? 'videoIn' : 'audioIn';
            const m = parseInbound(s, delta, dt, byId);
            if (!out[slot] || m.bytes > out[slot].bytes) out[slot] = m;
        } else if (s.type === 'outbound-rtp') {
            const slot = kind === 'video' ? 'videoOut' : 'audioOut';
            const m = parseOutbound(s, delta, dt, byId, remoteInbound.get(s.id));
            if (!out[slot] || m.bytes > out[slot].bytes) out[slot] = m;
        }
    });

    out.conn = parseConnection(pc, report, transport, byId);
    return out;
}

function codecLabel(codec) {
    if (!codec || !codec.mimeType) return null;
    const name = codec.mimeType.split('/')[1] || codec.mimeType;
    const khz = codec.clockRate ? ' · ' + Math.round(codec.clockRate / 1000) + ' kHz' : '';
    return name + khz;
}

function parseInbound(s, delta, dt, byId) {
    const dBytes = delta('bytesReceived');
    const dLost = delta('packetsLost');
    const dRecv = delta('packetsReceived');
    const dJbDelay = delta('jitterBufferDelay');
    const dJbCount = delta('jitterBufferEmittedCount');
    const dConcealed = delta('concealedSamples');
    const dSamples = delta('totalSamplesReceived');
    const dFrames = delta('framesDecoded');

    let lossPct = null;
    if (dLost != null && dRecv != null && dLost + dRecv > 0) {
        lossPct = (Math.max(0, dLost) / (Math.max(0, dLost) + dRecv)) * 100;
    }
    let jitterBuffer = null;
    if (dJbDelay != null && dJbCount > 0) jitterBuffer = (dJbDelay / dJbCount) * 1000;
    else if (s.jitterBufferEmittedCount > 0) jitterBuffer = (s.jitterBufferDelay / s.jitterBufferEmittedCount) * 1000;

    return {
        bytes: s.bytesReceived || 0,
        codec: codecLabel(byId(s.codecId)),
        bitrate: dBytes != null ? (dBytes * 8) / dt : null,
        packets: s.packetsReceived ?? null,
        packetsLost: s.packetsLost ?? null,
        lossPct,
        jitter: s.jitter != null ? s.jitter * 1000 : null,
        jitterBuffer,
        concealPct: dConcealed != null && dSamples > 0 ? (dConcealed / dSamples) * 100 : null,
        audioLevel: s.audioLevel ?? null,
        width: s.frameWidth ?? null,
        height: s.frameHeight ?? null,
        fps: s.framesPerSecond ?? (dFrames != null && dt > 0 ? dFrames / dt : null),
        framesDropped: s.framesDropped ?? null,
        freezeCount: s.freezeCount ?? null,
        nackCount: s.nackCount ?? null,
        pliCount: s.pliCount ?? null,
        implementation: s.decoderImplementation || null,
    };
}

function parseOutbound(s, delta, dt, byId, remote) {
    const dBytes = delta('bytesSent');
    const dSent = delta('packetsSent');
    const dRetx = delta('retransmittedPacketsSent');
    const source = byId(s.mediaSourceId);

    return {
        bytes: s.bytesSent || 0,
        codec: codecLabel(byId(s.codecId)),
        bitrate: dBytes != null ? (dBytes * 8) / dt : null,
        packets: s.packetsSent ?? null,
        retransmitPct: dRetx != null && dSent > 0 ? (dRetx / dSent) * 100 : null,
        audioLevel: source && source.audioLevel != null ? source.audioLevel : null,
        remoteLossPct: remote && remote.fractionLost != null ? remote.fractionLost * 100 : null,
        remoteJitter: remote && remote.jitter != null ? remote.jitter * 1000 : null,
        remoteRtt: remote && remote.roundTripTime != null ? remote.roundTripTime * 1000 : null,
        width: s.frameWidth ?? null,
        height: s.frameHeight ?? null,
        fps: s.framesPerSecond ?? null,
        qualityLimit: s.qualityLimitationReason || null,
        nackCount: s.nackCount ?? null,
        pliCount: s.pliCount ?? null,
        implementation: s.encoderImplementation || null,
    };
}

function parseConnection(pc, report, transport, byId) {
    let pair = transport && byId(transport.selectedCandidatePairId);
    if (!pair) {
        report.forEach((s) => {
            if (s.type !== 'candidate-pair') return;
            // Firefox exposes `selected`; Chromium relies on nominated + succeeded.
            if (s.selected || (s.nominated && s.state === 'succeeded')) pair = s;
        });
    }
    const local = pair ? byId(pair.localCandidateId) : null;
    const remote = pair ? byId(pair.remoteCandidateId) : null;
    const addr = (c) => (c ? (c.address || c.ip || '?') + ':' + c.port : null);

    return {
        hasPair: !!pair,
        connectionState: pc.connectionState || null,
        iceState: pc.iceConnectionState || (transport && transport.iceState) || null,
        rtt: pair && pair.currentRoundTripTime != null ? pair.currentRoundTripTime * 1000 : null,
        availableOut: pair ? pair.availableOutgoingBitrate ?? null : null,
        bytesSent: pair ? pair.bytesSent ?? null : null,
        bytesReceived: pair ? pair.bytesReceived ?? null : null,
        localType: local ? local.candidateType : null,
        remoteType: remote ? remote.candidateType : null,
        protocol: local ? local.protocol : null,
        relayProtocol: local ? local.relayProtocol || null : null,
        localAddr: addr(local),
        remoteAddr: addr(remote),
        dtlsState: transport ? transport.dtlsState || null : null,
        srtpCipher: transport ? transport.srtpCipher || null : null,
    };
}

/* Simplified ITU-T G.107 E-model → MOS (1–4.5). */
function estimateQuality(conn, audioIn) {
    if (!audioIn || audioIn.jitter == null) return null;
    const rtt = conn && conn.rtt != null ? conn.rtt : 0;
    const loss = audioIn.lossPct || 0;
    const latency = rtt / 2 + audioIn.jitter * 2 + 10;
    let r = latency < 160 ? 93.2 - latency / 40 : 93.2 - (latency - 120) / 10;
    r -= loss * 2.5;
    r = Math.max(0, Math.min(100, r));
    const mos = 1 + 0.035 * r + 0.000007 * r * (r - 60) * (100 - r);
    return { mos: Math.max(1, Math.min(4.5, mos)), r };
}

/* ─────────────────────────────────────────────────────────────
   METRIC DEFINITIONS (drive both the rows and the hover popover)
   ──────────────────────────────────────────────────────────── */
// `levels`: [goodMax, warnMax] for lower-is-better, [goodMin, warnMin] for higher-is-better.
export const METRICS = {
    mos: {
        label: 'MOS (ước tính)',
        source: 'E-model rút gọn từ RTT, jitter, mất gói',
        desc: 'Điểm chất lượng thoại cảm nhận trên thang 1–5, ước tính theo mô hình E-model (ITU-T G.107) từ độ trễ, jitter và tỉ lệ mất gói của luồng audio nhận.',
        higherIsBetter: true,
        levels: [4.0, 3.6],
        unit: '',
    },
    connectionState: {
        label: 'Trạng thái kết nối',
        source: 'RTCPeerConnection.connectionState',
        desc: 'Trạng thái tổng thể của kết nối ngang hàng: new → connecting → connected. "disconnected" hoặc "failed" nghĩa là đường truyền bị gián đoạn.',
    },
    iceState: {
        label: 'Trạng thái ICE',
        source: 'RTCPeerConnection.iceConnectionState',
        desc: 'ICE là cơ chế dò tìm đường mạng giữa hai đầu. "checking": đang thử các cặp địa chỉ; "connected"/"completed": đã tìm được đường truyền media.',
    },
    rtt: {
        label: 'Round-trip time',
        source: 'candidate-pair.currentRoundTripTime',
        desc: 'Thời gian một gói tin đi từ máy bạn tới đầu bên kia rồi quay lại. RTT cao gây cảm giác trễ, hai bên dễ nói chồng lên nhau.',
        levels: [150, 300],
        unit: 'ms',
    },
    candidate: {
        label: 'Loại đường truyền',
        source: 'local-candidate.candidateType',
        desc: 'host: mạng LAN trực tiếp · srflx: đi qua NAT bằng địa chỉ public do STUN trả về · prflx: phát hiện trong lúc kiểm tra · relay: chuyển tiếp qua TURN server (ổn định nhưng tăng độ trễ).',
    },
    protocol: {
        label: 'Giao thức',
        source: 'local-candidate.protocol',
        desc: 'UDP là lựa chọn tối ưu cho media thời gian thực. TCP/TLS thường chỉ được dùng khi mạng chặn UDP và dễ gây trễ khi có mất gói.',
    },
    localAddr: {
        label: 'Địa chỉ cục bộ',
        source: 'local-candidate.address:port',
        desc: 'Địa chỉ IP và cổng phía máy bạn đang được dùng để gửi/nhận media.',
    },
    remoteAddr: {
        label: 'Địa chỉ đầu xa',
        source: 'remote-candidate.address:port',
        desc: 'Địa chỉ IP và cổng của đầu bên kia (thường là media server của Stringee).',
    },
    availableOut: {
        label: 'Băng thông gửi khả dụng',
        source: 'candidate-pair.availableOutgoingBitrate',
        desc: 'Ước lượng băng thông upload của bộ điều khiển nghẽn mạng. Encoder video sẽ tự hạ chất lượng khi giá trị này thấp.',
        unit: 'bps',
    },
    dtls: {
        label: 'Mã hoá DTLS/SRTP',
        source: 'transport.dtlsState · srtpCipher',
        desc: 'Media được mã hoá bằng SRTP với khoá trao đổi qua DTLS. "connected" nghĩa là kênh mã hoá đã được thiết lập.',
    },
    bytesTotal: {
        label: 'Tổng dữ liệu',
        source: 'candidate-pair.bytesSent / bytesReceived',
        desc: 'Tổng lượng dữ liệu đã gửi (↑) và nhận (↓) qua cặp ICE đang dùng kể từ đầu cuộc gọi.',
    },
    bitrateIn: {
        label: 'Bitrate nhận',
        source: 'Σ inbound-rtp.bytesReceived (Δ/giây)',
        desc: 'Tổng lượng dữ liệu media nhận được mỗi giây (audio + video), tính từ chênh lệch số byte giữa hai lần lấy mẫu.',
        unit: 'bps',
    },
    bitrateOut: {
        label: 'Bitrate gửi',
        source: 'Σ outbound-rtp.bytesSent (Δ/giây)',
        desc: 'Tổng lượng dữ liệu media gửi đi mỗi giây (audio + video), tính từ chênh lệch số byte giữa hai lần lấy mẫu.',
        unit: 'bps',
    },
    codec: {
        label: 'Codec',
        source: 'codec.mimeType · clockRate',
        desc: 'Bộ mã hoá/giải mã đang dùng. Audio thường là Opus (48 kHz) hoặc PCMU/PCMA (G.711, 8 kHz) khi gọi ra mạng điện thoại; video thường là VP8, VP9 hoặc H264.',
    },
    bitrate: {
        label: 'Bitrate',
        source: 'bytesReceived / bytesSent (Δ/giây)',
        desc: 'Lượng dữ liệu của luồng media này mỗi giây. Opus thoại thường 20–40 kbps; G.711 khoảng 64–80 kbps.',
        unit: 'bps',
    },
    packets: {
        label: 'Số gói tin',
        source: 'packetsReceived / packetsSent',
        desc: 'Tổng số gói RTP đã nhận hoặc gửi trên luồng này kể từ đầu cuộc gọi.',
    },
    loss: {
        label: 'Mất gói',
        source: 'inbound-rtp.packetsLost (Δ)',
        desc: 'Tỉ lệ gói RTP bị mất trong khoảng lấy mẫu gần nhất (kèm tổng số gói mất). Trên 1% bắt đầu nghe rè, trên 5% thoại ngắt quãng rõ.',
        levels: [1, 5],
        unit: '%',
    },
    jitter: {
        label: 'Jitter',
        source: 'inbound-rtp.jitter',
        desc: 'Độ dao động thời gian đến giữa các gói tin. Jitter cao buộc bộ đệm phải giữ gói lâu hơn, làm tăng độ trễ và dễ gây méo tiếng.',
        levels: [30, 50],
        unit: 'ms',
    },
    jitterBuffer: {
        label: 'Jitter buffer',
        source: 'jitterBufferDelay / jitterBufferEmittedCount',
        desc: 'Thời gian trung bình mỗi mẫu âm thanh/khung hình nằm chờ trong bộ đệm trước khi được phát. Bộ đệm lớn giúp mượt hơn nhưng tăng độ trễ.',
        levels: [80, 200],
        unit: 'ms',
    },
    conceal: {
        label: 'Che giấu lỗi (PLC)',
        source: 'concealedSamples / totalSamplesReceived',
        desc: 'Tỉ lệ mẫu âm thanh phải tự nội suy do gói đến trễ hoặc bị mất. Cao nghĩa là người nghe thấy tiếng méo, giọng "robot".',
        levels: [2, 8],
        unit: '%',
    },
    audioLevel: {
        label: 'Mức âm lượng',
        source: 'inbound-rtp.audioLevel / media-source.audioLevel',
        desc: 'Mức âm lượng tức thời, 0 = im lặng, 1 = tối đa. Dùng để kiểm tra micro có tín hiệu hoặc đầu bên kia có tiếng hay không.',
    },
    remoteLoss: {
        label: 'Mất gói phía nhận',
        source: 'remote-inbound-rtp.fractionLost',
        desc: 'Tỉ lệ mất gói mà đầu bên kia báo về qua RTCP Receiver Report — phản ánh chất lượng chiều upload của bạn.',
        levels: [1, 5],
        unit: '%',
    },
    remoteJitter: {
        label: 'Jitter phía nhận',
        source: 'remote-inbound-rtp.jitter',
        desc: 'Jitter mà đầu bên kia đo được trên luồng bạn gửi đi, báo về qua RTCP.',
        levels: [30, 50],
        unit: 'ms',
    },
    retransmit: {
        label: 'Gửi lại gói',
        source: 'retransmittedPacketsSent / packetsSent (Δ)',
        desc: 'Tỉ lệ gói phải gửi lại do đầu bên kia báo mất (NACK). Tăng cao nghĩa là chiều upload đang mất gói.',
        levels: [2, 5],
        unit: '%',
    },
    resolution: {
        label: 'Độ phân giải',
        source: 'frameWidth × frameHeight',
        desc: 'Kích thước khung hình video hiện tại. Có thể tự giảm khi băng thông hoặc CPU không đủ.',
    },
    fps: {
        label: 'Khung hình/giây',
        source: 'framesPerSecond',
        desc: 'Số khung hình mỗi giây. Dưới 15 fps hình bắt đầu giật, 24–30 fps là mượt.',
        higherIsBetter: true,
        levels: [24, 15],
        unit: 'fps',
    },
    framesDropped: {
        label: 'Khung hình bị bỏ',
        source: 'inbound-rtp.framesDropped',
        desc: 'Số khung hình đã nhận nhưng bị bỏ, không giải mã hoặc hiển thị (do CPU quá tải hoặc đến quá trễ).',
    },
    freeze: {
        label: 'Số lần đứng hình',
        source: 'inbound-rtp.freezeCount',
        desc: 'Số lần video bị đứng hình đủ lâu để người xem nhận thấy.',
    },
    nackPli: {
        label: 'NACK / PLI',
        source: 'nackCount / pliCount',
        desc: 'NACK: yêu cầu gửi lại gói bị mất. PLI: yêu cầu gửi keyframe mới khi hình bị vỡ. Tăng nhanh nghĩa là mạng đang mất gói.',
    },
    qualityLimit: {
        label: 'Giới hạn chất lượng',
        source: 'outbound-rtp.qualityLimitationReason',
        desc: 'Lý do encoder đang hạ chất lượng video: none (không giới hạn), bandwidth (thiếu băng thông), cpu (CPU quá tải).',
    },
    implementation: {
        label: 'Bộ mã hoá',
        source: 'encoderImplementation / decoderImplementation',
        desc: 'Thư viện mã hoá/giải mã thực tế trình duyệt đang dùng (ví dụ libvpx, OpenH264, hoặc tăng tốc phần cứng).',
    },
};

/* ─────────────────────────────────────────────────────────────
   FORMATTING
   ──────────────────────────────────────────────────────────── */
const DASH = '—';

export function formatBitrate(bps, compact = false) {
    if (bps == null || !Number.isFinite(bps)) return DASH;
    if (bps >= 1e6) return (bps / 1e6).toFixed(compact ? 1 : 2) + ' Mbps';
    if (bps >= 1e3) return (bps / 1e3).toFixed(compact && bps >= 1e5 ? 0 : 1) + ' kbps';
    return Math.round(bps) + ' bps';
}

function formatBytes(b) {
    if (b == null) return DASH;
    if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
    if (b >= 1024) return (b / 1024).toFixed(1) + ' KB';
    return b + ' B';
}

const ms = (v) => (v == null ? DASH : Math.round(v) + ' ms');
const pct = (v, digits = 1) => (v == null ? DASH : v.toFixed(digits) + '%');
const num = (v) => (v == null ? DASH : Number(v).toLocaleString('vi-VN'));
const txt = (v) => (v == null || v === '' ? DASH : String(v));

export function levelOf(metricKey, value) {
    const def = METRICS[metricKey];
    if (!def || !def.levels || value == null || !Number.isFinite(value)) return null;
    const [a, b] = def.levels;
    if (def.higherIsBetter) return value >= a ? 'good' : value >= b ? 'warn' : 'bad';
    return value <= a ? 'good' : value <= b ? 'warn' : 'bad';
}

function stateLevel(state) {
    if (!state) return null;
    if (state === 'connected' || state === 'completed') return 'good';
    if (state === 'failed' || state === 'closed') return 'bad';
    return 'warn';
}

export function thresholdText(metricKey) {
    const def = METRICS[metricKey];
    if (!def || !def.levels) return null;
    const [a, b] = def.levels;
    const u = def.unit ? ' ' + def.unit : '';
    if (def.higherIsBetter) {
        return { good: '≥ ' + a + u, warn: b + '–' + a + u, bad: '< ' + b + u };
    }
    return { good: '≤ ' + a + u, warn: a + '–' + b + u, bad: '> ' + b + u };
}

function row(metric, value, level = null) {
    return { metric, value, level };
}

function audioLevelText(v) {
    return v == null ? DASH : v.toFixed(3);
}

export function summaryCards(state) {
    const c = state.conn;
    const h = state.history;
    return [
        { metric: 'rtt', label: 'RTT', value: ms(c && c.rtt), level: levelOf('rtt', c && c.rtt), series: h.rtt, icon: 'bi-arrow-repeat' },
        { metric: 'bitrateIn', label: 'Nhận', value: formatBitrate(h.bitrateIn[h.bitrateIn.length - 1], true), level: null, series: h.bitrateIn, icon: 'bi-download' },
        { metric: 'bitrateOut', label: 'Gửi', value: formatBitrate(h.bitrateOut[h.bitrateOut.length - 1], true), level: null, series: h.bitrateOut, icon: 'bi-upload' },
    ];
}

export function buildSections(state) {
    const sections = [];
    const c = state.conn;

    if (c) {
        const candidate = c.localType
            ? c.localType + (c.remoteType ? ' → ' + c.remoteType : '')
            : DASH;
        const protocol = c.protocol
            ? c.protocol.toUpperCase() + (c.relayProtocol ? ' (TURN/' + c.relayProtocol.toUpperCase() + ')' : '')
            : DASH;
        sections.push({
            key: 'conn',
            title: 'Kết nối',
            icon: 'bi-diagram-3',
            rows: [
                row('connectionState', txt(c.connectionState), stateLevel(c.connectionState)),
                row('iceState', txt(c.iceState), stateLevel(c.iceState)),
                row('rtt', ms(c.rtt), levelOf('rtt', c.rtt)),
                row('candidate', candidate, c.localType === 'relay' ? 'warn' : null),
                row('protocol', protocol, c.protocol && c.protocol !== 'udp' ? 'warn' : null),
                row('availableOut', formatBitrate(c.availableOut)),
                row('dtls', c.dtlsState ? c.dtlsState + (c.srtpCipher ? ' · ' + c.srtpCipher : '') : DASH,
                    c.dtlsState ? (c.dtlsState === 'connected' ? 'good' : 'warn') : null),
                row('bytesTotal', '↑ ' + formatBytes(c.bytesSent) + '  ↓ ' + formatBytes(c.bytesReceived)),
                row('localAddr', txt(c.localAddr)),
                row('remoteAddr', txt(c.remoteAddr)),
            ],
        });
    }

    const ai = state.audioIn;
    if (ai) {
        const lossText = ai.lossPct == null ? DASH : pct(ai.lossPct) + (ai.packetsLost != null ? ' · ' + num(ai.packetsLost) : '');
        sections.push({
            key: 'audioIn',
            title: 'Audio nhận',
            icon: 'bi-headphones',
            rows: [
                row('codec', txt(ai.codec)),
                row('bitrate', formatBitrate(ai.bitrate)),
                row('packets', num(ai.packets)),
                row('loss', lossText, levelOf('loss', ai.lossPct)),
                row('jitter', ms(ai.jitter), levelOf('jitter', ai.jitter)),
                row('jitterBuffer', ms(ai.jitterBuffer), levelOf('jitterBuffer', ai.jitterBuffer)),
                row('conceal', pct(ai.concealPct), levelOf('conceal', ai.concealPct)),
                row('audioLevel', audioLevelText(ai.audioLevel)),
            ],
        });
    }

    const ao = state.audioOut;
    if (ao) {
        sections.push({
            key: 'audioOut',
            title: 'Audio gửi',
            icon: 'bi-mic',
            rows: [
                row('codec', txt(ao.codec)),
                row('bitrate', formatBitrate(ao.bitrate)),
                row('packets', num(ao.packets)),
                row('remoteLoss', pct(ao.remoteLossPct), levelOf('remoteLoss', ao.remoteLossPct)),
                row('remoteJitter', ms(ao.remoteJitter), levelOf('remoteJitter', ao.remoteJitter)),
                row('retransmit', pct(ao.retransmitPct), levelOf('retransmit', ao.retransmitPct)),
                row('audioLevel', audioLevelText(ao.audioLevel)),
            ],
        });
    }

    const vi = state.videoIn;
    if (vi) {
        sections.push({
            key: 'videoIn',
            title: 'Video nhận',
            icon: 'bi-display',
            rows: [
                row('codec', txt(vi.codec)),
                row('resolution', vi.width ? vi.width + ' × ' + vi.height : DASH),
                row('fps', vi.fps == null ? DASH : Math.round(vi.fps) + ' fps', levelOf('fps', vi.fps)),
                row('bitrate', formatBitrate(vi.bitrate)),
                row('loss', pct(vi.lossPct), levelOf('loss', vi.lossPct)),
                row('jitter', ms(vi.jitter), levelOf('jitter', vi.jitter)),
                row('framesDropped', num(vi.framesDropped)),
                row('freeze', num(vi.freezeCount)),
                row('nackPli', num(vi.nackCount) + ' / ' + num(vi.pliCount)),
                row('implementation', txt(vi.implementation)),
            ],
        });
    }

    const vo = state.videoOut;
    if (vo) {
        sections.push({
            key: 'videoOut',
            title: 'Video gửi',
            icon: 'bi-camera-video',
            rows: [
                row('codec', txt(vo.codec)),
                row('resolution', vo.width ? vo.width + ' × ' + vo.height : DASH),
                row('fps', vo.fps == null ? DASH : Math.round(vo.fps) + ' fps', levelOf('fps', vo.fps)),
                row('bitrate', formatBitrate(vo.bitrate)),
                row('qualityLimit', txt(vo.qualityLimit),
                    vo.qualityLimit ? (vo.qualityLimit === 'none' ? 'good' : 'warn') : null),
                row('remoteLoss', pct(vo.remoteLossPct), levelOf('remoteLoss', vo.remoteLossPct)),
                row('retransmit', pct(vo.retransmitPct), levelOf('retransmit', vo.retransmitPct)),
                row('nackPli', num(vo.nackCount) + ' / ' + num(vo.pliCount)),
                row('implementation', txt(vo.implementation)),
            ],
        });
    }

    return sections;
}

export const SECTION_LABELS = {
    summary: 'Tổng quan',
    conn: 'Kết nối',
    audioIn: 'Audio nhận',
    audioOut: 'Audio gửi',
    videoIn: 'Video nhận',
    videoOut: 'Video gửi',
};

export function qualitySummary(state) {
    const q = state.quality;
    if (!q) return { value: DASH, level: null, verdict: 'Chưa đủ dữ liệu', percent: 0 };
    const level = levelOf('mos', q.mos);
    const verdict = q.mos >= 4.0 ? 'Tốt' : q.mos >= 3.6 ? 'Khá' : q.mos >= 3.1 ? 'Trung bình' : 'Kém';
    return { value: q.mos.toFixed(2), level, verdict, percent: ((q.mos - 1) / 3.5) * 100 };
}

// Live row behind a popover anchor — keeps the popover value ticking with the poller.
export function findRow(state, section, metric) {
    if (section === 'summary') {
        if (metric === 'mos') {
            const q = qualitySummary(state);
            return { metric, value: q.value, level: q.level };
        }
        return summaryCards(state).find((c) => c.metric === metric) || null;
    }
    const s = buildSections(state).find((x) => x.key === section);
    return s ? s.rows.find((r) => r.metric === metric) || null : null;
}
