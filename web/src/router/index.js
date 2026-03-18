import { createRouter, createWebHistory } from 'vue-router';
import HomePage from '../pages/HomePage.vue';
import PptLivePage from '../pages/PptLivePage.vue';
import WorkspacePage from '../pages/WorkspacePage.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomePage },
    { path: '/generate', name: 'ppt-live', component: PptLivePage },
    { path: '/workspace', name: 'workspace', component: WorkspacePage },
    { path: '/create', redirect: '/workspace' },
    { path: '/copilot', redirect: '/workspace' },
    { path: '/preview', redirect: '/workspace' }
  ]
});

export default router;
