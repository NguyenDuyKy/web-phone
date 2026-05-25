<template>
  <Transition name="popover">
    <div
      v-if="store.ttsModal.active"
      class="config-modal tts-popover"
      ref="popover"
      role="dialog"
      aria-labelledby="ttsTitle"
    >
      <header class="config-modal__head">
        <div class="config-modal__head-left">
          <div class="config-modal__icon">
            <i class="bi bi-soundwave"></i>
          </div>
          <div class="config-modal__titles">
            <div class="config-modal__eyebrow">
              {{ cloudMode ? 'GOOGLE TTS · CLOUD' : 'WEB SPEECH · LOCAL' }}
            </div>
            <h3 class="config-modal__title" id="ttsTitle">Chuyển văn bản thành giọng nói</h3>
          </div>
        </div>
        <button class="config-modal__close" @click="onClose" aria-label="Đóng">
          <i class="bi bi-x-lg"></i>
        </button>
      </header>

      <div class="config-modal__body tts-popover__body">
        <div class="tts-field">
          <div class="tts-field__label">
            <span>Giọng đọc</span>
            <span v-if="voices.length" class="tts-field__counter">{{ voices.length }} giọng</span>
          </div>

          <div v-if="!voices.length" class="tts-error">
            <i class="bi bi-exclamation-triangle-fill"></i>
            Không tìm thấy giọng đọc nào.
          </div>

          <div
            v-else
            class="call-type-dd tts-voice-dd"
            :class="{ open: isVoiceOpen }"
            ref="voiceDropdown"
          >
            <button
              type="button"
              class="call-type-dd__trigger"
              @click.stop="toggleVoice"
              :aria-expanded="isVoiceOpen"
            >
              <span class="call-type-dd__icon is-blue">
                <span class="tts-voice-flag">{{ currentVoice.flag }}</span>
              </span>
              <span class="tts-voice-dd__text">
                <span class="call-type-dd__label">{{ currentVoice.label }}</span>
                <span class="tts-voice-dd__sub">{{ currentVoice.lang }}</span>
              </span>
              <i class="bi bi-chevron-down call-type-dd__chev"></i>
            </button>
            <Transition name="dd-menu">
              <div v-if="isVoiceOpen" class="call-type-dd__menu tts-voice-menu" ref="voiceMenu">
                <button
                  v-for="v in voices"
                  :key="v.value"
                  type="button"
                  class="call-type-dd__item"
                  :class="{ selected: v.value === store.ttsModal.voice }"
                  @click="selectVoice(v.value)"
                >
                  <span class="call-type-dd__icon is-blue">
                    <span class="tts-voice-flag">{{ v.flag }}</span>
                  </span>
                  <div class="call-type-dd__item-text">
                    <span class="call-type-dd__item-label">{{ v.label }}</span>
                    <span class="call-type-dd__item-sub">{{ v.lang }}</span>
                  </div>
                  <i v-if="v.value === store.ttsModal.voice" class="bi bi-check-lg call-type-dd__check"></i>
                </button>
              </div>
            </Transition>
          </div>

          <p v-if="voices.length" class="tts-voice-desc">
            <i class="bi bi-info-circle"></i> {{ currentVoice.desc }}
          </p>
        </div>

        <div class="tts-field">
          <div class="tts-field__label">
            <span>Tốc độ đọc</span>
            <span class="tts-field__counter">{{ store.ttsModal.speed }}×</span>
          </div>
          <div class="tts-speed">
            <button
              v-for="opt in speedOptions"
              :key="opt.value"
              type="button"
              class="tts-speed__btn"
              :class="{ active: store.ttsModal.speed === opt.value }"
              @click="onSetSpeed(opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div class="tts-field">
          <div class="tts-field__label">
            <span>Nội dung</span>
            <span class="tts-field__counter">{{ store.ttsModal.text.length }}/500</span>
          </div>
          <textarea
            class="cfg-input tts-textarea"
            v-model="store.ttsModal.text"
            placeholder="Nhập nội dung cần đọc…"
            maxlength="500"
            spellcheck="false"
          ></textarea>
        </div>

        <div v-if="store.ttsModal.error" class="tts-error">
          <i class="bi bi-exclamation-triangle-fill"></i> {{ store.ttsModal.error }}
        </div>

        <div v-if="cloudMode && store.ttsModal.audioUrl" class="tts-player">
          <div class="tts-player__head">
            <i class="bi bi-music-note-beamed"></i>
            <span>Audio đã sẵn sàng</span>
          </div>
          <audio
            :key="store.ttsModal.audioUrl"
            :src="store.ttsModal.audioUrl"
            ref="audioEl"
            controls
            preload="auto"
            class="tts-audio"
            @loadedmetadata="applyAudioSpeed"
          ></audio>
        </div>

        <div class="tts-actions">
          <button
            class="cfg-btn cfg-btn--ghost-danger tts-actions__reset"
            @click="onReset"
            :disabled="resetDisabled"
            title="Xoá nội dung"
          >
            <i class="bi bi-arrow-counterclockwise"></i>
          </button>

          <button
            v-if="cloudMode && store.ttsModal.audioUrl"
            class="cfg-btn cfg-btn--ghost"
            @click="onDownload"
            :disabled="store.ttsModal.loading"
          >
            <i class="bi bi-download"></i> Tải MP3
          </button>

          <button
            v-if="!cloudMode && store.ttsModal.isPlaying"
            class="cfg-btn cfg-btn--ghost tts-actions__generate"
            @click="onStop"
          >
            <i class="bi bi-stop-fill"></i> Dừng
          </button>
          <button
            v-else
            class="cfg-btn cfg-btn--primary tts-actions__generate"
            @click="onSpeak"
            :disabled="speakDisabled"
          >
            <i v-if="store.ttsModal.loading" class="bi bi-arrow-repeat spin-icon"></i>
            <i v-else-if="cloudMode" class="bi bi-soundwave"></i>
            <i v-else class="bi bi-play-fill"></i>
            {{ generateButtonLabel }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script>
import {
  store,
  closeTtsModal,
  speakTts,
  stopTts,
  resetTts,
  setTtsVoice,
  setTtsSpeed,
  initTtsVoices,
  downloadTts,
  isTtsCloudMode,
} from '../store';

const speedOptions = [
  { value: 0.5, label: '0.5×' },
  { value: 0.75, label: '0.75×' },
  { value: 1, label: '1×' },
  { value: 1.25, label: '1.25×' },
  { value: 1.5, label: '1.5×' },
  { value: 2, label: '2×' },
];

const LANG_INFO = {
  'vi-VN': { flag: '🇻🇳', name: 'Tiếng Việt' },
  'vi': { flag: '🇻🇳', name: 'Tiếng Việt' },
  'en-US': { flag: '🇺🇸', name: 'English (US)' },
  'en-GB': { flag: '🇬🇧', name: 'English (UK)' },
  'en-AU': { flag: '🇦🇺', name: 'English (AU)' },
  'en-IN': { flag: '🇮🇳', name: 'English (IN)' },
  'en': { flag: '🇺🇸', name: 'English' },
  'ja-JP': { flag: '🇯🇵', name: '日本語' },
  'ja': { flag: '🇯🇵', name: '日本語' },
  'zh-CN': { flag: '🇨🇳', name: '中文 (普通话)' },
  'zh-TW': { flag: '🇹🇼', name: '中文 (繁體)' },
  'zh-HK': { flag: '🇭🇰', name: '粵語' },
  'zh': { flag: '🇨🇳', name: '中文' },
  'ko-KR': { flag: '🇰🇷', name: '한국어' },
  'ko': { flag: '🇰🇷', name: '한국어' },
  'fr-FR': { flag: '🇫🇷', name: 'Français' },
  'fr': { flag: '🇫🇷', name: 'Français' },
  'de-DE': { flag: '🇩🇪', name: 'Deutsch' },
  'de': { flag: '🇩🇪', name: 'Deutsch' },
  'es-ES': { flag: '🇪🇸', name: 'Español' },
  'es-MX': { flag: '🇲🇽', name: 'Español (MX)' },
  'es': { flag: '🇪🇸', name: 'Español' },
  'it-IT': { flag: '🇮🇹', name: 'Italiano' },
  'it': { flag: '🇮🇹', name: 'Italiano' },
  'pt-BR': { flag: '🇧🇷', name: 'Português (BR)' },
  'pt-PT': { flag: '🇵🇹', name: 'Português' },
  'pt': { flag: '🇧🇷', name: 'Português' },
  'ru-RU': { flag: '🇷🇺', name: 'Русский' },
  'ru': { flag: '🇷🇺', name: 'Русский' },
  'th-TH': { flag: '🇹🇭', name: 'ไทย' },
  'id-ID': { flag: '🇮🇩', name: 'Indonesia' },
};

const GOOGLE_VOICE_DESC = {
  'vi': 'Giọng tiếng Việt từ Google TTS. Phù hợp đọc thông báo, lời chào tổng đài tiếng Việt.',
  'en-US': 'Giọng Anh-Mỹ từ Google TTS. Chuẩn quốc tế, tự nhiên.',
  'en-GB': 'Giọng Anh-Anh từ Google TTS. British accent.',
  'ja': 'Giọng tiếng Nhật từ Google TTS.',
  'zh-CN': 'Giọng tiếng Trung phổ thông (Simplified) từ Google TTS.',
  'zh-TW': 'Giọng tiếng Trung phồn thể (Traditional) từ Google TTS.',
  'ko': 'Giọng tiếng Hàn từ Google TTS.',
  'fr': 'Giọng tiếng Pháp từ Google TTS.',
  'de': 'Giọng tiếng Đức từ Google TTS.',
  'es': 'Giọng tiếng Tây Ban Nha từ Google TTS.',
  'it': 'Giọng tiếng Ý từ Google TTS.',
  'pt-BR': 'Giọng Bồ Đào Nha (Brazil) từ Google TTS.',
  'ru': 'Giọng tiếng Nga từ Google TTS.',
  'th': 'Giọng tiếng Thái từ Google TTS.',
  'id': 'Giọng tiếng Indonesia từ Google TTS.',
  'hi': 'Giọng tiếng Hindi từ Google TTS.',
  'ar': 'Giọng tiếng Ả Rập từ Google TTS.',
};

function getLangInfo(lang) {
  if (!lang) return { flag: '🌐', name: 'Unknown' };
  return LANG_INFO[lang] || LANG_INFO[lang.split('-')[0]] || { flag: '🌐', name: lang };
}

export default {
  name: 'TtsModal',
  data() {
    return {
      store,
      speedOptions,
      isVoiceOpen: false,
    };
  },
  computed: {
    cloudMode() {
      return isTtsCloudMode();
    },
    voices() {
      const list = store.ttsModal.availableVoices || [];
      const items = list.map((v) => {
        const info = getLangInfo(v.lang);
        if (this.cloudMode) {
          return {
            value: v.name,
            label: info.name,
            lang: v.lang,
            flag: info.flag,
            desc: GOOGLE_VOICE_DESC[v.name] || `Giọng ${info.name} từ Google TTS.`,
            _langPriority: (v.lang || '').toLowerCase().startsWith('vi') ? 0
              : (v.lang || '').toLowerCase().startsWith('en') ? 1 : 2,
          };
        }
        const tags = [];
        tags.push(v.localService ? 'Offline' : 'Cloud');
        if (v.default) tags.push('Mặc định');
        return {
          value: v.name,
          label: v.name,
          lang: `${info.name} · ${v.lang}`,
          flag: info.flag,
          desc: `Giọng đọc của hệ thống (${tags.join(' · ')}).`,
          _langPriority: (v.lang || '').toLowerCase().startsWith('vi') ? 0
            : (v.lang || '').toLowerCase().startsWith('en') ? 1 : 2,
        };
      });
      items.sort((a, b) => a._langPriority - b._langPriority);
      return items;
    },
    currentVoice() {
      return this.voices.find((v) => v.value === store.ttsModal.voice)
        || this.voices[0]
        || { label: '—', lang: 'Chưa có', flag: '🌐', desc: 'Chưa có giọng đọc khả dụng.' };
    },
    generateButtonLabel() {
      if (store.ttsModal.loading) return 'Đang sinh…';
      if (this.cloudMode) return 'Sinh giọng nói';
      return 'Phát';
    },
    speakDisabled() {
      if (store.ttsModal.loading) return true;
      if (!store.ttsModal.text.trim()) return true;
      if (!this.voices.length) return true;
      return false;
    },
    resetDisabled() {
      if (store.ttsModal.loading) return true;
      return !store.ttsModal.text
        && !store.ttsModal.audioUrl
        && !store.ttsModal.isPlaying;
    },
  },
  watch: {
    'store.ttsModal.active'(active) {
      if (active) {
        if (!store.ttsModal.availableVoices.length) initTtsVoices();
        this.$nextTick(() => this.positionPopover());
      } else {
        this.isVoiceOpen = false;
        stopTts();
      }
    },
    'store.ttsModal.speed'() {
      this.applyAudioSpeed();
    },
  },
  mounted() {
    document.addEventListener('mousedown', this.handleOutsideClick);
    window.addEventListener('resize', this.positionPopover);
  },
  unmounted() {
    document.removeEventListener('mousedown', this.handleOutsideClick);
    window.removeEventListener('resize', this.positionPopover);
  },
  methods: {
    positionPopover() {
      if (!store.ttsModal.active) return;
      const popover = this.$refs.popover;
      const trigger = document.querySelector('.btn-tts-trigger');
      if (!popover || !trigger) return;
      const rect = trigger.getBoundingClientRect();
      const popoverWidth = popover.offsetWidth || 380;
      const margin = 12;
      let left = rect.left + rect.width / 2 - popoverWidth / 2;
      left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin));
      popover.style.left = left + 'px';
      const arrowLeft = (rect.left + rect.width / 2) - left;
      popover.style.setProperty('--tts-arrow-left', arrowLeft + 'px');
    },
    handleOutsideClick(e) {
      if (this.isVoiceOpen) {
        const dd = this.$refs.voiceDropdown;
        if (dd && !dd.contains(e.target)) this.isVoiceOpen = false;
      }
      if (!store.ttsModal.active) return;
      const popover = this.$refs.popover;
      const trigger = document.querySelector('.btn-tts-trigger');
      if (popover && popover.contains(e.target)) return;
      if (trigger && trigger.contains(e.target)) return;
      closeTtsModal();
    },
    toggleVoice() { this.isVoiceOpen = !this.isVoiceOpen; },
    selectVoice(value) {
      setTtsVoice(value);
      this.isVoiceOpen = false;
    },
    onClose() { closeTtsModal(); },
    onSpeak() { speakTts(); },
    onStop() { stopTts(); },
    onReset() { resetTts(); },
    onDownload() { downloadTts(); },
    onSetSpeed(value) { setTtsSpeed(value); },
    applyAudioSpeed() {
      const el = this.$refs.audioEl;
      if (el) el.playbackRate = store.ttsModal.speed || 1;
    },
  },
};
</script>
