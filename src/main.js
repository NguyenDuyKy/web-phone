import { createApp } from 'vue';
import App from './App.vue';

// Cascade order matters: tokens first (defines :root vars), light-theme last (overrides).
import './styles/tokens.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/popovers.css';
import './styles/screens.css';
import './styles/dialer.css';
import './styles/responsive.css';
import './styles/light-theme.css';

createApp(App).mount('#app');
