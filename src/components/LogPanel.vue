<template>
  <div class="log-section">
    <div class="panel-head">
      <div class="panel-head-text">
        <div class="panel-eyebrow">SYSTEM · TELEMETRY</div>
        <div class="panel-title">Nhật ký hoạt động</div>
      </div>
      <span class="panel-meta">{{ store.logs.length.toString().padStart(3, '0') }}</span>
    </div>

    <div class="log-container" ref="container">
      <div
        v-for="(log, i) in store.logs"
        :key="i"
        :class="['log-entry', log.type]"
      >
        <span class="time">{{ log.time }}</span>{{ log.msg }}
      </div>
    </div>
  </div>
</template>

<script>
import { store } from '../store';

export default {
  name: 'LogPanel',
  data() {
    return { store };
  },
  updated() {
    const c = this.$refs.container;
    if (c) c.scrollTop = c.scrollHeight;
  },
};
</script>
