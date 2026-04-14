// node_modules
import { createPinia } from 'pinia';
import { createApp } from 'vue';

// classes
import { router } from '@/classes/router';

// lib
import { i18n } from '@/lib/i18n';

// components
import App from '@/App.vue';

// assets
import '@/assets/css/main.css';
import 'vue-color/style.css';
import '@vuepic/vue-datepicker/dist/main.css';

import 'dayjs/locale/de';
import 'dayjs/locale/en';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(i18n);
app.mount('#app');

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(err => {
        console.log('ServiceWorker registration failed: ', err);
      });
  });
}
