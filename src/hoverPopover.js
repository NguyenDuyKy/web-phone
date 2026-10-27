import { reactive, markRaw } from 'vue';

// One shared popover instance for every stat. Moving between rows while it is
// open (or just closed) skips the open delay, so it glides instead of re-fading.
const OPEN_DELAY_MS = 220;
const CLOSE_DELAY_MS = 140;
const WARM_WINDOW_MS = 450;

export const hoverPopover = reactive({
    open: false,
    pinned: false, // opened by tap/click — stays until tapped again or outside
    anchor: null,
    section: '',
    metric: '',
    source: 'live', // 'live' (current call) | 'dump' (uploaded webrtc-internals file)
});

let openTimer = null;
let closeTimer = null;
let lastClosedAt = 0;

// Highlight the row the popover is describing (matters for tap-pinned popovers).
function setActiveAnchor(el) {
    const prev = hoverPopover.anchor;
    if (prev && prev !== el) prev.classList.remove('is-tip-active');
    if (el) el.classList.add('is-tip-active');
}

function clearTimers() {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    openTimer = null;
    closeTimer = null;
}

export function requestOpen(el, payload, { immediate = false, pinned = false } = {}) {
    clearTimers();
    const warm = hoverPopover.open || Date.now() - lastClosedAt < WARM_WINDOW_MS;
    const apply = () => {
        setActiveAnchor(el);
        hoverPopover.anchor = markRaw(el);
        hoverPopover.section = payload.section;
        hoverPopover.metric = payload.metric;
        hoverPopover.source = payload.source || 'live';
        hoverPopover.pinned = pinned;
        hoverPopover.open = true;
    };
    if (immediate || warm) apply();
    else openTimer = setTimeout(apply, OPEN_DELAY_MS);
}

export function requestClose(delay = CLOSE_DELAY_MS) {
    clearTimeout(openTimer);
    openTimer = null;
    if (!hoverPopover.open || hoverPopover.pinned) return;
    clearTimeout(closeTimer);
    closeTimer = setTimeout(closePopover, delay);
}

export function cancelClose() {
    clearTimeout(closeTimer);
    closeTimer = null;
}

export function closePopover() {
    clearTimers();
    if (hoverPopover.open) lastClosedAt = Date.now();
    setActiveAnchor(null);
    hoverPopover.open = false;
    hoverPopover.pinned = false;
}

/* v-stat-tip="{ section, metric, source? }" — hover (mouse), focus (keyboard), tap (touch). */
export const vStatTip = {
    mounted(el, binding) {
        el.__statTip = binding.value;
        el.setAttribute('aria-describedby', 'stat-popover');

        el.__statTipHandlers = {
            enter(e) {
                if (e.pointerType !== 'mouse') return;
                requestOpen(el, el.__statTip);
            },
            leave(e) {
                if (e.pointerType !== 'mouse') return;
                requestClose();
            },
            down(e) {
                el.__statTipPointer = e.pointerType;
            },
            click() {
                // Safari's click is a MouseEvent without pointerType → use the preceding pointerdown.
                if (el.__statTipPointer === 'mouse') return;
                if (hoverPopover.open && hoverPopover.anchor === el) closePopover();
                else requestOpen(el, el.__statTip, { immediate: true, pinned: true });
            },
            focus() {
                if (el.matches(':focus-visible')) requestOpen(el, el.__statTip, { immediate: true });
            },
            blur() {
                if (hoverPopover.anchor === el && !hoverPopover.pinned) requestClose(0);
            },
        };
        const h = el.__statTipHandlers;
        el.addEventListener('pointerenter', h.enter);
        el.addEventListener('pointerleave', h.leave);
        el.addEventListener('pointerdown', h.down);
        el.addEventListener('click', h.click);
        el.addEventListener('focus', h.focus);
        el.addEventListener('blur', h.blur);
    },
    updated(el, binding) {
        el.__statTip = binding.value;
    },
    beforeUnmount(el) {
        const h = el.__statTipHandlers;
        if (h) {
            el.removeEventListener('pointerenter', h.enter);
            el.removeEventListener('pointerleave', h.leave);
            el.removeEventListener('pointerdown', h.down);
            el.removeEventListener('click', h.click);
            el.removeEventListener('focus', h.focus);
            el.removeEventListener('blur', h.blur);
        }
        if (hoverPopover.anchor === el) closePopover();
    },
};
