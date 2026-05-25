<template>
  <div class="modal-overlay" :class="{ active: store.configModal.active }" @click.self="onClose">
    <div class="config-modal" role="dialog" aria-labelledby="cfgTitle">
      <header class="config-modal__head">
        <div class="config-modal__head-left">
          <div class="config-modal__icon">
            <i class="bi bi-sliders2"></i>
          </div>
          <div class="config-modal__titles">
            <div class="config-modal__eyebrow">LOCAL · PERSISTED</div>
            <h3 class="config-modal__title" id="cfgTitle">Cấu hình mặc định</h3>
            <p class="config-modal__sub">
              Lưu trên trình duyệt (localStorage). Tự nạp vào các trường ở lần mở kế tiếp.
            </p>
          </div>
        </div>
        <button class="config-modal__close" @click="onClose" aria-label="Đóng">
          <i class="bi bi-x-lg"></i>
        </button>
      </header>

      <div class="config-modal__body">
        <div class="cfg-field">
          <label for="cfgToken" class="cfg-label">
            <span class="cfg-label__index">01</span>
            <span class="cfg-label__text">Access Token</span>
            <span class="cfg-label__hint">JWT</span>
          </label>
          <textarea
            id="cfgToken"
            class="cfg-input cfg-input--mono"
            v-model="store.configModal.token"
            placeholder="eyJjdHkiOiJzdHJpbmdlZS1hcGk7dj0xIiwidHlwIjoiSldUIi..."
            spellcheck="false"
          ></textarea>
        </div>

        <div class="cfg-field-row">
          <div class="cfg-field">
            <label for="cfgHotline" class="cfg-label">
              <span class="cfg-label__index">02</span>
              <span class="cfg-label__text">Hotline</span>
            </label>
            <input
              id="cfgHotline"
              type="text"
              class="cfg-input"
              v-model="store.configModal.hotline"
              placeholder="842471098xxx"
              autocomplete="off"
            >
          </div>

          <div class="cfg-field">
            <label for="cfgToNumber" class="cfg-label">
              <span class="cfg-label__index">03</span>
              <span class="cfg-label__text">Số đích mặc định</span>
            </label>
            <input
              id="cfgToNumber"
              type="text"
              class="cfg-input"
              v-model="store.configModal.toNumber"
              placeholder="84369xxxxxx"
              autocomplete="off"
            >
          </div>
        </div>

        <div class="cfg-field">
          <label for="cfgTtsWorker" class="cfg-label">
            <span class="cfg-label__index">04</span>
            <span class="cfg-label__text">TTS Worker URL</span>
            <span class="cfg-label__hint">Cloudflare · Tuỳ chọn</span>
          </label>
          <input
            id="cfgTtsWorker"
            type="text"
            class="cfg-input"
            v-model="store.configModal.ttsWorkerUrl"
            placeholder="https://edge-tts.your-subdomain.workers.dev"
            autocomplete="off"
            spellcheck="false"
          >
          <p class="cfg-hint">
            Để trống nếu dùng giọng đọc hệ thống (không tải MP3). Có URL → dùng Google TTS qua proxy + download MP3. Xem hướng dẫn deploy ở thư mục
            <code>worker/</code> trong repo.
          </p>
        </div>
      </div>

      <footer class="config-modal__foot">
        <button class="cfg-btn cfg-btn--ghost-danger" @click="onClear" title="Xoá khỏi localStorage">
          <i class="bi bi-trash3"></i> Xoá lưu trữ
        </button>
        <div class="config-modal__foot-actions">
          <button class="cfg-btn cfg-btn--ghost" @click="onClose">Huỷ</button>
          <button class="cfg-btn cfg-btn--primary" @click="onSave">
            <i class="bi bi-check2"></i> Lưu cấu hình
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>

<script>
import {
  store,
  closeConfigModal,
  saveDefaultConfig,
  clearDefaultConfig,
} from '../store';

export default {
  name: 'ConfigModal',
  data() {
    return { store };
  },
  methods: {
    onClose() { closeConfigModal(); },
    onSave() { saveDefaultConfig(); },
    onClear() { clearDefaultConfig(); },
  },
};
</script>
