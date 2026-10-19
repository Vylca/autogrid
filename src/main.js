import { createApp } from 'vue';
import App from './App.vue';
import './styles/app.css';
import { initStore } from './lib/store.js';

initStore().then(() => {
  createApp(App).mount('#app');
});
