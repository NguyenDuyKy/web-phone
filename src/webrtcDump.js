import { reactive, markRaw } from 'vue';
import { parseReport, levelOf, formatBitrate } from './webrtcStats';

// Reads a chrome://webrtc-internals dump ("Create a WebRTC-Internals dump" →
// webrtc_internals_dump.txt) and replays its time series through the same
// parser as the live stats, so every view and tooltip works unchanged.

const HISTORY_LENGTH = 40;
const MAX_TICKS = 6 * 3600; // 6 h at 1 s/sample

export const dump = reactive({
    status: 'empty', // empty | loading | ready | error
    error: '',
    fileName: '',
    fileSize: 0,
    userAgent: '',
    peers: [],
    selected: 0,
    cursor: 0,
});

/* ─────────────────────────────────────────────────────────────
   LOADING
   ──────────────────────────────────────────────────────────── */
export async function loadDumpFile(file) {
    dump.status = 'loading';
    dump.error = '';
    dump.fileName = file.name;
    dump.fileSize = file.size;
    // Let the loading state paint before the (synchronous) parse.
    await new Promise((r) => setTimeout(r, 30));
    try {
        const text = await readDumpText(file);
        let json;
        try {
            json = JSON.parse(text);
        } catch (e) {
            if (/^\s*RTCStatsDump/.test(text)) {
                throw new Error('Đây là file "rtcstats dump". Hãy dùng nút Download the "webrtc-internals dump".');
            }
            throw new Error('File không phải JSON hợp lệ.');
        }
        const parsed = parseDump(json);
        dump.userAgent = parsed.userAgent;
        dump.peers = parsed.peers.map((p) => markRaw(p));
        // Start on the connection that actually carried media.
        dump.selected = Math.max(0, dump.peers.reduce((best, p, i, arr) => (p.mediaTicks > arr[best].mediaTicks ? i : best), 0));
        dump.cursor = defaultCursor(dump.peers[dump.selected]);
        dump.status = 'ready';
    } catch (e) {
        dump.status = 'error';
        dump.error = e.message || String(e);
        dump.peers = [];
    }
}

// Recent Chrome versions gzip the dump by default ("Compress result").
async function readDumpText(file) {
    const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
    if (head[0] !== 0x1f || head[1] !== 0x8b) return file.text();
    if (typeof DecompressionStream === 'undefined') {
        throw new Error('Trình duyệt không giải nén được .gz — hãy bỏ chọn "Compress result" khi tải dump.');
    }
    try {
        return await new Response(file.stream().pipeThrough(new DecompressionStream('gzip'))).text();
    } catch (e) {
        throw new Error('Không giải nén được file .gz (file có thể bị hỏng).');
    }
}

export function clearDump() {
    Object.assign(dump, { status: 'empty', error: '', fileName: '', fileSize: 0, userAgent: '', peers: [], selected: 0, cursor: 0 });
}

export function selectDumpPeer(i) {
    dump.selected = i;
    dump.cursor = defaultCursor(dump.peers[i]);
}

function defaultCursor(peer) {
    if (!peer) return 0;
    // First finding worth looking at, else the last sample with media.
    const f = peer.findings.find((x) => x.episodes && x.episodes.length);
    if (f) return f.episodes[0].start;
    for (let i = peer.ticks.length - 1; i >= 0; i--) if (peer.states[i].audioIn || peer.states[i].videoIn) return i;
    return peer.ticks.length - 1;
}

export function selectedDumpPeer() {
    return dump.status === 'ready' ? dump.peers[dump.selected] || null : null;
}

// Stats view state at index i — same shape as the live `rtc` object.
export function dumpStateAt(peer, i) {
    if (!peer || !peer.states.length) return null;
    const idx = Math.max(0, Math.min(i, peer.states.length - 1));
    const from = Math.max(0, idx - HISTORY_LENGTH + 1);
    const slice = (arr) => arr.slice(from, idx + 1);
    return {
        ...peer.states[idx],
        status: 'snapshot',
        updatedAt: peer.ticks[idx],
        history: {
            rtt: slice(peer.series.rtt),
            bitrateIn: slice(peer.series.bitrateIn),
            bitrateOut: slice(peer.series.bitrateOut),
            loss: slice(peer.series.loss),
        },
    };
}

export function currentDumpState() {
    return dumpStateAt(selectedDumpPeer(), dump.cursor);
}

/* ─────────────────────────────────────────────────────────────
   DUMP → TIME SERIES → PER-SECOND STATS
   ──────────────────────────────────────────────────────────── */
function toMs(v) {
    if (typeof v === 'number') return v;
    if (typeof v !== 'string' || !v) return NaN;
    return Date.parse(v);
}

export function parseDump(json) {
    if (!json || typeof json !== 'object' || !json.PeerConnections || typeof json.PeerConnections !== 'object') {
        throw new Error('Không phải file dump của chrome://webrtc-internals (thiếu "PeerConnections").');
    }
    const peers = Object.entries(json.PeerConnections)
        .map(([key, pc], i) => parsePeerDump(key, pc, i + 1))
        .filter(Boolean);
    if (!peers.length) {
        throw new Error('File dump không có số liệu getStats nào. Hãy mở webrtc-internals trước/trong cuộc gọi rồi mới tạo dump.');
    }
    return { userAgent: json.UserAgent || json.userAgent || '', peers };
}

function parsePeerDump(key, pc, index) {
    const raw = (pc && pc.stats) || {};
    const byStat = new Map(); // statId → { type, fields: [[field, series]] }
    let t0 = Infinity;
    let t1 = -Infinity;
    let step = 1000;
    let longest = 0;

    Object.entries(raw).forEach(([k, v]) => {
        // Derived series like "IT01V…-[framesReceived-framesDecoded-framesDropped]" aren't real stats.
        if (!v || k.includes('-[')) return;
        const dash = k.lastIndexOf('-');
        if (dash <= 0) return;
        const id = k.slice(0, dash);
        const field = k.slice(dash + 1);
        if (!field) return;
        let values = v.values;
        if (typeof values === 'string') {
            try { values = JSON.parse(values); } catch (e) { return; }
        }
        if (!Array.isArray(values) || !values.length) return;
        const start = toMs(v.startTime);
        const end = toMs(v.endTime);
        if (!Number.isFinite(start) || !Number.isFinite(end)) return;
        if (!byStat.has(id)) byStat.set(id, { type: v.statsType, fields: [] });
        byStat.get(id).fields.push([field, { start, end, values }]);
        t0 = Math.min(t0, start);
        t1 = Math.max(t1, end);
        if (values.length > longest && end > start) {
            longest = values.length;
            step = (end - start) / (values.length - 1);
        }
    });
    if (!byStat.size || !Number.isFinite(t0)) return null;

    step = Math.max(200, Math.round(step));
    const count = Math.min(MAX_TICKS, Math.floor((t1 - t0) / step) + 1);
    const ticks = Array.from({ length: count }, (_, i) => t0 + i * step);
    const events = parseEvents(pc.updateLog);

    const valueAt = (series, t) => {
        const { start, end, values } = series;
        if (t < start - step / 2 || t > end + step / 2) return undefined;
        if (values.length === 1 || end <= start) return values[0];
        const idx = Math.round(((t - start) / (end - start)) * (values.length - 1));
        return values[Math.max(0, Math.min(values.length - 1, idx))];
    };

    const states = [];
    let prev = new Map();
    ticks.forEach((t) => {
        const report = new Map();
        byStat.forEach((stat, id) => {
            let obj = null;
            stat.fields.forEach(([field, series]) => {
                const v = valueAt(series, t);
                if (v === undefined) return;
                if (!obj) obj = { id, type: stat.type };
                obj[field] = v;
            });
            if (obj) {
                obj.timestamp = t;
                report.set(id, obj);
            }
        });
        const { stats, prev: next } = parseReport(report, prev, pcStateAt(events, t, report));
        prev = next;
        states.push(stats);
    });

    const series = buildSeries(states);
    const mediaTicks = states.filter((s) => s.audioIn || s.videoIn).length;
    const peer = {
        key,
        index,
        url: pc.url || '',
        config: pc.rtcConfiguration || '',
        t0,
        step,
        ticks,
        states,
        series,
        events,
        mediaTicks,
    };
    peer.summary = summarize(peer);
    peer.findings = analyze(peer);
    // Overall verdict weighs the findings too — a good average MOS can hide a 10 s outage.
    const bad = peer.findings.filter((f) => f.level === 'bad').length;
    const warn = peer.findings.filter((f) => f.level === 'warn').length;
    peer.summary.overallLevel = bad ? 'bad' : warn ? 'warn' : peer.summary.mosLevel || 'good';
    peer.summary.overallText = bad
        ? `${bad} vấn đề nghiêm trọng${warn ? ` · ${warn} cảnh báo` : ''}`
        : warn ? `${warn} cảnh báo` : 'Không phát hiện vấn đề';
    return peer;
}

function parseEvents(log) {
    if (!Array.isArray(log)) return [];
    return log
        .map((e) => ({
            // Newer dumps: numeric `timestamp` + "onconnectionstatechange"; older: `time` string, no "on".
            t: toMs(e.timestamp != null ? e.timestamp : e.time),
            type: String(e.type || '').replace(/^on/, ''),
            value: String(e.value == null ? '' : e.value).replace(/^"|"$/g, ''),
        }))
        .filter((e) => Number.isFinite(e.t))
        .sort((a, b) => a.t - b.t);
}

function pcStateAt(events, t, report) {
    let connectionState = null;
    let iceConnectionState = null;
    for (const e of events) {
        if (e.t > t) break;
        if (e.type === 'connectionstatechange') connectionState = e.value;
        else if (e.type === 'iceconnectionstatechange') iceConnectionState = e.value;
    }
    if (!connectionState || !iceConnectionState) {
        // Older dumps / missing log: infer from the transport stats.
        let transport = null;
        report.forEach((s) => { if (s.type === 'transport' && !transport) transport = s; });
        if (transport) {
            iceConnectionState = iceConnectionState || transport.iceState || null;
            if (!connectionState && transport.dtlsState) {
                connectionState = transport.dtlsState === 'connected' ? 'connected'
                    : transport.dtlsState === 'failed' ? 'failed' : 'connecting';
            }
        }
    }
    return { connectionState, iceConnectionState };
}

function buildSeries(states) {
    const sum = (...vals) => {
        const xs = vals.filter((v) => v != null);
        return xs.length ? xs.reduce((a, b) => a + b, 0) : null;
    };
    const pick = (fn) => states.map((s) => {
        try { const v = fn(s); return v == null || !Number.isFinite(v) ? null : v; } catch (e) { return null; }
    });
    return {
        rtt: pick((s) => s.conn && s.conn.rtt),
        bitrateIn: pick((s) => sum(s.audioIn && s.audioIn.bitrate, s.videoIn && s.videoIn.bitrate)),
        bitrateOut: pick((s) => sum(s.audioOut && s.audioOut.bitrate, s.videoOut && s.videoOut.bitrate)),
        loss: pick((s) => s.audioIn && s.audioIn.lossPct),
        jitter: pick((s) => s.audioIn && s.audioIn.jitter),
        mos: pick((s) => s.quality && s.quality.mos),
        conceal: pick((s) => s.audioIn && s.audioIn.concealPct),
        remoteLoss: pick((s) => s.audioOut && s.audioOut.remoteLossPct),
        audioInBitrate: pick((s) => s.audioIn && s.audioIn.bitrate),
        audioOutBitrate: pick((s) => s.audioOut && s.audioOut.bitrate),
        audioInLevel: pick((s) => s.audioIn && s.audioIn.audioLevel),
        audioOutLevel: pick((s) => s.audioOut && s.audioOut.audioLevel),
        fpsIn: pick((s) => s.videoIn && s.videoIn.fps),
        freezeIn: pick((s) => s.videoIn && s.videoIn.freezeCount),
    };
}

/* ─────────────────────────────────────────────────────────────
   ANALYSIS
   ──────────────────────────────────────────────────────────── */
const nums = (arr) => arr.filter((v) => v != null);
const avg = (arr) => { const xs = nums(arr); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; };
const max = (arr) => { const xs = nums(arr); return xs.length ? Math.max(...xs) : null; };
const min = (arr) => { const xs = nums(arr); return xs.length ? Math.min(...xs) : null; };
function pctile(arr, p) {
    const xs = nums(arr).sort((a, b) => a - b);
    if (!xs.length) return null;
    return xs[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))];
}

// Runs of consecutive ticks matching `pred`; short gaps are bridged.
function episodes(n, pred, { minLen = 2, gap = 2 } = {}) {
    const out = [];
    let cur = null;
    for (let i = 0; i < n; i++) {
        if (pred(i)) {
            if (cur && i - cur.end <= gap + 1) cur.end = i;
            else {
                if (cur) out.push(cur);
                cur = { start: i, end: i };
            }
        }
    }
    if (cur) out.push(cur);
    return out.filter((e) => e.end - e.start + 1 >= minLen);
}

export function formatOffset(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(sec).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function duration(peer, eps) {
    const total = eps.reduce((a, e) => a + (e.end - e.start + 1), 0);
    return formatOffset(total * peer.step);
}

function summarize(peer) {
    const { series, states, ticks, step } = peer;
    const first = states.findIndex((s) => s.audioIn || s.videoIn);
    let last = -1;
    for (let i = states.length - 1; i >= 0; i--) if (states[i].audioIn || states[i].videoIn) { last = i; break; }
    const lastState = states[states.length - 1] || {};
    const lastAudio = [...states].reverse().find((s) => s.audioIn) || {};
    const ai = lastAudio.audioIn || {};
    const totalLoss = ai.packetsLost != null && ai.packets != null && ai.packets + ai.packetsLost > 0
        ? (Math.max(0, ai.packetsLost) / (ai.packets + Math.max(0, ai.packetsLost))) * 100
        : null;
    const mosAvg = avg(series.mos);
    return {
        start: ticks[0],
        duration: formatOffset((ticks.length - 1) * step),
        mediaDuration: first >= 0 ? formatOffset((last - first + 1) * step) : '00:00',
        mosAvg,
        mosMin: min(series.mos),
        mosLevel: levelOf('mos', mosAvg),
        verdict: mosAvg == null ? 'Không có audio' : mosAvg >= 4.0 ? 'Tốt' : mosAvg >= 3.6 ? 'Khá' : mosAvg >= 3.1 ? 'Trung bình' : 'Kém',
        rttAvg: avg(series.rtt),
        rttP95: pctile(series.rtt, 95),
        jitterAvg: avg(series.jitter),
        totalLoss,
        hasVideo: states.some((s) => s.videoIn || s.videoOut),
        candidate: lastState.conn && lastState.conn.localType
            ? lastState.conn.localType + (lastState.conn.remoteType ? ' → ' + lastState.conn.remoteType : '')
            : null,
    };
}

function analyze(peer) {
    const { series: S, states, ticks } = peer;
    const n = ticks.length;
    const findings = [];
    const add = (f) => findings.push(f);
    const live = (i) => !!(states[i].audioIn || states[i].videoIn);

    if (!peer.mediaTicks) {
        add({ level: 'bad', icon: 'bi-slash-circle', title: 'Không có luồng media', detail: 'Kết nối này không truyền audio/video nào trong suốt thời gian ghi.', metric: 'connectionState', section: 'conn' });
        return findings;
    }

    // Connection drops (ICE / peer connection state)
    const dropEps = episodes(n, (i) => {
        const c = states[i].conn;
        return !!c && ['disconnected', 'failed'].includes(c.connectionState || c.iceState);
    }, { minLen: 1, gap: 1 });
    const failed = states.some((s) => s.conn && (s.conn.connectionState === 'failed' || s.conn.iceState === 'failed'));
    if (dropEps.length) {
        add({
            level: failed ? 'bad' : 'warn', icon: 'bi-wifi-off', metric: 'iceState', section: 'conn', episodes: dropEps,
            title: failed ? 'Kết nối bị đứt (failed)' : `Kết nối chập chờn ${dropEps.length} lần`,
            detail: `ICE/kết nối rơi vào trạng thái disconnected${failed ? '/failed' : ''}, tổng ${duration(peer, dropEps)}.`,
        });
    }

    // One-way / no audio: zero inbound or outbound audio bytes for ≥ 3 s while connected
    const noIn = episodes(n, (i) => live(i) && S.audioInBitrate[i] === 0, { minLen: 3, gap: 1 });
    if (noIn.length) {
        add({
            level: 'bad', icon: 'bi-volume-mute', metric: 'bitrate', section: 'audioIn', episodes: noIn,
            title: 'Không nhận được âm thanh',
            detail: `Luồng audio đến dừng hẳn (0 bps) ${noIn.length} lần, tổng ${duration(peer, noIn)} — người dùng sẽ không nghe thấy đầu bên kia.`,
        });
    }
    const noOut = episodes(n, (i) => live(i) && S.audioOutBitrate[i] === 0, { minLen: 3, gap: 1 });
    if (noOut.length) {
        add({
            level: 'bad', icon: 'bi-mic-mute', metric: 'bitrate', section: 'audioOut', episodes: noOut,
            title: 'Không gửi được âm thanh',
            detail: `Luồng audio gửi đi dừng hẳn (0 bps) ${noOut.length} lần, tổng ${duration(peer, noOut)} — đầu bên kia không nghe thấy bạn.`,
        });
    }

    // Silent mic / silent remote (packets flow but level is ~0 for the whole call)
    const outLevelMax = max(S.audioOutLevel);
    if (outLevelMax != null && outLevelMax < 0.001 && nums(S.audioOutBitrate).some((b) => b > 0)) {
        add({ level: 'warn', icon: 'bi-mic-mute', metric: 'audioLevel', section: 'audioOut', title: 'Micro không có tín hiệu', detail: 'Mức âm lượng micro bằng 0 suốt cuộc gọi — micro bị tắt, sai thiết bị hoặc không có quyền.' });
    }
    const inLevelMax = max(S.audioInLevel);
    if (inLevelMax != null && inLevelMax < 0.001 && nums(S.audioInBitrate).some((b) => b > 0)) {
        add({ level: 'warn', icon: 'bi-volume-off', metric: 'audioLevel', section: 'audioIn', title: 'Âm thanh nhận được toàn im lặng', detail: 'Gói audio vẫn đến nhưng mức âm lượng bằng 0 suốt cuộc gọi.' });
    }

    // Packet loss (downlink)
    const lossBad = episodes(n, (i) => S.loss[i] != null && S.loss[i] > 5);
    const lossWarn = episodes(n, (i) => S.loss[i] != null && S.loss[i] > 1);
    const lossTotal = peer.summary ? peer.summary.totalLoss : null;
    if (lossBad.length || lossWarn.length) {
        const bad = lossBad.length > 0;
        add({
            level: bad ? 'bad' : 'warn', icon: 'bi-reception-1', metric: 'loss', section: 'audioIn',
            episodes: bad ? lossBad : lossWarn,
            title: bad ? 'Mất gói nặng (chiều nhận)' : 'Mất gói nhẹ (chiều nhận)',
            detail: `Đỉnh ${max(S.loss).toFixed(1)}%, ${(bad ? lossBad : lossWarn).length} đợt, tổng ${duration(peer, bad ? lossBad : lossWarn)} vượt ${bad ? 5 : 1}%.`
                + (lossTotal != null ? ` Cả cuộc gọi: ${lossTotal.toFixed(2)}%.` : ''),
        });
    }

    // Packet loss (uplink, from RTCP receiver reports)
    const upBad = episodes(n, (i) => S.remoteLoss[i] != null && S.remoteLoss[i] > 5);
    const upWarn = episodes(n, (i) => S.remoteLoss[i] != null && S.remoteLoss[i] > 1);
    if (upBad.length || upWarn.length) {
        const bad = upBad.length > 0;
        add({
            level: bad ? 'bad' : 'warn', icon: 'bi-upload', metric: 'remoteLoss', section: 'audioOut',
            episodes: bad ? upBad : upWarn,
            title: bad ? 'Mất gói nặng (chiều gửi)' : 'Mất gói nhẹ (chiều gửi)',
            detail: `Đầu bên kia báo mất tới ${max(S.remoteLoss).toFixed(1)}% gói bạn gửi — mạng upload của bạn đang có vấn đề.`,
        });
    }

    // RTT
    const rttP95 = pctile(S.rtt, 95);
    if (rttP95 != null && rttP95 > 150) {
        const bad = rttP95 > 300;
        const eps = episodes(n, (i) => S.rtt[i] != null && S.rtt[i] > (bad ? 300 : 150));
        add({
            level: bad ? 'bad' : 'warn', icon: 'bi-hourglass-split', metric: 'rtt', section: 'conn', episodes: eps,
            title: bad ? 'Độ trễ rất cao' : 'Độ trễ cao',
            detail: `RTT trung bình ${Math.round(avg(S.rtt))} ms, p95 ${Math.round(rttP95)} ms, cao nhất ${Math.round(max(S.rtt))} ms.`,
        });
    }

    // Jitter
    const jitP95 = pctile(S.jitter, 95);
    if (jitP95 != null && jitP95 > 30) {
        const bad = jitP95 > 50;
        const eps = episodes(n, (i) => S.jitter[i] != null && S.jitter[i] > (bad ? 50 : 30));
        add({
            level: bad ? 'bad' : 'warn', icon: 'bi-activity', metric: 'jitter', section: 'audioIn', episodes: eps,
            title: bad ? 'Jitter cao' : 'Jitter hơi cao',
            detail: `Jitter p95 ${Math.round(jitP95)} ms, cao nhất ${Math.round(max(S.jitter))} ms — dễ gây méo tiếng, trễ.`,
        });
    }

    // Concealment (robotic audio)
    const plcEps = episodes(n, (i) => S.conceal[i] != null && S.conceal[i] > 8);
    if (plcEps.length) {
        add({
            level: 'warn', icon: 'bi-soundwave', metric: 'conceal', section: 'audioIn', episodes: plcEps,
            title: 'Tiếng bị méo / "robot"',
            detail: `Hơn 8% mẫu âm thanh phải nội suy (PLC) trong ${plcEps.length} đợt, tổng ${duration(peer, plcEps)}.`,
        });
    }

    // MOS
    const mosAvg = avg(S.mos);
    if (mosAvg != null && mosAvg < 3.6) {
        add({
            level: mosAvg < 3.1 ? 'bad' : 'warn', icon: 'bi-emoji-frown', metric: 'mos', section: 'summary',
            episodes: episodes(n, (i) => S.mos[i] != null && S.mos[i] < 3.6),
            title: 'Chất lượng thoại thấp',
            detail: `MOS trung bình ${mosAvg.toFixed(2)}, thấp nhất ${min(S.mos).toFixed(2)}.`,
        });
    }

    // Route: TURN relay / TCP
    const relayIdx = states.findIndex((s) => s.conn && s.conn.localType === 'relay');
    if (relayIdx >= 0) {
        const c = states[relayIdx].conn;
        add({
            level: 'info', icon: 'bi-hdd-network', metric: 'candidate', section: 'conn', at: relayIdx,
            title: 'Đi qua TURN relay',
            detail: `Media được chuyển tiếp qua TURN server${c.relayProtocol ? ' (' + c.relayProtocol.toUpperCase() + ')' : ''} — thường do NAT/firewall chặn kết nối trực tiếp, độ trễ tăng.`,
        });
    }
    const tcpIdx = states.findIndex((s) => s.conn && s.conn.protocol && s.conn.protocol !== 'udp');
    if (tcpIdx >= 0) {
        add({
            level: 'warn', icon: 'bi-shield-lock', metric: 'protocol', section: 'conn', at: tcpIdx,
            title: 'Media đi qua TCP',
            detail: 'Mạng chặn UDP nên media phải đi TCP — mất gói sẽ biến thành trễ và giật.',
        });
    }

    // Video
    const freezes = max(S.freezeIn);
    if (freezes) {
        add({
            level: 'warn', icon: 'bi-pause-btn', metric: 'freeze', section: 'videoIn',
            episodes: episodes(n, (i) => i > 0 && S.freezeIn[i] != null && S.freezeIn[i - 1] != null && S.freezeIn[i] > S.freezeIn[i - 1], { minLen: 1, gap: 0 }),
            title: `Video đứng hình ${freezes} lần`,
            detail: 'Video nhận bị đứng đủ lâu để người xem nhận thấy.',
        });
    }
    const lowFps = episodes(n, (i) => S.fpsIn[i] != null && S.fpsIn[i] < 15, { minLen: 5, gap: 2 });
    if (lowFps.length) {
        add({
            level: 'warn', icon: 'bi-film', metric: 'fps', section: 'videoIn', episodes: lowFps,
            title: 'Video nhận bị giật (< 15 fps)',
            detail: `${lowFps.length} đợt, tổng ${duration(peer, lowFps)}.`,
        });
    }
    const limited = states.filter((s) => s.videoOut && s.videoOut.qualityLimit && s.videoOut.qualityLimit !== 'none');
    const withVideoOut = states.filter((s) => s.videoOut).length;
    if (withVideoOut && limited.length / withVideoOut > 0.2) {
        const reasons = {};
        limited.forEach((s) => { reasons[s.videoOut.qualityLimit] = (reasons[s.videoOut.qualityLimit] || 0) + 1; });
        const top = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0][0];
        add({
            level: 'warn', icon: 'bi-speedometer', metric: 'qualityLimit', section: 'videoOut',
            episodes: episodes(n, (i) => !!(states[i].videoOut && states[i].videoOut.qualityLimit && states[i].videoOut.qualityLimit !== 'none')),
            title: `Video gửi bị giới hạn bởi ${top === 'cpu' ? 'CPU' : top === 'bandwidth' ? 'băng thông' : top}`,
            detail: `Encoder phải hạ chất lượng ${Math.round((limited.length / withVideoOut) * 100)}% thời gian.`,
        });
    }

    const order = { bad: 0, warn: 1, info: 2, good: 3 };
    findings.sort((a, b) => order[a.level] - order[b.level]);
    if (!findings.some((f) => f.level === 'bad' || f.level === 'warn')) {
        findings.push({
            level: 'good', icon: 'bi-check2-circle', metric: 'mos', section: 'summary',
            title: 'Không phát hiện vấn đề đáng kể',
            detail: `RTT, jitter và mất gói đều trong ngưỡng tốt${S.bitrateIn.some((v) => v) ? ` · bitrate nhận trung bình ${formatBitrate(avg(S.bitrateIn))}` : ''}.`,
        });
    }
    return findings;
}
