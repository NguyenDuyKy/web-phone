<template>
  <div class="dump-tl">
    <div
      ref="stack"
      class="dump-tl__stack"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @pointerleave="hover = null"
    >
      <div v-for="c in charts" :key="c.key" class="dump-tl__chart">
        <div class="dump-tl__head">
          <span
            class="dump-tl__label"
            tabindex="0"
            v-stat-tip="{ section: c.section, metric: c.metric, source: 'dump' }"
          >{{ c.label }}</span>
          <span class="dump-tl__value">
            <template v-for="(line, i) in c.lines" :key="line.key">
              <span
                class="dump-tl__num"
                :class="[line.cls, levelClass(c, line, cursor)]"
              >{{ line.prefix || '' }}{{ fmt(c, valueAt(line.key, cursor)) }}</span>
              <span v-if="i < c.lines.length - 1" class="dump-tl__sep">·</span>
            </template>
          </span>
        </div>
        <svg class="dump-tl__svg" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
          <line
            v-if="c.guide != null && guideY(c) != null"
            class="dump-tl__guide"
            x1="0" x2="1000" :y1="guideY(c)" :y2="guideY(c)"
          />
          <template v-for="line in c.lines" :key="line.key">
            <path v-if="line.area" class="dump-tl__area" :class="line.cls" :d="path(c, line.key, true)" />
            <path class="dump-tl__line" :class="line.cls" :d="path(c, line.key, false)" />
          </template>
        </svg>
      </div>

      <!-- Overlays share the stack's coordinate space -->
      <div
        v-for="(e, i) in highlight"
        :key="'hl' + i"
        class="dump-tl__band"
        :class="'lvl-' + (highlightLevel || 'warn')"
        :style="bandStyle(e)"
      ></div>
      <div v-if="hover != null && hover !== cursor" class="dump-tl__ghost" :style="{ left: pos(hover) }">
        <span>{{ offsetText(hover) }}</span>
      </div>
      <div class="dump-tl__cursor" :class="{ 'is-dragging': dragging }" :style="{ left: pos(cursor) }"></div>
    </div>

    <div class="dump-tl__scrub">
      <button
        type="button"
        class="dump-tl__play"
        :title="playing ? 'Tạm dừng' : 'Phát lại dòng thời gian'"
        :aria-label="playing ? 'Tạm dừng' : 'Phát lại'"
        @click="togglePlay"
      >
        <i :class="playing ? 'bi bi-pause-fill' : 'bi bi-play-fill'"></i>
      </button>
      <input
        class="dump-tl__range"
        type="range"
        min="0"
        :max="last"
        step="1"
        :value="cursor"
        :style="{ '--fill': pos(cursor) }"
        aria-label="Thời điểm trong cuộc gọi"
        @input="setCursor(Number($event.target.value))"
      >
      <span class="dump-tl__time">{{ offsetText(cursor) }}<em> / {{ offsetText(last) }}</em></span>
    </div>
  </div>
</template>

<script>
import { vStatTip } from '../hoverPopover';
import { levelOf, formatBitrate } from '../webrtcStats';
import { formatOffset } from '../webrtcDump';

const MAX_POINTS = 600;
const PLAY_STEP_MS = 110;

const CHARTS = [
  { key: 'mos', label: 'MOS', metric: 'mos', section: 'summary', range: [1, 4.5], guide: 3.6,
    lines: [{ key: 'mos', cls: 'is-mos', area: true, level: 'mos' }] },
  { key: 'rtt', label: 'RTT', metric: 'rtt', section: 'conn', floor: 200, guide: 150,
    lines: [{ key: 'rtt', cls: 'is-a', area: true, level: 'rtt' }] },
  { key: 'bitrate', label: 'Bitrate', metric: 'bitrateIn', section: 'summary', unit: 'bps',
    lines: [{ key: 'bitrateIn', cls: 'is-a', prefix: '↓ ', area: true }, { key: 'bitrateOut', cls: 'is-b', prefix: '↑ ' }] },
  { key: 'loss', label: 'Mất gói', metric: 'loss', section: 'audioIn', floor: 5, guide: 1, unit: '%',
    lines: [{ key: 'loss', cls: 'is-bad', area: true, level: 'loss' }] },
  { key: 'jitter', label: 'Jitter', metric: 'jitter', section: 'audioIn', floor: 60, guide: 30,
    lines: [{ key: 'jitter', cls: 'is-a', area: true, level: 'jitter' }] },
];

export default {
  name: 'DumpTimeline',
  directives: { statTip: vStatTip },
  props: {
    peer: { type: Object, required: true },
    cursor: { type: Number, required: true },
    highlight: { type: Array, default: () => [] },
    highlightLevel: { type: String, default: null },
  },
  emits: ['update:cursor'],
  data() {
    return { hover: null, dragging: false, playing: false, playTimer: null };
  },
  computed: {
    last() {
      return Math.max(0, this.peer.ticks.length - 1);
    },
    charts() {
      // Hide charts with no data at all (e.g. MOS for a video-only connection).
      return CHARTS.filter((c) => c.lines.some((l) => (this.peer.series[l.key] || []).some((v) => v != null)));
    },
    // Value range per chart, computed once per peer.
    ranges() {
      const out = {};
      CHARTS.forEach((c) => {
        if (c.range) {
          out[c.key] = c.range;
          return;
        }
        let hi = 0;
        c.lines.forEach((l) => (this.peer.series[l.key] || []).forEach((v) => { if (v != null && v > hi) hi = v; }));
        out[c.key] = [0, Math.max(hi * 1.12, c.floor || 0) || 1];
      });
      return out;
    },
    // Downsampled point lists; long calls keep the worst value of each bucket.
    points() {
      const out = {};
      const n = this.peer.ticks.length;
      const bucket = Math.max(1, Math.ceil(n / MAX_POINTS));
      CHARTS.forEach((c) => c.lines.forEach((l) => {
        const src = this.peer.series[l.key] || [];
        const pts = [];
        for (let i = 0; i < n; i += bucket) {
          let v = null;
          for (let j = i; j < Math.min(n, i + bucket); j++) {
            const x = src[j];
            if (x == null) continue;
            if (v == null || (c.key === 'mos' ? x < v : x > v)) v = x;
          }
          pts.push([i, v]);
        }
        out[l.key] = pts;
      }));
      return out;
    },
  },
  watch: {
    peer() {
      this.stopPlay();
    },
  },
  beforeUnmount() {
    this.stopPlay();
  },
  methods: {
    valueAt(key, i) {
      const s = this.peer.series[key];
      return s ? s[i] : null;
    },
    fmt(c, v) {
      if (v == null) return '—';
      if (c.unit === 'bps') return formatBitrate(v, true);
      if (c.unit === '%') return v.toFixed(1) + '%';
      if (c.key === 'mos') return v.toFixed(2);
      return Math.round(v) + ' ms';
    },
    levelClass(c, line, i) {
      if (!line.level) return '';
      const lv = levelOf(line.level, this.valueAt(line.key, i));
      return lv ? 'lvl-' + lv : '';
    },
    y(c, v) {
      const [lo, hi] = this.ranges[c.key];
      return 98 - ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo || 1)) * 92;
    },
    guideY(c) {
      const [lo, hi] = this.ranges[c.key];
      return c.guide >= lo && c.guide <= hi ? this.y(c, c.guide).toFixed(2) : null;
    },
    path(c, key, area) {
      const pts = this.points[key] || [];
      const xOf = (i) => ((i / (this.last || 1)) * 1000).toFixed(1);
      let d = '';
      let run = [];
      const flush = () => {
        if (run.length > 1) {
          const line = run.map(([i, v], k) => (k ? 'L' : 'M') + xOf(i) + ' ' + this.y(c, v).toFixed(2)).join(' ');
          d += area ? `${line} L${xOf(run[run.length - 1][0])} 100 L${xOf(run[0][0])} 100 Z ` : line + ' ';
        }
        run = [];
      };
      // Gaps (no data) break the line instead of being bridged.
      pts.forEach((p) => {
        if (p[1] == null) flush();
        else run.push(p);
      });
      flush();
      return d.trim();
    },
    pos(i) {
      return ((i / (this.last || 1)) * 100).toFixed(3) + '%';
    },
    bandStyle(e) {
      const w = this.last || 1;
      return {
        left: ((e.start / w) * 100).toFixed(3) + '%',
        width: (Math.max(0.6, ((e.end - e.start + 1) / (w + 1)) * 100)).toFixed(3) + '%',
      };
    },
    offsetText(i) {
      return formatOffset(i * this.peer.step);
    },
    indexAt(e) {
      const r = this.$refs.stack.getBoundingClientRect();
      const x = Math.min(Math.max(e.clientX - r.left, 0), r.width);
      return Math.round((x / (r.width || 1)) * this.last);
    },
    setCursor(i) {
      this.$emit('update:cursor', Math.max(0, Math.min(this.last, i)));
    },
    onDown(e) {
      if (e.target.closest('.dump-tl__label')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this.stopPlay();
      this.dragging = true;
      try { this.$refs.stack.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      this.setCursor(this.indexAt(e));
    },
    onMove(e) {
      const i = this.indexAt(e);
      if (this.dragging) this.setCursor(i);
      else if (e.pointerType === 'mouse') this.hover = i;
    },
    onUp(e) {
      if (!this.dragging) return;
      this.dragging = false;
      try { this.$refs.stack.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
    },
    togglePlay() {
      if (this.playing) {
        this.stopPlay();
        return;
      }
      let i = this.cursor >= this.last ? 0 : this.cursor;
      this.playing = true;
      this.playTimer = setInterval(() => {
        i += 1;
        this.setCursor(i);
        if (i >= this.last) this.stopPlay();
      }, PLAY_STEP_MS);
    },
    stopPlay() {
      clearInterval(this.playTimer);
      this.playTimer = null;
      this.playing = false;
    },
  },
};
</script>
