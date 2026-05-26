import { reactive } from 'vue';
import { STRINGEE_SERVERS } from './constants';

export const store = reactive({
    isConnected: false,
    isConnecting: false,
    userId: '',
    client: null,
    serverConfig: null,
    serverKey: '',

    token: '',
    hotline: '',
    dialInput: '',
    ttsWorkerUrl: '',

    currentCall: null,
    isVideoCall: false,
    callState: 'idle',
    callerNumber: '',
    callStatusText: 'Đang kết nối...',
    isRinging: false,
    callSeconds: 0,
    callTimerDisplay: '00:00',
    _timerInterval: null,
    isMuted: false,
    isVideoEnabled: true,

    hasIncoming: false,
    incomingNumber: '',
    incomingIsVideo: false,

    errorModal: { active: false, title: '', message: '' },
    infoModal: { active: false, input: '' },
    configModal: { active: false, token: '', hotline: '', toNumber: '', ttsWorkerUrl: '' },
    callModal: { active: false },
    ttsModal: {
        active: false,
        text: '',
        voice: '',
        speed: 1,
        isPlaying: false,
        loading: false,
        error: '',
        availableVoices: [],
        audioUrl: '',
    },

    callType: 'gsm',

    theme: 'dark',

    sidebarOpen: false,

    logs: [],
});

const CONFIG_STORAGE_KEY = 'stringee_default_config';
const THEME_STORAGE_KEY = 'stringee_theme';
const CALL_TYPE_STORAGE_KEY = 'stringee_call_type';

const videoHandlers = {
    onAddRemoteTrack: null,
    onAddLocalTrack: null,
    onAddRemoteStream: null,
    resetVideos: null,
};

const pendingMedia = {
    remoteTracks: [],
    localTracks: [],
    remoteStream: null,
};

function clearPendingMedia() {
    pendingMedia.remoteTracks = [];
    pendingMedia.localTracks = [];
    pendingMedia.remoteStream = null;
}

export function registerVideoHandlers(handlers) {
    Object.assign(videoHandlers, handlers);
    if (pendingMedia.remoteStream && videoHandlers.onAddRemoteStream) {
        try { videoHandlers.onAddRemoteStream(pendingMedia.remoteStream); } catch (e) { /* noop */ }
        pendingMedia.remoteStream = null;
    }
    if (pendingMedia.remoteTracks.length && videoHandlers.onAddRemoteTrack) {
        pendingMedia.remoteTracks.forEach((t) => {
            try { videoHandlers.onAddRemoteTrack(t); } catch (e) { /* noop */ }
        });
        pendingMedia.remoteTracks = [];
    }
    if (pendingMedia.localTracks.length && videoHandlers.onAddLocalTrack) {
        pendingMedia.localTracks.forEach((t) => {
            try { videoHandlers.onAddLocalTrack(t); } catch (e) { /* noop */ }
        });
        pendingMedia.localTracks = [];
    }
}

export function clearVideoHandlers() {
    videoHandlers.onAddRemoteTrack = null;
    videoHandlers.onAddLocalTrack = null;
    videoHandlers.onAddRemoteStream = null;
    videoHandlers.resetVideos = null;
}

export function addLog(msg, type = 'info') {
    const time = new Date().toLocaleTimeString('vi-VN');
    store.logs.push({ time, msg, type });
    console.log(`[${type.toUpperCase()}] ${msg}`);
}

export function showErrorModal(title, message) {
    store.errorModal.active = true;
    store.errorModal.title = title;
    store.errorModal.message = message;
}

export function closeErrorModal() {
    store.errorModal.active = false;
}

export async function initEnv() {
    loadTheme();
    store.serverConfig = STRINGEE_SERVERS;
    loadDefaultConfig();
    loadCallType();
    initTtsVoices();
}

function loadCallType() {
    try {
        const saved = localStorage.getItem(CALL_TYPE_STORAGE_KEY);
        if (saved && ['gsm', 'internal', 'video'].includes(saved)) {
            store.callType = saved;
        }
    } catch (e) { /* noop */ }
}

export function setCallType(type) {
    if (!['gsm', 'internal', 'video'].includes(type)) return;
    store.callType = type;
    try { localStorage.setItem(CALL_TYPE_STORAGE_KEY, type); } catch (e) { /* noop */ }
}

function applyTheme() {
    document.documentElement.setAttribute('data-theme', store.theme);
}

function loadTheme() {
    try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        store.theme = saved === 'light' ? 'light' : 'dark';
    } catch (e) {
        store.theme = 'dark';
    }
    applyTheme();
}

export function toggleTheme() {
    store.theme = store.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    try {
        localStorage.setItem(THEME_STORAGE_KEY, store.theme);
    } catch (e) { /* noop */ }
    addLog(
        'Đã chuyển sang giao diện ' + (store.theme === 'light' ? 'sáng' : 'tối'),
        'info'
    );
}

export function toggleSidebar() {
    const willOpen = !store.sidebarOpen;
    store.sidebarOpen = willOpen;
    if (willOpen) {
        // Avoid stacking with bottom-sheet popovers on mobile.
        store.callModal.active = false;
        store.ttsModal.active = false;
    }
}

export function closeSidebar() {
    store.sidebarOpen = false;
}

function loadDefaultConfig() {
    try {
        const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (!raw) {
            addLog('Chưa có cấu hình mặc định trong localStorage, vui lòng nhập thủ công.', 'info');
            return;
        }
        const data = JSON.parse(raw);
        if (data.token) store.token = data.token;
        if (data.hotline) store.hotline = data.hotline;
        if (data.toNumber) store.dialInput = data.toNumber;
        if (data.ttsWorkerUrl) store.ttsWorkerUrl = data.ttsWorkerUrl;
        addLog('Đã nạp cấu hình mặc định từ localStorage', 'info');
    } catch (err) {
        addLog('Lỗi đọc cấu hình mặc định: ' + err.message, 'error');
    }
}

export function openConfigModal() {
    let saved = {};
    try {
        const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (raw) saved = JSON.parse(raw);
    } catch (e) { /* noop */ }
    store.configModal.token = saved.token || store.token || '';
    store.configModal.hotline = saved.hotline || store.hotline || '';
    store.configModal.toNumber = saved.toNumber || store.dialInput || '';
    store.configModal.ttsWorkerUrl = saved.ttsWorkerUrl || store.ttsWorkerUrl || '';
    store.configModal.active = true;
}

export function closeConfigModal() {
    store.configModal.active = false;
}

function normalizeWorkerUrl(url) {
    if (!url) return '';
    let u = url.trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    return u.replace(/\/+$/, '');
}

export function saveDefaultConfig() {
    const normalizedUrl = normalizeWorkerUrl(store.configModal.ttsWorkerUrl);
    store.configModal.ttsWorkerUrl = normalizedUrl;
    const data = {
        token: store.configModal.token.trim(),
        hotline: store.configModal.hotline.trim(),
        toNumber: store.configModal.toNumber.trim(),
        ttsWorkerUrl: normalizedUrl,
    };
    try {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(data));
        if (data.token) store.token = data.token;
        if (data.hotline) store.hotline = data.hotline;
        if (data.toNumber) store.dialInput = data.toNumber;
        const prevUrl = store.ttsWorkerUrl;
        store.ttsWorkerUrl = data.ttsWorkerUrl;
        if (prevUrl !== data.ttsWorkerUrl) {
            store.ttsModal.voice = '';
            store.ttsModal.availableVoices = [];
            initTtsVoices();
        }
        addLog('Đã lưu cấu hình mặc định vào localStorage', 'success');
        closeConfigModal();
    } catch (err) {
        addLog('Lỗi lưu cấu hình: ' + err.message, 'error');
    }
}

export function clearDefaultConfig() {
    try {
        localStorage.removeItem(CONFIG_STORAGE_KEY);
        store.configModal.token = '';
        store.configModal.hotline = '';
        store.configModal.toNumber = '';
        store.configModal.ttsWorkerUrl = '';
        addLog('Đã xoá cấu hình mặc định trong localStorage', 'warn');
    } catch (err) {
        addLog('Lỗi xoá cấu hình: ' + err.message, 'error');
    }
}

export function handleConnect() {
    const token = store.token.trim();
    if (!token) {
        addLog('Vui lòng nhập Access Token', 'error');
        return;
    }
    addLog('Đang kết nối đến Stringee Server...', 'info');
    store.isConnecting = true;

    if (typeof StringeeUtil !== 'undefined') {
        addLog('WebRTC Support: ' + StringeeUtil.isWebRTCSupported(), 'info');
    }

    const key = store.serverKey;
    if (key && store.serverConfig && store.serverConfig[key]) {
        store.client = new StringeeClient(store.serverConfig[key]);
        addLog('Khởi tạo StringeeClient với server: ' + key, 'info');
    } else {
        store.client = new StringeeClient();
        addLog('Khởi tạo StringeeClient với server mặc định', 'info');
    }

    setupClientEvents(store.client);
    store.client.connect(token);
}

export function handleDisconnect() {
    if (store.client) {
        store.client.disconnect();
        store.client = null;
    }
    setDisconnected();
    addLog('Đã ngắt kết nối', 'warn');
}

function setupClientEvents(c) {
    c.on('connect', () => addLog('Đã kết nối đến Stringee Server', 'success'));

    c.on('authen', (res) => {
        if (res.r === 0) {
            addLog('Xác thực thành công! User ID: ' + res.userId, 'success');
            setConnected(res.userId);
        } else {
            addLog('Xác thực thất bại: ' + JSON.stringify(res), 'error');
            setDisconnected();
        }
    });

    c.on('disconnect', () => {
        addLog('Mất kết nối đến Stringee Server', 'warn');
        setDisconnected();
    });

    c.on('requestnewtoken', () => {
        addLog('Token hết hạn! Vui lòng lấy token mới và kết nối lại.', 'error');
        setDisconnected();
    });

    c.on('incomingcall', (call) => {
        addLog('Cuộc gọi thoại đến từ: ' + call.fromNumber, 'success');
        handleIncomingCall(call, false);
    });

    c.on('incomingcall2', (call) => {
        addLog('Cuộc gọi video đến từ: ' + call.fromNumber, 'success');
        handleIncomingCall(call, true);
    });

    c.on('otherdeviceauthen', (data) => addLog('[Client] Other device authen: ' + JSON.stringify(data), 'info'));
    c.on('messagefromtopic', (data) => addLog('[Client] Message from topic: ' + JSON.stringify(data), 'info'));
    c.on('custommessage', (data) => addLog('[Client] Custom message: ' + JSON.stringify(data), 'info'));
}

function setConnected(userId) {
    store.isConnected = true;
    store.isConnecting = false;
    store.userId = userId;
}

function setDisconnected() {
    store.isConnected = false;
    store.isConnecting = false;
    store.userId = '';
}

export function dialPress(key) {
    if (store.currentCall) {
        sendDtmf(key);
    } else {
        store.dialInput += key;
    }
}

export function dialBackspace() {
    store.dialInput = store.dialInput.slice(0, -1);
}

export function sendDtmf(key) {
    if (!store.currentCall) return;
    try {
        store.currentCall.sendDtmf(key, () => addLog('DTMF sent: ' + key, 'info'));
    } catch (e) {
        addLog('DTMF error: ' + e.message, 'error');
    }
}

export function makeCall() {
    if (!store.isConnected || !store.client) {
        showErrorModal('Chưa kết nối', 'Vui lòng kết nối Stringee Server trước khi thực hiện cuộc gọi.');
        return;
    }
    const hotline = store.hotline.trim();
    if (!hotline) {
        showErrorModal('Chưa nhập số Hotline', 'Vui lòng nhập số Hotline ở thanh bên trái trước khi gọi ra. Đây là số hiển thị khi gọi đến khách hàng.');
        return;
    }
    const toNumber = store.dialInput.trim();
    if (!toNumber) {
        showErrorModal('Chưa nhập số đích', 'Vui lòng nhập số điện thoại hoặc User ID cần gọi vào bàn phím bên phải.');
        return;
    }

    const callType = store.callType || 'gsm';
    const isVideo = callType === 'video';

    const typeLabel =
        callType === 'video' ? 'video'
            : callType === 'internal' ? 'thoại nội bộ'
                : 'thoại GSM';
    addLog(`Đang gọi ${typeLabel} từ ${hotline} đến: ${toNumber}`, 'info');

    let call;
    if (isVideo) {
        call = new StringeeCall2(store.client, hotline, toNumber, true);
        setupCall2Events(call);
    } else {
        call = new StringeeCall(store.client, hotline, toNumber, false);
        call.custom = JSON.stringify({
            call_setting: {
                to_type: callType === 'gsm' ? 'external' : 'internal',
                channel: 'voice',
            },
        });
        setupCallEvents(call);
    }
    store.currentCall = call;
    store.isVideoCall = isVideo;

    showCallingUI(toNumber, isVideo);
    store.callModal.active = false;

    call.makeCall((res) => {
        const prefix = call.isVideoCall ? '[Call2]' : '[Call1]';
        addLog(prefix + ' Make call result: ' + JSON.stringify(res), res.r === 0 ? 'success' : 'error');
        if (res.r !== 0) endCallUI();
    });
}

function handleIncomingCall(incoming, isVideo) {
    store.currentCall = incoming;
    store.isVideoCall = isVideo;
    if (isVideo) setupCall2Events(incoming);
    else setupCallEvents(incoming);

    store.hasIncoming = true;
    store.incomingNumber = incoming.fromNumber || 'Không xác định';
    store.incomingIsVideo = isVideo;
    store.callModal.active = true;

    const ringtone = document.getElementById('ringtone');
    if (ringtone) {
        try { ringtone.play().catch(() => { }); } catch (e) { /* noop */ }
    }
}

export function answerCall() {
    if (!store.currentCall) return;
    store.hasIncoming = false;
    store.callModal.active = false;
    stopRingtone();

    const number = store.currentCall.fromNumber || 'Unknown';
    showCallingUI(number, store.isVideoCall);

    store.currentCall.answer((res) => {
        const prefix = store.currentCall.isVideoCall ? '[Call2]' : '[Call1]';
        addLog(prefix + ' Answer result: ' + JSON.stringify(res), res.r === 0 ? 'success' : 'error');
        if (res.r === 0) {
            store.callStatusText = 'Đang đàm thoại';
            startCallTimer();
        }
    });
}

export function rejectCall() {
    if (!store.currentCall) return;
    store.hasIncoming = false;
    store.callModal.active = false;
    stopRingtone();
    store.currentCall.reject((res) => {
        const prefix = store.currentCall.isVideoCall ? '[Call2]' : '[Call1]';
        addLog(prefix + ' Reject result: ' + JSON.stringify(res), 'warn');
    });
    store.currentCall = null;
    endCallUI();
}

function setupCall2Events(call) {
    call.on('addremotetrack', (track) => {
        addLog('[Call2] Remote track received', 'success');
        if (videoHandlers.onAddRemoteTrack) videoHandlers.onAddRemoteTrack(track);
        else pendingMedia.remoteTracks.push(track);
    });

    call.on('addlocaltrack', (track) => {
        addLog('[Call2] Local track received', 'success');
        if (videoHandlers.onAddLocalTrack) videoHandlers.onAddLocalTrack(track);
        else pendingMedia.localTracks.push(track);
    });

    call.on('removeremotetrack', (track) => track.detachAndRemove());
    call.on('removelocaltrack', (track) => track.detachAndRemove());

    call.on('signalingstate', (state) => {
        addLog('[Call2] Signaling: ' + state.reason + ' (code: ' + state.code + ')', 'info');
        updateCallStatus(state);
    });

    call.on('mediastate', (state) => addLog('[Call2] Media state: ' + state.code + ' - ' + state.reason, 'info'));
    call.on('info', (info) => addLog('[Call2] Received info: ' + JSON.stringify(info), 'info'));

    call.on('otherdevice', (data) => {
        addLog('[Call2] Other device state: ' + JSON.stringify(data), 'info');
        if (data && data.type === 'CALL2_STATE' && (data.code === 200 || data.code === 486)) {
            store.hasIncoming = false;
            stopRingtone();
        }
    });
}

function setupCallEvents(call) {
    call.on('addremotestream', (stream) => {
        addLog('[Call1] Remote stream received', 'success');
        if (videoHandlers.onAddRemoteStream) videoHandlers.onAddRemoteStream(stream);
        else pendingMedia.remoteStream = stream;
    });

    call.on('addlocalstream', () => addLog('[Call1] Local stream received', 'success'));

    call.on('signalingstate', (state) => {
        addLog('[Call1] Signaling: ' + state.reason + ' (code: ' + state.code + ')', 'info');
        updateCallStatus(state);
    });

    call.on('mediastate', (state) => addLog('[Call1] Media state: ' + state.code + ' - ' + state.reason, 'info'));
    call.on('info', (info) => addLog('[Call1] Received info: ' + JSON.stringify(info), 'info'));

    call.on('otherdevice', (data) => {
        addLog('[Call] Other device state: ' + JSON.stringify(data), 'info');
        if (data && data.type === 'CALL_STATE' && (data.code === 200 || data.code === 486)) {
            store.hasIncoming = false;
            stopRingtone();
        }
    });
}

function updateCallStatus(state) {
    const statusMap = {
        1: 'Đang gọi...',
        2: 'Đang đổ chuông...',
        3: 'Đã kết nối',
        4: 'Đã kết nối',
        5: 'Bận',
        6: 'Kết thúc cuộc gọi',
    };
    store.callStatusText = state.reason || statusMap[state.code] || 'Đang xử lý...';

    if (state.code === 5 || state.code === 6) {
        stopCallTimer();
        setTimeout(() => endCallUI(), 1500);
    }
    store.isRinging = state.code === 2;
    if (state.code === 3 || state.code === 4) {
        store.callStatusText = 'Đang đàm thoại';
        startCallTimer();
    }
}

export function hangupCall() {
    if (!store.currentCall) return;
    store.currentCall.hangup((res) => {
        addLog('Hangup result: ' + JSON.stringify(res), 'warn');
        if (res.r === 0 || res.r === -1) {
            stopCallTimer();
            endCallUI();
        }
    });
}

export function toggleMute() {
    if (!store.currentCall) return;
    store.isMuted = !store.isMuted;
    store.currentCall.mute(store.isMuted);
    addLog(store.isMuted ? 'Đã tắt mic' : 'Đã bật mic', 'info');
}

export function toggleSpeaker() {
    addLog('Speaker toggle (browser limited)', 'warn');
}

export function openCallModal() {
    store.callModal.active = true;
    store.sidebarOpen = false;
}

export function closeCallModal() {
    store.callModal.active = false;
}

export function toggleCallModal() {
    store.callModal.active = !store.callModal.active;
    if (store.callModal.active) store.sidebarOpen = false;
}

export function openTtsModal() {
    store.ttsModal.active = true;
    store.sidebarOpen = false;
}

export function closeTtsModal() {
    store.ttsModal.active = false;
}

export function toggleTtsModal() {
    store.ttsModal.active = !store.ttsModal.active;
    if (store.ttsModal.active) store.sidebarOpen = false;
}

export function setTtsVoice(voice) {
    if (!voice) return;
    store.ttsModal.voice = voice;
}

export function setTtsSpeed(speed) {
    const n = Number(speed);
    if (!Number.isFinite(n) || n < 0.25 || n > 4) return;
    store.ttsModal.speed = n;
}

export const GOOGLE_TTS_VOICES = [
    { name: 'vi', lang: 'vi-VN', localService: false, default: false },
    { name: 'en-US', lang: 'en-US', localService: false, default: false },
    { name: 'en-GB', lang: 'en-GB', localService: false, default: false },
    { name: 'ja', lang: 'ja-JP', localService: false, default: false },
    { name: 'zh-CN', lang: 'zh-CN', localService: false, default: false },
    { name: 'zh-TW', lang: 'zh-TW', localService: false, default: false },
    { name: 'ko', lang: 'ko-KR', localService: false, default: false },
    { name: 'fr', lang: 'fr-FR', localService: false, default: false },
    { name: 'de', lang: 'de-DE', localService: false, default: false },
    { name: 'es', lang: 'es-ES', localService: false, default: false },
    { name: 'it', lang: 'it-IT', localService: false, default: false },
    { name: 'pt-BR', lang: 'pt-BR', localService: false, default: false },
    { name: 'ru', lang: 'ru-RU', localService: false, default: false },
    { name: 'th', lang: 'th-TH', localService: false, default: false },
    { name: 'id', lang: 'id-ID', localService: false, default: false },
    { name: 'hi', lang: 'hi-IN', localService: false, default: false },
    { name: 'ar', lang: 'ar-SA', localService: false, default: false },
];

export function isTtsCloudMode() {
    return !!(store.ttsWorkerUrl && store.ttsWorkerUrl.trim());
}

export function initTtsVoices() {
    if (isTtsCloudMode()) {
        store.ttsModal.availableVoices = GOOGLE_TTS_VOICES.slice();
        if (!store.ttsModal.voice || !GOOGLE_TTS_VOICES.some((v) => v.name === store.ttsModal.voice)) {
            store.ttsModal.voice = 'vi';
        }
        return;
    }
    if (typeof speechSynthesis === 'undefined') {
        store.ttsModal.error = 'Trình duyệt không hỗ trợ Speech Synthesis.';
        return;
    }
    const apply = () => {
        const voices = speechSynthesis.getVoices();
        store.ttsModal.availableVoices = voices.map((v) => ({
            name: v.name,
            lang: v.lang,
            localService: v.localService,
            default: v.default,
        }));
        if (!store.ttsModal.voice || !voices.some((v) => v.name === store.ttsModal.voice)) {
            const vi = voices.find((v) => (v.lang || '').toLowerCase().startsWith('vi'));
            const en = voices.find((v) => (v.lang || '').toLowerCase().startsWith('en'));
            const dflt = voices.find((v) => v.default);
            const pick = vi || en || dflt || voices[0];
            if (pick) store.ttsModal.voice = pick.name;
        }
    };
    apply();
    if (!store.ttsModal.availableVoices.length) {
        speechSynthesis.addEventListener('voiceschanged', apply, { once: true });
    }
}

function _resetAudioUrl() {
    if (store.ttsModal.audioUrl) {
        try { URL.revokeObjectURL(store.ttsModal.audioUrl); } catch (e) { /* noop */ }
        store.ttsModal.audioUrl = '';
    }
}

async function _cloudTts() {
    const text = store.ttsModal.text.trim();
    const voice = store.ttsModal.voice;
    const base = store.ttsWorkerUrl.trim().replace(/\/$/, '');
    const url = `${base}/?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice)}`;
    const res = await fetch(url);
    if (!res.ok) {
        let msg = `Worker trả về HTTP ${res.status}`;
        try {
            const data = await res.json();
            if (data && data.error) msg = data.error;
        } catch (e) { /* noop */ }
        throw new Error(msg);
    }
    const blob = await res.blob();
    if (!blob || blob.size === 0) throw new Error('Worker trả về audio rỗng.');
    return blob;
}

export async function speakTts() {
    const text = store.ttsModal.text.trim();
    if (!text) {
        store.ttsModal.error = 'Vui lòng nhập nội dung cần đọc.';
        return;
    }
    if (text.length > 500) {
        store.ttsModal.error = 'Nội dung quá dài (tối đa 500 ký tự).';
        return;
    }
    store.ttsModal.error = '';

    if (isTtsCloudMode()) {
        _resetAudioUrl();
        store.ttsModal.loading = true;
        try {
            const blob = await _cloudTts();
            store.ttsModal.audioUrl = URL.createObjectURL(blob);
            addLog('TTS đã sinh: ' + text.slice(0, 40) + (text.length > 40 ? '…' : ''), 'success');
        } catch (err) {
            store.ttsModal.error = err.message || 'Lỗi không xác định';
            addLog('Lỗi TTS: ' + store.ttsModal.error, 'error');
        } finally {
            store.ttsModal.loading = false;
        }
        return;
    }

    if (typeof speechSynthesis === 'undefined') {
        store.ttsModal.error = 'Trình duyệt không hỗ trợ Speech Synthesis.';
        return;
    }
    if (store.ttsModal.isPlaying) speechSynthesis.cancel();

    const utt = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    const v = voices.find((x) => x.name === store.ttsModal.voice);
    if (v) {
        utt.voice = v;
        utt.lang = v.lang;
    }
    utt.rate = store.ttsModal.speed || 1;
    utt.pitch = 1;
    utt.volume = 1;
    utt.onstart = () => { store.ttsModal.isPlaying = true; };
    utt.onend = () => { store.ttsModal.isPlaying = false; };
    utt.onerror = (e) => {
        store.ttsModal.isPlaying = false;
        if (e && e.error !== 'canceled' && e.error !== 'interrupted') {
            store.ttsModal.error = 'Lỗi phát: ' + (e.error || 'unknown');
            addLog('Lỗi TTS: ' + (e.error || 'unknown'), 'error');
        }
    };
    speechSynthesis.speak(utt);
    addLog('TTS phát: ' + text.slice(0, 40) + (text.length > 40 ? '…' : ''), 'info');
}

export function stopTts() {
    if (typeof speechSynthesis !== 'undefined') {
        speechSynthesis.cancel();
    }
    store.ttsModal.isPlaying = false;
}

export function downloadTts() {
    if (!store.ttsModal.audioUrl) return;
    const a = document.createElement('a');
    a.href = store.ttsModal.audioUrl;
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `tts-${ts}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

export function resetTts() {
    stopTts();
    _resetAudioUrl();
    store.ttsModal.text = '';
    store.ttsModal.error = '';
}

export function openInfoModal() {
    if (!store.currentCall) return;
    store.infoModal.input = '';
    store.infoModal.active = true;
}

export function closeInfoModal() {
    store.infoModal.active = false;
}

export function sendInfo() {
    if (!store.currentCall) return;
    const v = store.infoModal.input.trim();
    if (!v) {
        alert('Vui lòng nhập nội dung');
        return;
    }
    const infoObj = { info: v };
    const prefix = store.currentCall.isVideoCall ? '[Call2]' : '[Call1]';

    store.currentCall.sendInfo(infoObj, (res) => {
        addLog(prefix + ' Send info result: ' + JSON.stringify(res), res.r === 0 ? 'success' : 'error');
        if (res.r === 0) closeInfoModal();
        else alert('Gửi thất bại: ' + res.message);
    });
}

export function toggleVideo() {
    if (!store.currentCall || !store.currentCall.isVideoCall) return;
    store.isVideoEnabled = !store.isVideoEnabled;
    store.currentCall.enableLocalVideo(store.isVideoEnabled);
    addLog(store.isVideoEnabled ? 'Đã bật camera' : 'Đã tắt camera', 'info');
}

function showCallingUI(number, isVideo) {
    store.callState = 'active';
    store.callerNumber = number;
    store.callStatusText = 'Đang kết nối...';
    store.callTimerDisplay = '00:00';
    store.callSeconds = 0;
    store.isVideoCall = isVideo;
    store.isMuted = false;
    store.isVideoEnabled = true;
}

function endCallUI() {
    if (videoHandlers.resetVideos) videoHandlers.resetVideos();
    clearPendingMedia();
    store.callState = 'idle';
    store.isRinging = false;
    if (store.hasIncoming) store.callModal.active = false;
    store.hasIncoming = false;
    store.currentCall = null;
    stopCallTimer();
    stopRingtone();
}

function stopRingtone() {
    const r = document.getElementById('ringtone');
    if (r) {
        try { r.pause(); r.currentTime = 0; } catch (e) { /* noop */ }
    }
}

function startCallTimer() {
    if (store._timerInterval) return;
    store.callSeconds = 0;
    store._timerInterval = setInterval(() => {
        store.callSeconds++;
        const m = String(Math.floor(store.callSeconds / 60)).padStart(2, '0');
        const s = String(store.callSeconds % 60).padStart(2, '0');
        store.callTimerDisplay = `${m}:${s}`;
    }, 1000);
}

function stopCallTimer() {
    if (store._timerInterval) {
        clearInterval(store._timerInterval);
        store._timerInterval = null;
    }
}
