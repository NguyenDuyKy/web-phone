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
      <button class="btn-config" @click="onOpenConfig" title="Cấu hình mặc định">
        <i class="bi bi-sliders2"></i> Cấu hình
      </button>
      <button
        class="btn-config btn-config--icon btn-tts-trigger"
        :class="{ active: store.ttsModal.active }"
        @click.stop="onToggleTts"
        title="Chuyển văn bản thành giọng nói"
      >
        <i class="bi bi-soundwave"></i>
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
import { store, openConfigModal, toggleTheme, toggleCallModal, toggleTtsModal, toggleSidebar } from '../store';

export default {
  name: 'AppHeader',
  data() {
    return { store };
  },
  methods: {
    onOpenConfig() { openConfigModal(); },
    onToggleTheme() { toggleTheme(); },
    onToggleCall() { toggleCallModal(); },
    onToggleTts() { toggleTtsModal(); },
    onToggleSidebar() { toggleSidebar(); },
  },
};
</script>
