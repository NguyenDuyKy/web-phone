<template>
  <Transition name="popover">
    <div
      v-if="store.callModal.active"
      class="config-modal call-popover"
      :class="{ 'call-popover--incoming': store.hasIncoming }"
      ref="popover"
      role="dialog"
      aria-labelledby="callModalTitle"
    >
      <header class="config-modal__head">
        <div class="config-modal__head-left">
          <div class="config-modal__icon">
            <i :class="store.hasIncoming
              ? (store.incomingIsVideo ? 'bi bi-camera-video-fill' : 'bi bi-telephone-inbound-fill')
              : 'bi bi-grid-3x3-gap-fill'"></i>
          </div>
          <div class="config-modal__titles">
            <div class="config-modal__eyebrow">
              {{ store.hasIncoming ? 'INCOMING · SIGNAL' : 'DIALER · KEYPAD' }}
            </div>
            <h3 class="config-modal__title" id="callModalTitle">
              {{ store.hasIncoming ? 'Cuộc gọi đến' : 'Bàn quay số' }}
            </h3>
          </div>
        </div>
        <button
          v-if="!store.hasIncoming"
          class="config-modal__close"
          @click="onClose"
          aria-label="Đóng"
        >
          <i class="bi bi-x-lg"></i>
        </button>
      </header>

      <div class="config-modal__body call-modal__body">
        <div v-if="store.hasIncoming" class="call-modal__incoming">
          <div class="call-modal__incoming-avatar" :class="{ video: store.incomingIsVideo }">
            <i :class="store.incomingIsVideo ? 'bi bi-camera-video-fill' : 'bi bi-telephone-inbound-fill'"></i>
          </div>
          <div class="call-modal__incoming-name">{{ store.incomingNumber || '—' }}</div>
          <div class="call-modal__incoming-label">Đang đổ chuông…</div>
          <div class="call-modal__incoming-badge" :class="{ video: store.incomingIsVideo }">
            <i :class="store.incomingIsVideo ? 'bi bi-camera-video-fill' : 'bi bi-telephone-fill'"></i>
            {{ store.incomingIsVideo ? 'Video Call' : 'Voice Call' }}
          </div>
          <div class="call-modal__incoming-actions">
            <div class="call-modal__incoming-action">
              <button class="call-action-btn hangup" @click="onReject" title="Từ chối">
                <i class="bi bi-telephone-x-fill"></i>
              </button>
              <span>Từ chối</span>
            </div>
            <div class="call-modal__incoming-action">
              <button class="call-action-btn answer" @click="onAnswer" title="Trả lời">
                <i class="bi bi-telephone-fill"></i>
              </button>
              <span>Trả lời</span>
            </div>
          </div>
        </div>

        <template v-else>
          <div class="call-modal__status-row">
            <div class="connection-badge" :class="{ connected: store.isConnected }">
              <span class="dot"></span>
              <span>{{ store.isConnected ? 'Online' : 'Offline' }}</span>
            </div>
            <div v-if="store.isConnected" class="user-info">
              <div class="user-avatar"><i class="bi bi-person-fill"></i></div>
              <span class="user-name">{{ store.userId || '—' }}</span>
            </div>
            <div v-else class="call-modal__status-hint">
              <i class="bi bi-info-circle"></i> Kết nối phiên trước
            </div>
          </div>

          <div class="dial-input-wrap">
            <input
              id="dialInput"
              type="text"
              class="dial-input"
              v-model="store.dialInput"
              placeholder="Số / User ID"
              autocomplete="off"
            >
            <button class="dial-backspace" @click="onBackspace" title="Xóa">
              <i class="bi bi-backspace"></i>
            </button>
          </div>

          <div class="dialpad">
            <button
              v-for="k in keys"
              :key="k.digit"
              class="dialpad-key"
              @click="onPress(k.digit)"
            >
              {{ k.digit }}<span class="sub" v-html="k.sub"></span>
            </button>
          </div>

          <div v-if="!store.currentCall" class="call-type-dd" :class="{ open: isTypeOpen }" ref="typeDropdown">
            <button
              type="button"
              class="call-type-dd__trigger"
              @click.stop="toggleType"
              :aria-expanded="isTypeOpen"
            >
              <span class="call-type-dd__icon" :class="'is-' + currentOption.color">
                <i :class="currentOption.icon"></i>
              </span>
              <span class="call-type-dd__label">{{ currentOption.label }}</span>
              <i class="bi bi-chevron-down call-type-dd__chev"></i>
            </button>
            <Transition name="dd-menu">
              <div v-if="isTypeOpen" class="call-type-dd__menu" :class="{ 'is-up': dropupMode }" ref="typeMenu">
                <button
                  v-for="opt in callTypeOptions"
                  :key="opt.value"
                  type="button"
                  class="call-type-dd__item"
                  :class="{ selected: opt.value === store.callType }"
                  @click="selectType(opt.value)"
                >
                  <span class="call-type-dd__icon" :class="'is-' + opt.color">
                    <i :class="opt.icon"></i>
                  </span>
                  <div class="call-type-dd__item-text">
                    <span class="call-type-dd__item-label">{{ opt.label }}</span>
                    <span class="call-type-dd__item-sub">{{ opt.sub }}</span>
                  </div>
                  <i v-if="opt.value === store.callType" class="bi bi-check-lg call-type-dd__check"></i>
                </button>
              </div>
            </Transition>
          </div>

          <div v-if="!store.currentCall" class="dial-actions">
            <button
              class="btn-call btn-call--full"
              :class="callBtnClass"
              :disabled="!store.isConnected"
              @click="onCall"
            >
              <i :class="callBtnIcon"></i> {{ callBtnLabel }}
            </button>
          </div>
        </template>

      </div>
    </div>
  </Transition>
</template>

<script>
import {
  store,
  dialPress,
  dialBackspace,
  makeCall,
  closeCallModal,
  setCallType,
  answerCall,
  rejectCall,
} from '../store';

const NBSP = '&nbsp;';
const keys = [
  { digit: '1', sub: NBSP },
  { digit: '2', sub: 'ABC' },
  { digit: '3', sub: 'DEF' },
  { digit: '4', sub: 'GHI' },
  { digit: '5', sub: 'JKL' },
  { digit: '6', sub: 'MNO' },
  { digit: '7', sub: 'PQRS' },
  { digit: '8', sub: 'TUV' },
  { digit: '9', sub: 'WXYZ' },
  { digit: '*', sub: NBSP },
  { digit: '0', sub: '+' },
  { digit: '#', sub: NBSP },
];
const callTypeOptions = [
  {
    value: 'gsm',
    label: 'Gọi thoại GSM',
    sub: 'Ra số điện thoại ngoài mạng',
    icon: 'bi bi-telephone-outbound-fill',
    color: 'green',
  },
  {
    value: 'internal',
    label: 'Gọi thoại nội bộ',
    sub: 'User ID nội bộ Stringee',
    icon: 'bi bi-people-fill',
    color: 'cyan',
  },
  {
    value: 'video',
    label: 'Gọi video',
    sub: 'Cuộc gọi có hình ảnh',
    icon: 'bi bi-camera-video-fill',
    color: 'blue',
  },
];

export default {
  name: 'CallModal',
  data() {
    return {
      store,
      keys,
      callTypeOptions,
      isTypeOpen: false,
      dropupMode: false,
    };
  },
  computed: {
    currentOption() {
      return callTypeOptions.find((o) => o.value === store.callType) || callTypeOptions[0];
    },
    callBtnClass() {
      return store.callType === 'video' ? 'btn-call-video' : 'btn-call-voice';
    },
    callBtnIcon() {
      return store.callType === 'video' ? 'bi bi-camera-video-fill' : 'bi bi-telephone-fill';
    },
    callBtnLabel() {
      if (store.callType === 'video') return 'Gọi video';
      if (store.callType === 'internal') return 'Gọi thoại nội bộ';
      return 'Gọi thoại GSM';
    },
  },
  watch: {
    'store.callModal.active'(active) {
      if (!active) this.isTypeOpen = false;
    },
    isTypeOpen(open) {
      if (open) {
        this.$nextTick(() => this.computeDropdownDirection());
      }
    },
  },
  mounted() {
    document.addEventListener('mousedown', this.handleOutsideClick);
  },
  unmounted() {
    document.removeEventListener('mousedown', this.handleOutsideClick);
  },
  methods: {
    handleOutsideClick(e) {
      if (this.isTypeOpen) {
        const dd = this.$refs.typeDropdown;
        if (dd && !dd.contains(e.target)) {
          this.isTypeOpen = false;
        }
      }
      if (!store.callModal.active) return;
      if (store.hasIncoming) return;
      const popover = this.$refs.popover;
      const trigger = document.querySelector('.btn-callmodal');
      if (popover && popover.contains(e.target)) return;
      if (trigger && trigger.contains(e.target)) return;
      closeCallModal();
    },
    toggleType() { this.isTypeOpen = !this.isTypeOpen; },
    computeDropdownDirection() {
      const dd = this.$refs.typeDropdown;
      if (!dd) return;
      const trigger = dd.querySelector('.call-type-dd__trigger');
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const menu = this.$refs.typeMenu;
      const menuHeight = menu ? menu.offsetHeight : 180;
      const gap = 12;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      this.dropupMode = spaceBelow < menuHeight + gap && spaceAbove > spaceBelow;
    },
    selectType(value) {
      setCallType(value);
      this.isTypeOpen = false;
    },
    onClose() { closeCallModal(); },
    onPress(k) { dialPress(k); },
    onBackspace() { dialBackspace(); },
    onCall() { makeCall(); },
    onAnswer() { answerCall(); },
    onReject() { rejectCall(); },
  },
};
</script>
