<template>
  <Transition name="popover">
    <div
      v-if="store.dumpPanel.active"
      class="config-modal config-popover dump-popover"
      :class="{ 'is-dragover': dragOver }"
      ref="popover"
      role="dialog"
      aria-labelledby="dumpTitle"
      @dragenter.prevent="onDragEnter"
      @dragover.prevent
      @dragleave="onDragLeave"
      @drop.prevent="onDrop"
    >
      <header class="config-modal__head">
        <div class="config-modal__head-left">
          <div class="config-modal__icon">
            <i class="bi bi-file-earmark-bar-graph"></i>
          </div>
          <div class="config-modal__titles">
            <div class="config-modal__eyebrow">WEBRTC-INTERNALS · DUMP</div>
            <h3 class="config-modal__title" id="dumpTitle">Phân tích file dump</h3>
          </div>
        </div>
        <button class="config-modal__close" @click="onClose" aria-label="Đóng">
          <i class="bi bi-x-lg"></i>
        </button>
      </header>

      <input
        ref="fileInput"
        type="file"
        accept=".gz,.txt,.json,application/gzip,application/json,text/plain"
        hidden
        @change="onPick"
      >

      <div class="dump-body" data-pop-rail>
        <!-- ── Upload ── -->
        <template v-if="dump.status !== 'ready'">
          <button
            type="button"
            class="dump-drop"
            :class="{ 'is-loading': dump.status === 'loading', 'is-error': dump.status === 'error' }"
            :disabled="dump.status === 'loading'"
            @click="pickFile"
          >
            <span class="dump-drop__icon">
              <i :class="dump.status === 'loading' ? 'bi bi-arrow-repeat spin-icon' : dump.status === 'error' ? 'bi bi-exclamation-octagon' : 'bi bi-cloud-arrow-up'"></i>
            </span>
            <span class="dump-drop__title">
              {{ dump.status === 'loading' ? 'Đang phân tích ' + dump.fileName + '…' : 'Kéo thả file dump vào đây' }}
            </span>
            <span class="dump-drop__sub">
              {{ dump.status === 'loading' ? formatSize(dump.fileSize) : 'hoặc bấm để chọn file · .gz / .txt / .json' }}
            </span>
          </button>

          <div v-if="dump.status === 'error'" class="dump-error">
            <i class="bi bi-x-circle"></i>
            <div><b>{{ dump.fileName }}</b> — {{ dump.error }}</div>
          </div>

          <ol class="dump-howto">
            <li>
              Mở
              <button type="button" class="dump-howto__link" @click="copyInternalsUrl">
                chrome://webrtc-internals <i :class="copied ? 'bi bi-check2' : 'bi bi-copy'"></i>
              </button>
              ở tab mới <em>trước khi</em> gọi
            </li>
            <li>Thực hiện cuộc gọi cần kiểm tra</li>
            <li>Mở mục <b>Create a WebRTC-Internals dump</b> → <b>Download the "webrtc-internals dump"</b></li>
            <li>Tải file <code>webrtc_internals_dump.gz</code> (hoặc <code>.txt</code>) lên đây</li>
          </ol>
        </template>

        <!-- ── Analysis ── -->
        <template v-else>
          <div class="dump-file">
            <i class="bi bi-filetype-json dump-file__icon"></i>
            <div class="dump-file__text">
              <div class="dump-file__name" :title="dump.fileName">{{ dump.fileName }}</div>
              <div class="dump-file__meta">
                {{ formatSize(dump.fileSize) }}<template v-if="browser"> · {{ browser }}</template>
                · {{ dump.peers.length }} kết nối
              </div>
            </div>
            <button type="button" class="dump-icon-btn" title="Chọn file khác" aria-label="Chọn file khác" @click="pickFile">
              <i class="bi bi-arrow-repeat"></i>
            </button>
            <button type="button" class="dump-icon-btn" title="Đóng file" aria-label="Đóng file" @click="onClear">
              <i class="bi bi-trash3"></i>
            </button>
          </div>

          <div v-if="dump.peers.length > 1" class="dump-peers" role="tablist" aria-label="Kết nối trong file">
            <button
              v-for="(p, i) in dump.peers"
              :key="p.key"
              type="button"
              role="tab"
              class="dump-peer"
              :class="{ 'is-active': i === dump.selected }"
              :aria-selected="i === dump.selected"
              :title="p.url || p.key"
              @click="onSelectPeer(i)"
            >
              <i class="dump-peer__dot" :class="'lvl-' + worstLevel(p)"></i>
              <span class="dump-peer__name">#{{ p.index }}</span>
              <span class="dump-peer__meta">{{ hostOf(p) }} · {{ p.summary.mediaDuration }}</span>
            </button>
          </div>

          <div class="dump-overview" :class="'lvl-' + peer.summary.overallLevel">
            <div
              class="dump-overview__score"
              :class="peer.summary.mosLevel ? 'lvl-' + peer.summary.mosLevel : ''"
              tabindex="0"
              v-stat-tip="{ section: 'summary', metric: 'mos', source: 'dump' }"
            >
              <b>{{ peer.summary.mosAvg == null ? '—' : peer.summary.mosAvg.toFixed(2) }}</b>
              <span>MOS trung bình</span>
            </div>
            <div class="dump-overview__main">
              <div class="dump-overview__verdict">
                Thoại: {{ peer.summary.verdict }}
                <span class="dump-overview__flag">{{ peer.summary.overallText }}</span>
              </div>
              <dl class="dump-overview__grid">
                <div><dt>Bắt đầu</dt><dd>{{ clock(peer.summary.start) }}</dd></div>
                <div><dt>Có media</dt><dd>{{ peer.summary.mediaDuration }}</dd></div>
                <div><dt>RTT TB</dt><dd>{{ peer.summary.rttAvg == null ? '—' : Math.round(peer.summary.rttAvg) + ' ms' }}</dd></div>
                <div><dt>Mất gói</dt><dd>{{ peer.summary.totalLoss == null ? '—' : peer.summary.totalLoss.toFixed(2) + '%' }}</dd></div>
                <div><dt>Jitter TB</dt><dd>{{ peer.summary.jitterAvg == null ? '—' : Math.round(peer.summary.jitterAvg) + ' ms' }}</dd></div>
                <div><dt>Đường truyền</dt><dd>{{ peer.summary.candidate || '—' }}</dd></div>
              </dl>
            </div>
          </div>

          <section class="dump-findings">
            <div class="dump-sub">
              <span>Kết quả phân tích</span>
              <span class="dump-sub__count">{{ issueCount }}</span>
            </div>
            <div
              v-for="(f, i) in peer.findings"
              :key="peer.key + ':' + i"
              class="dump-finding"
              :class="['lvl-' + f.level, { 'is-active': activeFinding === i, 'is-clickable': canJump(f) }]"
              :role="canJump(f) ? 'button' : null"
              :tabindex="canJump(f) ? 0 : null"
              @click="onFinding(i)"
              @keydown.enter.prevent="onFinding(i)"
              @keydown.space.prevent="onFinding(i)"
            >
              <i :class="['bi', f.icon, 'dump-finding__icon']"></i>
              <div class="dump-finding__body">
                <div class="dump-finding__title">{{ f.title }}</div>
                <div class="dump-finding__detail">{{ f.detail }}</div>
                <div v-if="f.episodes && f.episodes.length" class="dump-finding__eps">
                  <button
                    v-for="(e, k) in f.episodes.slice(0, 6)"
                    :key="k"
                    type="button"
                    class="dump-ep"
                    :class="{ 'is-current': dump.cursor >= e.start && dump.cursor <= e.end }"
                    @click.stop="jumpTo(i, e.start)"
                  >
                    {{ offset(e.start) }}<span>{{ spanText(e) }}</span>
                  </button>
                  <span v-if="f.episodes.length > 6" class="dump-ep dump-ep--more">+{{ f.episodes.length - 6 }}</span>
                </div>
              </div>
            </div>
          </section>

          <section class="dump-timeline-wrap" ref="timeline">
            <div class="dump-sub">
              <span>Dòng thời gian</span>
              <span class="dump-sub__hint">kéo hoặc bấm vào biểu đồ</span>
            </div>
            <DumpTimeline
              :peer="peer"
              :cursor="dump.cursor"
              :highlight="activeEpisodes"
              :highlight-level="activeLevel"
              @update:cursor="setCursor"
            />
          </section>

          <div class="dump-sub dump-sub--detail">
            <span>Chi tiết tại {{ offset(dump.cursor) }}</span>
            <span class="dump-sub__hint">{{ clock(peer.ticks[dump.cursor]) }}</span>
          </div>
          <WebRTCStats :state="cursorState" source="dump" :show-summary="false" />
        </template>
      </div>

      <div v-if="dragOver" class="dump-dropzone-overlay" aria-hidden="true">
        <i class="bi bi-cloud-arrow-down"></i>
        Thả file để phân tích
      </div>
    </div>
  </Transition>
</template>

<script>
import { store, closeDumpPanel } from '../store';
import { hoverPopover, closePopover, vStatTip } from '../hoverPopover';
import {
  dump,
  loadDumpFile,
  clearDump,
  selectDumpPeer,
  selectedDumpPeer,
  dumpStateAt,
  formatOffset,
} from '../webrtcDump';
import WebRTCStats from './WebRTCStats.vue';
import DumpTimeline from './DumpTimeline.vue';

const TRIGGER_SELECTOR = '.btn-dump-trigger';

export default {
  name: 'DumpAnalyzerPopover',
  components: { WebRTCStats, DumpTimeline },
  directives: { statTip: vStatTip },
  data() {
    return { store, dump, dragOver: false, dragDepth: 0, activeFinding: null, copied: false };
  },
  computed: {
    peer() {
      return selectedDumpPeer();
    },
    cursorState() {
      return dumpStateAt(this.peer, dump.cursor);
    },
    browser() {
      const m = /(Edg|OPR|Chrome|Firefox)\/(\d+)/.exec(dump.userAgent || '');
      if (!m) return '';
      return ({ Edg: 'Edge', OPR: 'Opera' }[m[1]] || m[1]) + ' ' + m[2];
    },
    issueCount() {
      return this.peer ? this.peer.findings.filter((f) => f.level === 'bad' || f.level === 'warn').length : 0;
    },
    activeEpisodes() {
      const f = this.peer && this.activeFinding != null ? this.peer.findings[this.activeFinding] : null;
      return f && f.episodes ? f.episodes : [];
    },
    activeLevel() {
      const f = this.peer && this.activeFinding != null ? this.peer.findings[this.activeFinding] : null;
      return f ? f.level : null;
    },
  },
  watch: {
    'store.dumpPanel.active'(active) {
      if (active) this.$nextTick(() => this.positionPopover());
    },
    'dump.status'(status) {
      this.activeFinding = null;
      if (status === 'ready' && this.peer) {
        // Pre-select the first finding the default cursor points at.
        const i = this.peer.findings.findIndex((f) => f.episodes && f.episodes.some((e) => dump.cursor >= e.start && dump.cursor <= e.end));
        this.activeFinding = i >= 0 ? i : null;
      }
      this.$nextTick(() => this.positionPopover());
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
      if (!store.dumpPanel.active) return;
      const popover = this.$refs.popover;
      const trigger = document.querySelector(TRIGGER_SELECTOR);
      if (!popover || !trigger) return;
      const rect = trigger.getBoundingClientRect();
      const popoverWidth = popover.offsetWidth || 460;
      const margin = 12;
      let left = rect.left + rect.width / 2 - popoverWidth / 2;
      left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin));
      popover.style.left = left + 'px';
      const arrowLeft = (rect.left + rect.width / 2) - left;
      popover.style.setProperty('--cfg-arrow-left', arrowLeft + 'px');
    },
    handleOutsideClick(e) {
      if (!store.dumpPanel.active) return;
      const popover = this.$refs.popover;
      const trigger = document.querySelector(TRIGGER_SELECTOR);
      if (popover && popover.contains(e.target)) return;
      if (trigger && trigger.contains(e.target)) return;
      // The stat tooltip is teleported to <body> — clicking it isn't "outside".
      if (e.target.closest && e.target.closest('.stat-pop')) return;
      closeDumpPanel();
    },
    onKeydown(e) {
      if (e.key !== 'Escape' || !store.dumpPanel.active) return;
      // Let the stat tooltip close first; the next Escape closes the panel.
      if (hoverPopover.open) return;
      e.stopPropagation();
      closeDumpPanel();
    },
    onClose() { closeDumpPanel(); },
    onClear() {
      closePopover();
      clearDump();
      if (this.$refs.fileInput) this.$refs.fileInput.value = '';
    },
    pickFile() {
      if (this.$refs.fileInput) this.$refs.fileInput.click();
    },
    onPick(e) {
      const file = e.target.files && e.target.files[0];
      if (file) this.load(file);
      e.target.value = '';
    },
    load(file) {
      closePopover();
      loadDumpFile(file);
    },
    onDragEnter() {
      this.dragDepth += 1;
      this.dragOver = true;
    },
    onDragLeave() {
      this.dragDepth = Math.max(0, this.dragDepth - 1);
      if (!this.dragDepth) this.dragOver = false;
    },
    onDrop(e) {
      this.dragDepth = 0;
      this.dragOver = false;
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) this.load(file);
    },
    onSelectPeer(i) {
      closePopover();
      selectDumpPeer(i);
      this.activeFinding = null;
    },
    setCursor(i) {
      dump.cursor = i;
    },
    canJump(f) {
      return !!((f.episodes && f.episodes.length) || f.at != null);
    },
    onFinding(i) {
      const f = this.peer.findings[i];
      if (!this.canJump(f)) return;
      this.jumpTo(i, f.episodes && f.episodes.length ? f.episodes[0].start : f.at);
    },
    jumpTo(i, index) {
      this.activeFinding = i;
      dump.cursor = index;
      const tl = this.$refs.timeline;
      if (tl) tl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },
    worstLevel(p) {
      const f = p.findings[0];
      return f ? (f.level === 'info' ? 'good' : f.level) : 'good';
    },
    hostOf(p) {
      try { return new URL(p.url).host; } catch (e) { return p.key; }
    },
    offset(i) {
      return this.peer ? formatOffset(i * this.peer.step) : '00:00';
    },
    spanText(e) {
      const secs = Math.round(((e.end - e.start + 1) * this.peer.step) / 1000);
      return secs >= 60 ? ` · ${Math.floor(secs / 60)}p${String(secs % 60).padStart(2, '0')}` : ` · ${secs}s`;
    },
    clock(ms) {
      return ms ? new Date(ms).toLocaleTimeString('vi-VN') : '—';
    },
    formatSize(b) {
      if (!b) return '0 B';
      if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
      if (b >= 1024) return (b / 1024).toFixed(0) + ' KB';
      return b + ' B';
    },
    async copyInternalsUrl() {
      // Pages can't open chrome:// URLs — copy it for the user to paste.
      try {
        await navigator.clipboard.writeText('chrome://webrtc-internals');
        this.copied = true;
        setTimeout(() => { this.copied = false; }, 1500);
      } catch (e) { /* noop */ }
    },
  },
};
</script>
