<template>
  <div class="modal-overlay" :class="{ active: store.infoModal.active }" @click.self="onClose">
    <div class="config-modal config-modal--sm" role="dialog" aria-labelledby="infoTitle">
      <header class="config-modal__head">
        <div class="config-modal__head-left">
          <div class="config-modal__icon">
            <i class="bi bi-send-fill"></i>
          </div>
          <div class="config-modal__titles">
            <div class="config-modal__eyebrow">IN-CALL · INFO</div>
            <h3 class="config-modal__title" id="infoTitle">Gửi thông tin</h3>
            <p class="config-modal__sub">Nội dung sẽ được gửi qua kênh signaling tới đầu kia.</p>
          </div>
        </div>
        <button class="config-modal__close" @click="onClose" aria-label="Đóng">
          <i class="bi bi-x-lg"></i>
        </button>
      </header>

      <div class="config-modal__body">
        <div class="cfg-field">
          <label for="infoJsonInput" class="cfg-label">
            <span class="cfg-label__index">01</span>
            <span class="cfg-label__text">Nội dung</span>
          </label>
          <input
            id="infoJsonInput"
            type="text"
            class="cfg-input"
            v-model="store.infoModal.input"
            placeholder="Nhập nội dung cần gửi..."
            autocomplete="off"
          >
        </div>
      </div>

      <footer class="config-modal__foot config-modal__foot--end">
        <button class="cfg-btn cfg-btn--ghost" @click="onClose">Huỷ</button>
        <button class="cfg-btn cfg-btn--primary" @click="onSend">
          <i class="bi bi-send"></i> Gửi
        </button>
      </footer>
    </div>
  </div>
</template>

<script>
import { store, closeInfoModal, sendInfo } from '../store';

export default {
  name: 'InfoModal',
  data() {
    return { store };
  },
  methods: {
    onClose() { closeInfoModal(); },
    onSend() { sendInfo(); },
  },
};
</script>
