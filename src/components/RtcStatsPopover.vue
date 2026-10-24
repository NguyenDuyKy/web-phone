<template>
  <Transition name="popover">
    <div
      v-if="store.rtcPanel.active"
      class="config-modal config-popover rtc-popover"
      ref="popover"
      role="dialog"
      aria-labelledby="rtcTitle"
    >
      <header class="config-modal__head">
        <div class="config-modal__head-left">
          <div class="config-modal__icon">
            <i class="bi bi-activity"></i>
          </div>
          <div class="config-modal__titles">
            <div class="config-modal__eyebrow">{{ eyebrow }}</div>
            <h3 class="config-modal__title" id="rtcTitle">Thông số WebRTC</h3>
          </div>
        </div>
        <span v-if="rtc.status === 'live'" class="rtc-popover__live">
          <i></i> LIVE
        </span>
        <button class="config-modal__close" @click="onClose" aria-label="Đóng">
          <i class="bi bi-x-lg"></i>
        </button>
      </header>

      <WebRTCStats />
    </div>
  </Transition>
</template>

<script>
import { store, closeRtcPanel } from '../store';
import { rtc } from '../webrtcStats';
import { hoverPopover } from '../hoverPopover';
import WebRTCStats from './WebRTCStats.vue';

const TRIGGER_SELECTOR = '.btn-rtc-trigger';

export default {
  name: 'RtcStatsPopover',
  components: { WebRTCStats },
  data() {
    return { store, rtc };
  },
  computed: {
    eyebrow() {
      return {
        live: 'REALTIME · 1s',
        waiting: 'REALTIME · CHỜ MEDIA',
        ended: 'SNAPSHOT · ĐÃ KẾT THÚC',
      }[rtc.status] || 'REALTIME · IDLE';
    },
  },
  watch: {
    'store.rtcPanel.active'(active) {
      if (active) this.$nextTick(() => this.positionPopover());
    },
  },
  mounted() {
    document.addEventListener('mousedown', this.handleOutsideClick);
    window.addEventListener('resize', this.positionPopover);
    // Capture on window so Escape closes the panel before App's Escape → hang-up handler.
    window.addEventListener('keydown', this.onKeydown, true);
  },
  unmounted() {
    document.removeEventListener('mousedown', this.handleOutsideClick);
    window.removeEventListener('resize', this.positionPopover);
    window.removeEventListener('keydown', this.onKeydown, true);
  },
  methods: {
    positionPopover() {
      if (!store.rtcPanel.active) return;
      const popover = this.$refs.popover;
      const trigger = document.querySelector(TRIGGER_SELECTOR);
      if (!popover || !trigger) return;
      const rect = trigger.getBoundingClientRect();
      const popoverWidth = popover.offsetWidth || 380;
      const margin = 12;
      let left = rect.left + rect.width / 2 - popoverWidth / 2;
      left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin));
      popover.style.left = left + 'px';
      const arrowLeft = (rect.left + rect.width / 2) - left;
      popover.style.setProperty('--cfg-arrow-left', arrowLeft + 'px');
    },
    handleOutsideClick(e) {
      if (!store.rtcPanel.active) return;
      const popover = this.$refs.popover;
      const trigger = document.querySelector(TRIGGER_SELECTOR);
      if (popover && popover.contains(e.target)) return;
      if (trigger && trigger.contains(e.target)) return;
      // The stat tooltip is teleported to <body> — clicking it isn't "outside".
      if (e.target.closest && e.target.closest('.stat-pop')) return;
      closeRtcPanel();
    },
    onKeydown(e) {
      if (e.key !== 'Escape' || !store.rtcPanel.active) return;
      // Let the stat tooltip close first; the next Escape closes the panel.
      if (hoverPopover.open) return;
      e.stopPropagation();
      closeRtcPanel();
    },
    onClose() { closeRtcPanel(); },
  },
};
</script>
