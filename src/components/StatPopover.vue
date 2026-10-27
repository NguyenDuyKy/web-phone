<template>
  <Teleport to="body">
    <div
      ref="root"
      id="stat-popover"
      role="tooltip"
      class="stat-pop"
      :class="['is-' + placement, { 'is-open': visible, 'is-gliding': gliding }]"
      :style="{ transform: `translate3d(${x}px, ${y}px, 0)` }"
      :aria-hidden="!visible"
      @pointerenter="onEnter"
      @pointerleave="onLeave"
    >
      <div class="stat-pop__card" :style="{ '--arrow': arrow + 'px' }">
        <span class="stat-pop__arrow" aria-hidden="true"></span>
        <div v-if="def" :key="contentKey" class="stat-pop__body">
          <div class="stat-pop__eyebrow">{{ sectionLabel }}</div>
          <div class="stat-pop__head">
            <div class="stat-pop__title">{{ def.label }}</div>
            <span
              v-if="row"
              class="stat-pop__value"
              :class="row.level ? 'lvl-' + row.level : 'lvl-none'"
            >{{ row.value }}</span>
          </div>
          <p class="stat-pop__desc">{{ def.desc }}</p>
          <div v-if="thresholds" class="stat-pop__scale">
            <span
              v-for="lv in LEVELS"
              :key="lv.key"
              class="stat-pop__step"
              :class="['lvl-' + lv.key, { 'is-active': row && row.level === lv.key }]"
            >
              {{ lv.label }}<b>{{ thresholds[lv.key] }}</b>
            </span>
          </div>
          <div class="stat-pop__source">
            <i class="bi bi-code-slash"></i>
            <code>{{ def.source }}</code>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script>
import { nextTick } from 'vue';
import { hoverPopover, cancelClose, requestClose, closePopover } from '../hoverPopover';
import { rtc, METRICS, SECTION_LABELS, findRow, thresholdText } from '../webrtcStats';
import { dump, currentDumpState } from '../webrtcDump';

const GAP = 10;
const EDGE = 12;
const ARROW_INSET = 16;

const LEVELS = [
  { key: 'good', label: 'Tốt' },
  { key: 'warn', label: 'Trung bình' },
  { key: 'bad', label: 'Kém' },
];

export default {
  name: 'StatPopover',
  data() {
    return {
      hoverPopover,
      rtc,
      dump,
      LEVELS,
      visible: false,
      gliding: false,
      placement: 'right',
      x: -9999,
      y: -9999,
      arrow: 20,
      rafId: 0,
    };
  },
  computed: {
    def() {
      return METRICS[hoverPopover.metric] || null;
    },
    row() {
      // Reactive source → the value keeps ticking (live) or follows the timeline cursor (dump).
      const state = hoverPopover.source === 'dump' ? currentDumpState() : rtc;
      return state ? findRow(state, hoverPopover.section, hoverPopover.metric) : null;
    },
    thresholds() {
      return thresholdText(hoverPopover.metric);
    },
    sectionLabel() {
      const label = SECTION_LABELS[hoverPopover.section] || 'WebRTC';
      return hoverPopover.source === 'dump' ? label + ' · file dump' : label;
    },
    contentKey() {
      return hoverPopover.section + ':' + hoverPopover.metric;
    },
  },
  watch: {
    'hoverPopover.open': 'sync',
    'hoverPopover.anchor': 'sync',
    'rtc.updatedAt'() {
      if (this.visible) this.place(true);
    },
    'dump.cursor'() {
      if (this.visible) this.$nextTick(() => this.place(true));
    },
  },
  mounted() {
    window.addEventListener('scroll', this.onViewportChange, { capture: true, passive: true });
    window.addEventListener('resize', this.onViewportChange, { passive: true });
    document.addEventListener('pointerdown', this.onOutsidePointer, true);
    // Capture on window so Escape closes the popover before App's Escape → hang-up handler.
    window.addEventListener('keydown', this.onKeydown, true);
  },
  unmounted() {
    window.removeEventListener('scroll', this.onViewportChange, { capture: true });
    window.removeEventListener('resize', this.onViewportChange);
    document.removeEventListener('pointerdown', this.onOutsidePointer, true);
    window.removeEventListener('keydown', this.onKeydown, true);
    cancelAnimationFrame(this.rafId);
  },
  methods: {
    async sync() {
      if (!hoverPopover.open) {
        this.visible = false;
        return;
      }
      const wasVisible = this.visible;
      await nextTick(); // let the new content render so we measure its real size
      if (!hoverPopover.open) return;
      this.place(wasVisible);
      this.visible = true;
    },
    place(glide) {
      const anchor = hoverPopover.anchor;
      const el = this.$refs.root;
      if (!anchor || !el) return;
      if (!anchor.isConnected) {
        closePopover();
        return;
      }
      const r = anchor.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw || (!r.width && !r.height)) {
        closePopover();
        return;
      }
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, Math.max(lo, hi)));
      // Side placements line up on the stats panel edge, so moving between rows
      // only glides vertically and the popover never covers the numbers.
      const railEl = anchor.closest('[data-pop-rail]');
      const rail = railEl ? railEl.getBoundingClientRect() : r;

      let placement;
      if (rail.right + GAP + w + EDGE <= vw) placement = 'right';
      else if (rail.left - GAP - w - EDGE >= 0) placement = 'left';
      else if (r.top - GAP - h - EDGE >= 0) placement = 'top';
      else placement = 'bottom';

      let x;
      let y;
      let arrow;
      if (placement === 'right' || placement === 'left') {
        x = placement === 'right' ? rail.right + GAP : rail.left - GAP - w;
        y = clamp(r.top + r.height / 2 - h / 2, EDGE, vh - h - EDGE);
        arrow = clamp(r.top + r.height / 2 - y, ARROW_INSET, h - ARROW_INSET);
      } else {
        x = clamp(r.left + r.width / 2 - w / 2, EDGE, vw - w - EDGE);
        y = placement === 'top' ? r.top - GAP - h : r.bottom + GAP;
        arrow = clamp(r.left + r.width / 2 - x, ARROW_INSET, w - ARROW_INSET);
      }

      // Only glide when staying on the same side; a side flip would sweep across the anchor.
      this.gliding = glide && placement === this.placement;
      this.placement = placement;
      this.x = Math.round(x);
      this.y = Math.round(y);
      this.arrow = Math.round(arrow);
    },
    onViewportChange() {
      if (!this.visible) return;
      cancelAnimationFrame(this.rafId);
      this.rafId = requestAnimationFrame(() => this.place(false));
    },
    onEnter(e) {
      if (e.pointerType === 'mouse') cancelClose();
    },
    onLeave(e) {
      if (e.pointerType === 'mouse') requestClose();
    },
    onOutsidePointer(e) {
      if (!hoverPopover.open) return;
      const root = this.$refs.root;
      const anchor = hoverPopover.anchor;
      if (root && root.contains(e.target)) return;
      if (anchor && anchor.contains(e.target)) return;
      closePopover();
    },
    onKeydown(e) {
      if (e.key === 'Escape' && hoverPopover.open) {
        e.stopPropagation();
        closePopover();
      }
    },
  },
};
</script>
