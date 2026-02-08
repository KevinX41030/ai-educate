const chatList = document.getElementById('chatList');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const voiceBtn = document.getElementById('voiceBtn');
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const summaryEl = document.getElementById('summary');
const pptPreview = document.getElementById('pptPreview');
const planPreview = document.getElementById('planPreview');
const interactionPreview = document.getElementById('interactionPreview');
const statusEl = document.getElementById('status');
const exportBtn = document.getElementById('exportBtn');

let sessionId = localStorage.getItem('sessionId') || '';
let latestState = null;
let latestDraft = null;

function appendMessage(role, text) {
  const message = document.createElement('div');
  message.className = `message ${role}`;
  message.textContent = text;
  chatList.appendChild(message);
  chatList.scrollTop = chatList.scrollHeight;
}

function buildSummary(state) {
  if (!state) return '暂无';
  const fields = state.fields || {};
  const keyPoints = Array.isArray(fields.keyPoints) ? fields.keyPoints.join('、') : '';
  return [
    `主题/章节：${fields.subject || '未填写'}`,
    `年级/学段：${fields.grade || '未填写'}`,
    `课堂时长：${fields.duration || '未填写'}`,
    `教学目标：${fields.goals || '未填写'}`,
    `核心知识点：${keyPoints || '未填写'}`,
    `教学风格：${fields.style || '未填写'}`,
    `互动设计：${fields.interactions || '未填写'}`
  ].join('\n');
}

function renderDraft(draft) {
  pptPreview.innerHTML = '';
  planPreview.innerHTML = '';
  interactionPreview.innerHTML = '';

  if (!draft) {
    pptPreview.innerHTML = '<p class="muted">等待生成课件初稿。</p>';
    planPreview.innerHTML = '<p class="muted">暂无教案草稿。</p>';
    interactionPreview.innerHTML = '<p class="muted">暂无互动设计。</p>';
    return;
  }

  draft.ppt.forEach((slide, index) => {
    const card = document.createElement('div');
    card.className = 'card';
    const title = document.createElement('h4');
    title.textContent = `${index + 1}. ${slide.title}`;
    const list = document.createElement('ul');
    if (slide.bullets && slide.bullets.length) {
      slide.bullets.forEach((bullet) => {
        const li = document.createElement('li');
        li.textContent = bullet;
        list.appendChild(li);
      });
    }
    card.appendChild(title);
    card.appendChild(list);
    pptPreview.appendChild(card);
  });

  const plan = draft.lessonPlan;
  if (plan) {
    const items = [
      `教学目标：${plan.goals}`,
      `教学过程：${plan.process.join('；')}`,
      `教学方法：${plan.methods}`,
      `课堂活动：${plan.activities}`,
      `课后作业：${plan.homework}`
    ];
    items.forEach((item) => {
      const span = document.createElement('span');
      span.textContent = item;
      planPreview.appendChild(span);
    });
  }

  if (draft.interactionIdea) {
    interactionPreview.innerHTML = `
      <strong>${draft.interactionIdea.title}</strong>
      <p>${draft.interactionIdea.description}</p>
      <small>更新时间：${new Date(draft.updatedAt).toLocaleString()}</small>
    `;
  }
}

async function updateStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    statusEl.textContent = data.ok ? '运行中' : '不可用';
  } catch (error) {
    statusEl.textContent = '离线';
  }
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  appendMessage('user', text);
  chatInput.value = '';

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, text })
  });

  const data = await response.json();
  if (data.sessionId && data.sessionId !== sessionId) {
    sessionId = data.sessionId;
    localStorage.setItem('sessionId', sessionId);
  }

  if (data.reply) {
    appendMessage('assistant', data.reply);
  }

  if (data.state) {
    latestState = data.state;
    summaryEl.textContent = buildSummary(latestState);
  }

  if (data.draft) {
    latestDraft = data.draft;
    renderDraft(latestDraft);
  }
}

async function uploadFiles() {
  const files = fileInput.files;
  if (!files || files.length === 0) return;

  const formData = new FormData();
  Array.from(files).forEach((file) => formData.append('files', file));
  formData.append('sessionId', sessionId);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });

  const data = await response.json();
  if (data.sessionId && data.sessionId !== sessionId) {
    sessionId = data.sessionId;
    localStorage.setItem('sessionId', sessionId);
  }

  if (data.files && data.files.length) {
    data.files.forEach((file) => {
      const li = document.createElement('li');
      li.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
      fileList.appendChild(li);
    });
  }

  appendMessage('assistant', data.message || '文件上传完成。');
  fileInput.value = '';
}

function clearChat() {
  chatList.innerHTML = '';
  appendMessage('assistant', '对话已清空，可以重新描述需求。');
}

function setupVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    voiceBtn.textContent = '浏览器不支持语音';
    voiceBtn.disabled = true;
    return;
  }

  const recognizer = new SpeechRecognition();
  recognizer.lang = 'zh-CN';
  recognizer.continuous = false;
  recognizer.interimResults = false;

  voiceBtn.addEventListener('click', () => {
    recognizer.start();
    voiceBtn.textContent = '聆听中...';
  });

  recognizer.addEventListener('result', (event) => {
    const transcript = event.results[0][0].transcript;
    chatInput.value = `${chatInput.value}\n${transcript}`.trim();
  });

  recognizer.addEventListener('end', () => {
    voiceBtn.textContent = '语音输入';
  });
}

exportBtn.addEventListener('click', () => {
  if (!latestDraft) {
    appendMessage('assistant', '请先生成课件初稿，再导出。');
    return;
  }
  appendMessage('assistant', '导出功能为占位，后续将生成 .pptx/.docx 文件。');
});

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

clearBtn.addEventListener('click', clearChat);
uploadBtn.addEventListener('click', uploadFiles);

appendMessage('assistant', '你好！请描述你的教学目标和需求，我会逐步澄清并生成课件初稿。');
updateStatus();
setupVoiceInput();
renderDraft(null);
