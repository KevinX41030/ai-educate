import { createRouter, createWebHistory } from 'vue-router';
import HomePage from '../pages/HomePage.vue';
import CreatePage from '../pages/CreatePage.vue';
import CopilotPage from '../pages/CopilotPage.vue';
import PreviewPage from '../pages/PreviewPage.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomePage },
    { path: '/create', name: 'create', component: CreatePage },
    { path: '/copilot', name: 'copilot', component: CopilotPage },
    { path: '/preview', name: 'preview', component: PreviewPage }
  ]
});

export default router;
