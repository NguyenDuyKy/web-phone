<template>
  <div class="app" :class="{ 'app--drawer-open': store.sidebarOpen }">
    <AppHeader />

    <aside class="sidebar" :class="{ 'sidebar--open': store.sidebarOpen }">
      <LoginPanel />
      <LogPanel />
    </aside>

    <div
      class="sidebar-backdrop"
      :class="{ 'is-open': store.sidebarOpen }"
      @click="onCloseSidebar"
      aria-hidden="true"
    ></div>

    <main class="main-panel">
      <div v-show="store.callState === 'idle'" class="idle-state">
        <div class="phone-icon"><i class="bi bi-broadcast-pin"></i></div>
        <div class="idle-state-eyebrow">{{ store.isConnected ? 'STATUS · READY' : 'STATUS · STANDBY' }}</div>
        <h2>{{ store.isConnected ? 'Sẵn sàng cuộc gọi' : 'Chờ kết nối' }}</h2>
        <p>
          {{ store.isConnected
              ? 'Mở Bàn quay số ở góc trên bên phải, nhập số rồi chọn Gọi thoại hoặc Gọi video.'
              : 'Dán Access Token, nhập Hotline ở thanh bên trái rồi nhấn Kết nối để bắt đầu phiên làm việc.' }}
        </p>
      </div>
      <CallView v-if="store.callState === 'active'" />
    </main>

    <audio id="ringtone" loop>
      <source src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" type="audio/mpeg">
    </audio>

    <Transition name="backdrop-fade">
      <div
        v-if="store.callModal.active && !store.hasIncoming"
        class="popover-backdrop popover-backdrop--call"
        @click="onCloseCallModal"
        aria-hidden="true"
      ></div>
    </Transition>
    <Transition name="backdrop-fade">
      <div
        v-if="store.ttsModal.active"
        class="popover-backdrop popover-backdrop--tts"
        @click="onCloseTtsModal"
        aria-hidden="true"
      ></div>
    </Transition>

    <ErrorModal />
    <InfoModal />
    <ConfigModal />
    <CallModal />
    <TtsModal />
  </div>
</template>

<script>
import { store, addLog, initEnv, makeCall, hangupCall, closeSidebar, closeCallModal, closeTtsModal } from './store';
import AppHeader from './components/AppHeader.vue';
import LoginPanel from './components/LoginPanel.vue';
import LogPanel from './components/LogPanel.vue';
import CallView from './components/CallView.vue';
import ErrorModal from './components/ErrorModal.vue';
import InfoModal from './components/InfoModal.vue';
import ConfigModal from './components/ConfigModal.vue';
import CallModal from './components/CallModal.vue';
import TtsModal from './components/TtsModal.vue';

export default {
  name: 'App',
  components: {
    AppHeader,
    LoginPanel,
    LogPanel,
    CallView,
    ErrorModal,
    InfoModal,
    ConfigModal,
    CallModal,
    TtsModal,
  },
  data() {
    return { store };
  },
  mounted() {
    initEnv();
    addLog('Stringee Call Center đã sẵn sàng', 'success');
    addLog('Vui lòng dán Access Token và nhấn "Kết nối"', 'info');
    document.addEventListener('keydown', this.onKeydown);
  },
  unmounted() {
    document.removeEventListener('keydown', this.onKeydown);
  },
  methods: {
    onKeydown(e) {
      const active = document.activeElement;
      if (e.key === 'Enter' && active && active.id === 'dialInput' && store.isConnected) {
        e.preventDefault();
        makeCall();
      }
      if (e.key === 'Escape') {
        if (store.sidebarOpen) {
          closeSidebar();
          return;
        }
        if (store.currentCall) hangupCall();
      }
    },
    onCloseSidebar() { closeSidebar(); },
    onCloseCallModal() { closeCallModal(); },
    onCloseTtsModal() { closeTtsModal(); },
  },
};
</script>
