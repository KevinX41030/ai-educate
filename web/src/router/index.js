import { createRouter, createWebHistory } from 'vue-router';
import HomePage from '../pages/HomePage.vue';
import WorkspacePage from '../pages/WorkspacePage.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomePage },
    { path: '/workspace', name: 'workspace', component: WorkspacePage },
    { path: '/create', redirect: '/workspace' },
    { path: '/copilot', redirect: '/workspace' },
    { path: '/preview', redirect: '/workspace' }
  ]
});

export default router;
