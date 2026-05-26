<template>
  <div
    class="calling-state"
    :class="{ ringing: store.isRinging, 'video-call': store.isVideoCall }"
  >
    <div class="video-container" :class="{ active: store.isVideoCall }">
      <div ref="remoteContainer" class="video-box remote-video-box"></div>
      <div
        ref="localContainer"
        class="video-box local-video-box"
        :class="{ dragging: isDragging }"
        :style="localBoxStyle"
        @pointerdown="onLocalPointerDown"
        title="Kéo để di chuyển"
      ></div>
    </div>

    <!-- Dedicated audio sink for voice calls (StringeeCall addremotestream).
         Phải nằm NGOÀI .video-container vì container có display:none cho voice call,
         khiến browser dừng phát audio từ <video> nằm bên trong. -->
    <audio ref="remoteAudio" autoplay playsinline></audio>

    <div v-show="!store.isVideoCall" class="caller-avatar-lg">
      {{ avatarChar }}
    </div>
    <div class="caller-name">{{ store.callerNumber }}</div>
    <div class="call-status-text">{{ store.callStatusText }}</div>
    <div class="call-timer">{{ store.callTimerDisplay }}</div>

    <div class="call-actions">
      <button
        class="call-action-btn"
        :class="{ active: store.isMuted }"
        @click="onMute"
        title="Tắt mic"
      >
        <i :class="store.isMuted ? 'bi bi-mic-mute-fill' : 'bi bi-mic'"></i>
      </button>
      <button class="call-action-btn" @click="onSpeaker" title="Loa ngoài">
        <i class="bi bi-volume-up"></i>
      </button>
      <button
        class="call-action-btn"
        :class="{ active: store.callModal.active }"
        @click="onDtmf"
        title="Bàn phím số (gửi DTMF)"
      >
        <i class="bi bi-grid-3x3"></i>
      </button>
      <button class="call-action-btn" @click="onInfo" title="Gửi thông tin">
        <i class="bi bi-info-circle"></i>
      </button>
      <button
        v-if="store.isVideoCall"
        class="call-action-btn"
        :class="{ active: !store.isVideoEnabled }"
        @click="onToggleVideo"
        title="Bật/Tắt Camera"
      >
        <i :class="store.isVideoEnabled ? 'bi bi-camera-video' : 'bi bi-camera-video-off-fill'"></i>
      </button>
      <button class="call-action-btn hangup" @click="onHangup" title="Cúp máy">
        <i class="bi bi-telephone-x-fill"></i>
      </button>
    </div>
  </div>
</template>

<script>
import {
  store,
  registerVideoHandlers,
  clearVideoHandlers,
  hangupCall,
  toggleMute,
  toggleSpeaker,
  toggleCallModal,
  openInfoModal,
  toggleVideo,
} from '../store';

const DRAG_THRESHOLD_PX = 4;

export default {
  name: 'CallView',
  data() {
    return {
      store,
      isDragging: false,
      localPos: null,
      dragState: null,
      activePointerId: null,
    };
  },
  computed: {
    avatarChar() {
      const n = store.callerNumber || '?';
      return n.charAt(0).toUpperCase();
    },
    localBoxStyle() {
      if (!this.localPos) return null;
      return {
        left: this.localPos.x + 'px',
        top: this.localPos.y + 'px',
        right: 'auto',
        bottom: 'auto',
      };
    },
  },
  mounted() {
    window.addEventListener('resize', this.clampLocalPos);
    registerVideoHandlers({
      onAddRemoteTrack: (track) => {
        const el = track.attach();
        if (!el) return;
        const container = this.$refs.remoteContainer;
        if (!container) return;
        const tag = (el.tagName || '').toLowerCase();
        container.querySelectorAll(tag).forEach((old) => {
          if (old !== el) old.remove();
        });
        if (!container.contains(el)) container.appendChild(el);
      },
      onAddLocalTrack: (track) => {
        const el = track.attach();
        if (!el) return;
        el.muted = true;
        if (el.tagName === 'VIDEO') el.setAttribute('playsinline', '');
        const container = this.$refs.localContainer;
        if (!container) return;
        const tag = (el.tagName || '').toLowerCase();
        container.querySelectorAll(tag).forEach((old) => {
          if (old !== el) old.remove();
        });
        if (!container.contains(el)) container.appendChild(el);
      },
      onAddRemoteStream: (stream) => {
        const audioEl = this.$refs.remoteAudio;
        if (!audioEl) return;
        audioEl.srcObject = stream;
        const p = audioEl.play();
        if (p && typeof p.catch === 'function') {
          p.catch((err) => console.warn('[Call1] remote audio play failed:', err));
        }
      },
      resetVideos: () => {
        if (this.$refs.remoteContainer) this.$refs.remoteContainer.innerHTML = '';
        if (this.$refs.localContainer) this.$refs.localContainer.innerHTML = '';
        if (this.$refs.remoteAudio) {
          try {
            this.$refs.remoteAudio.pause();
            this.$refs.remoteAudio.srcObject = null;
          } catch (e) { /* noop */ }
        }
      },
    });
  },
  unmounted() {
    window.removeEventListener('resize', this.clampLocalPos);
    clearVideoHandlers();
  },
  methods: {
    onMute() { toggleMute(); },
    onSpeaker() { toggleSpeaker(); },
    onDtmf() { toggleCallModal(); },
    onInfo() { openInfoModal(); },
    onToggleVideo() { toggleVideo(); },
    onHangup() { hangupCall(); },
    onLocalPointerDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const box = this.$refs.localContainer;
      if (!box) return;
      const container = box.parentElement;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();
      this.dragState = {
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - boxRect.left,
        offsetY: e.clientY - boxRect.top,
        containerLeft: containerRect.left,
        containerTop: containerRect.top,
        containerWidth: containerRect.width,
        containerHeight: containerRect.height,
        boxWidth: boxRect.width,
        boxHeight: boxRect.height,
      };
      this.activePointerId = e.pointerId;
      try { box.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      box.addEventListener('pointermove', this.onLocalPointerMove);
      box.addEventListener('pointerup', this.onLocalPointerEnd);
      box.addEventListener('pointercancel', this.onLocalPointerEnd);
      e.preventDefault();
    },
    onLocalPointerMove(e) {
      if (!this.dragState || e.pointerId !== this.activePointerId) return;
      const d = this.dragState;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!this.isDragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        this.isDragging = true;
      }
      let x = e.clientX - d.offsetX - d.containerLeft;
      let y = e.clientY - d.offsetY - d.containerTop;
      x = Math.max(0, Math.min(x, d.containerWidth - d.boxWidth));
      y = Math.max(0, Math.min(y, d.containerHeight - d.boxHeight));
      this.localPos = { x, y };
    },
    onLocalPointerEnd(e) {
      if (e && e.pointerId !== this.activePointerId) return;
      const box = this.$refs.localContainer;
      if (box) {
        try { box.releasePointerCapture(this.activePointerId); } catch (err) { /* noop */ }
        box.removeEventListener('pointermove', this.onLocalPointerMove);
        box.removeEventListener('pointerup', this.onLocalPointerEnd);
        box.removeEventListener('pointercancel', this.onLocalPointerEnd);
      }
      this.dragState = null;
      this.isDragging = false;
      this.activePointerId = null;
    },
    clampLocalPos() {
      if (!this.localPos) return;
      const box = this.$refs.localContainer;
      if (!box) return;
      const container = box.parentElement;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();
      const x = Math.max(0, Math.min(this.localPos.x, containerRect.width - boxRect.width));
      const y = Math.max(0, Math.min(this.localPos.y, containerRect.height - boxRect.height));
      this.localPos = { x, y };
    },
  },
};
</script>
