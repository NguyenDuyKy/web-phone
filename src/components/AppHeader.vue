<template>
  <header class="header">
    <div class="header-brand">
      <button
        class="header-menu-toggle"
        :class="{ active: store.sidebarOpen }"
        @click.stop="onToggleSidebar"
        :aria-label="store.sidebarOpen ? 'Đóng menu' : 'Mở menu'"
        :aria-expanded="store.sidebarOpen"
        title="Menu"
      >
        <i :class="store.sidebarOpen ? 'bi bi-x-lg' : 'bi bi-list'"></i>
      </button>
      <div class="logo"><i class="bi bi-headset"></i></div>
      <div class="header-brand-text">
        <span class="header-brand-eyebrow">STRINGEE · WEBPHONE</span>
        <h1>Call Center</h1>
      </div>
      <div class="header-divider"></div>
      <select
        class="server-select"
        v-model="store.serverKey"
        :disabled="store.isConnected || store.isConnecting"
      >
        <option value="">DEFAULT · AUTO</option>
        <option v-for="(_v, k) in store.serverConfig" :key="k" :value="k">{{ k }}</option>
      </select>
      <button
        class="btn-config btn-config--icon btn-config-trigger"
        :class="{ active: store.configModal.active }"
        @click.stop="onToggleConfig"
        title="Cấu hình mặc định"
      >
        <i class="bi bi-sliders2"></i>
      </button>
      <button
        class="btn-config btn-config--icon btn-rtc-trigger"
        :class="{ active: store.rtcPanel.active }"
        @click.stop="onToggleRtc"
        title="Thông số WebRTC"
        aria-label="Thông số WebRTC"
        :aria-expanded="store.rtcPanel.active"
      >
        <i class="bi bi-activity"></i>
        <span v-if="rtc.status === 'live'" class="btn-rtc-trigger__live" aria-hidden="true"></span>
      </button>
      <button
        class="btn-config btn-config--icon btn-dump-trigger"
        :class="{ active: store.dumpPanel.active, 'is-dragover': dumpDragOver, 'has-file': dump.status === 'ready' }"
        @click.stop="onToggleDump"
        @dragenter.prevent="dumpDragOver = true"
        @dragover.prevent
        @dragleave="dumpDragOver = false"
        @drop.prevent="onDropDump"
        title="Phân tích file dump WebRTC (chrome://webrtc-internals)"
        aria-label="Phân tích file dump WebRTC"
        :aria-expanded="store.dumpPanel.active"
      >
        <i class="bi bi-file-earmark-bar-graph"></i>
      </button>
      <button
        class="btn-config btn-config--icon"
        @click="onToggleTheme"
        :title="store.theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'"
      >
        <i :class="store.theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill'"></i>
      </button>
    </div>

    <div class="header-status">
      <div class="btn-callmodal-wrap">
        <button
          class="btn-callmodal"
          :class="{ active: store.callModal.active }"
          :disabled="!store.isConnected"
          @click.stop="onToggleCall"
          :title="!store.isConnected
            ? 'Chưa kết nối — vui lòng kết nối phiên trước'
            : (store.callModal.active ? 'Đóng bàn quay số' : 'Mở bàn quay số')"
        >
          <i class="bi bi-telephone-fill"></i>
        </button>
        <span class="btn-callmodal__dot" :class="{ on: store.isConnected }"></span>
      </div>
    </div>
  </header>
</template>

<script>
import { store, toggleConfigModal, toggleTheme, toggleCallModal, toggleSidebar, toggleRtcPanel, toggleDumpPanel, openDumpPanel } from '../store';
import { rtc } from '../webrtcStats';
import { dump, loadDumpFile } from '../webrtcDump';

export default {
  name: 'AppHeader',
  data() {
    return { store, rtc, dump, dumpDragOver: false };
  },
  methods: {
    onToggleConfig() { toggleConfigModal(); },
    onToggleRtc() { toggleRtcPanel(); },
    onToggleDump() { toggleDumpPanel(); },
    // Dropping a dump straight onto the header button opens the analyzer with it.
    onDropDump(e) {
      this.dumpDragOver = false;
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      openDumpPanel();
      loadDumpFile(file);
    },
    onToggleTheme() { toggleTheme(); },
    onToggleCall() { toggleCallModal(); },
    onToggleSidebar() { toggleSidebar(); },
  },
};
</script>
