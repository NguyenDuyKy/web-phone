<template>
  <div class="login-panel-wrap">
    <div class="panel-head">
      <div class="panel-head-text">
        <div class="panel-eyebrow">SESSION · AUTH</div>
        <div class="panel-title">Kết nối phiên</div>
      </div>
      <span class="panel-meta">{{ store.isConnected ? 'LIVE' : 'IDLE' }}</span>
    </div>

    <div class="login-panel">
      <div class="cfg-field">
        <label for="tokenInput" class="cfg-label">
          <span class="cfg-label__index">01</span>
          <span class="cfg-label__text">Access Token</span>
          <span class="cfg-label__hint">JWT</span>
        </label>
        <textarea
          id="tokenInput"
          class="cfg-input cfg-input--mono"
          v-model="store.token"
          placeholder="Dán access token từ Stringee Dashboard..."
          spellcheck="false"
          :disabled="store.isConnected || store.isConnecting"
        ></textarea>
      </div>

      <div class="cfg-field">
        <label for="hotlineInput" class="cfg-label">
          <span class="cfg-label__index">02</span>
          <span class="cfg-label__text">Số Hotline</span>
        </label>
        <input
          id="hotlineInput"
          type="text"
          class="cfg-input"
          v-model="store.hotline"
          placeholder="VD: 842471098xxx"
          autocomplete="off"
        >
      </div>

      <button
        v-if="!store.isConnected"
        class="cfg-btn cfg-btn--primary cfg-btn--block"
        :disabled="store.isConnecting"
        @click="onConnect"
      >
        <template v-if="store.isConnecting">
          <i class="bi bi-arrow-repeat spin-icon"></i> Đang kết nối...
        </template>
        <template v-else>
          <i class="bi bi-lightning-charge-fill"></i> Kết nối
        </template>
      </button>
      <button
        v-else
        class="cfg-btn cfg-btn--danger cfg-btn--block"
        @click="onDisconnect"
      >
        <i class="bi bi-power"></i> Ngắt kết nối
      </button>
    </div>
  </div>
</template>

<script>
import { store, handleConnect, handleDisconnect } from '../store';

export default {
  name: 'LoginPanel',
  data() {
    return { store };
  },
  methods: {
    onConnect() { handleConnect(); },
    onDisconnect() { handleDisconnect(); },
  },
};
</script>
