<template>
  <div class="rtc-panel" data-pop-rail>
    <div v-if="!hasData" class="rtc-empty">
      <div class="rtc-empty__icon" :class="{ 'is-waiting': view.status === 'waiting' }">
        <i class="bi bi-activity"></i>
      </div>
      <div class="rtc-empty__title">
        {{ view.status === 'waiting' ? 'Đang chờ luồng media...' : 'Chưa có cuộc gọi' }}
      </div>
      <p class="rtc-empty__text">
        {{ view.status === 'waiting'
            ? 'Thông số sẽ xuất hiện ngay khi kết nối WebRTC được thiết lập.'
            : 'Bắt đầu hoặc nhận một cuộc gọi để theo dõi RTT, jitter, mất gói, bitrate... theo thời gian thực.' }}
      </p>
    </div>

    <template v-else>
      <div v-if="view.status === 'ended'" class="rtc-banner">
        <i class="bi bi-stop-circle"></i>
        Cuộc gọi đã kết thúc · số liệu lúc {{ updatedText }}
      </div>

      <div
        v-if="showSummary"
        class="rtc-quality"
        :class="quality.level ? 'lvl-' + quality.level : ''"
        tabindex="0"
        v-stat-tip="{ section: 'summary', metric: 'mos', source }"
      >
        <div class="rtc-quality__score">{{ quality.value }}</div>
        <div class="rtc-quality__text">
          <div class="rtc-quality__label">Chất lượng thoại · MOS</div>
          <div class="rtc-quality__verdict">{{ quality.verdict }}</div>
        </div>
        <div class="rtc-quality__meter">
          <span :style="{ transform: `scaleX(${quality.percent / 100})` }"></span>
        </div>
      </div>

      <div v-if="showSummary" class="rtc-cards">
        <div
          v-for="card in cards"
          :key="card.metric"
          class="rtc-card"
          tabindex="0"
          v-stat-tip="{ section: 'summary', metric: card.metric, source }"
        >
          <div class="rtc-card__label"><i :class="['bi', card.icon]"></i>{{ card.label }}</div>
          <div class="rtc-card__value" :class="card.level ? 'lvl-' + card.level : ''">{{ card.value }}</div>
          <svg class="rtc-spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
            <path class="rtc-spark__area" :d="sparkPath(card.series, true)" />
            <path class="rtc-spark__line" :d="sparkPath(card.series, false)" />
          </svg>
        </div>
      </div>

      <section
        v-for="s in sections"
        :key="s.key"
        class="rtc-section"
        :class="{ 'is-collapsed': collapsed[s.key] }"
      >
        <button
          type="button"
          class="rtc-section__head"
          :aria-expanded="!collapsed[s.key]"
          @click="toggle(s.key)"
        >
          <i :class="['bi', s.icon, 'rtc-section__icon']"></i>
          <span class="rtc-section__title">{{ s.title }}</span>
          <span v-if="issues(s)" class="rtc-section__issues" :class="'lvl-' + issues(s).level">
            {{ issues(s).count }}
          </span>
          <i class="bi bi-chevron-down rtc-section__chevron"></i>
        </button>
        <div class="rtc-section__body" :inert="collapsed[s.key] || null">
          <div class="rtc-section__inner">
            <div
              v-for="r in s.rows"
              :key="r.metric"
              class="rtc-row"
              tabindex="0"
              v-stat-tip="{ section: s.key, metric: r.metric, source }"
            >
              <span class="rtc-row__label">{{ METRICS[r.metric].label }}</span>
              <span class="rtc-row__value" :class="r.level ? 'lvl-' + r.level : ''">
                <i v-if="r.level" class="rtc-dot"></i>{{ r.value }}
              </span>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script>
import { rtc, METRICS, buildSections, summaryCards, qualitySummary } from '../webrtcStats';
import { vStatTip } from '../hoverPopover';

const COLLAPSE_STORAGE_KEY = 'stringee_rtc_collapsed';

export default {
  name: 'WebRTCStats',
  directives: { statTip: vStatTip },
  props: {
    // Stats to render; defaults to the live call. Same shape as `rtc`.
    state: { type: Object, default: null },
    // Where the hover tooltip reads its live value from: 'live' | 'dump'.
    source: { type: String, default: 'live' },
    showSummary: { type: Boolean, default: true },
  },
  data() {
    let collapsed = {};
    try {
      collapsed = JSON.parse(localStorage.getItem(COLLAPSE_STORAGE_KEY) || '{}') || {};
    } catch (e) { /* noop */ }
    return { rtc, METRICS, collapsed };
  },
  computed: {
    view() {
      return this.state || rtc;
    },
    hasData() {
      return !!this.view.updatedAt && this.view.status !== 'idle';
    },
    quality() {
      return qualitySummary(this.view);
    },
    cards() {
      return summaryCards(this.view);
    },
    sections() {
      return buildSections(this.view);
    },
    updatedText() {
      return this.view.updatedAt ? new Date(this.view.updatedAt).toLocaleTimeString('vi-VN') : '';
    },
  },
  methods: {
    toggle(key) {
      this.collapsed = { ...this.collapsed, [key]: !this.collapsed[key] };
      try { localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(this.collapsed)); } catch (e) { /* noop */ }
    },
    // Badge on collapsed-or-not headers so problems are visible at a glance.
    issues(section) {
      const bad = section.rows.filter((r) => r.level === 'bad').length;
      const warn = section.rows.filter((r) => r.level === 'warn').length;
      if (bad) return { count: bad + warn, level: 'bad' };
      if (warn) return { count: warn, level: 'warn' };
      return null;
    },
    sparkPath(series, area) {
      const pts = series
        .map((v, i) => ({ v, i }))
        .filter((p) => p.v != null && Number.isFinite(p.v));
      if (pts.length < 2) return '';
      const max = Math.max(...pts.map((p) => p.v));
      const min = Math.min(...pts.map((p) => p.v));
      const span = max - min || 1;
      const n = Math.max(series.length - 1, 1);
      const coords = pts.map((p) => [
        (p.i / n) * 100,
        26 - ((p.v - min) / span) * 22,
      ]);
      const line = coords.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2)).join(' ');
      if (!area) return line;
      const first = coords[0][0].toFixed(2);
      const last = coords[coords.length - 1][0].toFixed(2);
      return line + ` L${last} 28 L${first} 28 Z`;
    },
  },
};
</script>
