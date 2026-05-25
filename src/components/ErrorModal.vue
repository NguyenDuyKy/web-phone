<template>
  <div class="modal-overlay" :class="{ active: store.errorModal.active }" @click.self="onClose">
    <div class="config-modal config-modal--sm" role="alertdialog" aria-labelledby="errTitle">
      <header class="config-modal__head">
        <div class="config-modal__head-left">
          <div class="config-modal__icon error">
            <i class="bi bi-exclamation-triangle-fill"></i>
          </div>
          <div class="config-modal__titles">
            <div class="config-modal__eyebrow error">ERROR · ALERT</div>
            <h3 class="config-modal__title" id="errTitle">{{ store.errorModal.title || 'Lỗi' }}</h3>
          </div>
        </div>
        <button class="config-modal__close" @click="onClose" aria-label="Đóng">
          <i class="bi bi-x-lg"></i>
        </button>
      </header>

      <div class="config-modal__body">
        <p class="config-modal__message">{{ store.errorModal.message }}</p>
      </div>

      <footer class="config-modal__foot config-modal__foot--end">
        <button class="cfg-btn cfg-btn--primary" @click="onClose">
          <i class="bi bi-check2"></i> Đã hiểu
        </button>
      </footer>
    </div>
  </div>
</template>

<script>
import { store, closeErrorModal } from '../store';

export default {
  name: 'ErrorModal',
  data() {
    return { store };
  },
  methods: {
    onClose() { closeErrorModal(); },
  },
};
</script>
