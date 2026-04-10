function extractJsonErrorMessage(text = '') {
  try {
    const parsed = JSON.parse(text);
    return parsed?.error?.message || parsed?.message || '';
  } catch (error) {
    return '';
  }
}

function stripHtml(text = '') {
  return String(text || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractErrorHost(text = '') {
  const titleMatch = String(text || '').match(/<title>\s*([^|<]+?)\s*\|/i);
  if (titleMatch?.[1]) return titleMatch[1].trim();
  const hostMatch = String(text || '').match(/\b(?:api\.)?[a-z0-9.-]+\.[a-z]{2,}\b/i);
  return hostMatch?.[0] || '';
}

function toClientErrorMessage(error, fallback = '请求失败，请稍后重试。') {
  const raw = error instanceof Error ? error.message : String(error || '');
  if (!raw) return fallback;

  if (raw.includes('openai_responses_empty_output')) {
    return '模型服务返回了空结果（接口返回 200 但没有正文），当前上游网关兼容性异常，请稍后重试。';
  }

  if (raw.includes('openai_chat_empty_sse')) {
    return '模型服务返回了空的流式结果，当前上游网关兼容性异常，请稍后重试。';
  }

  const upstreamMatch = raw.match(/openai(?:_chat)?_error_(\d+):\s*([\s\S]*)$/);
  if (upstreamMatch) {
    const status = upstreamMatch[1];
    const body = upstreamMatch[2] || '';
    const jsonMessage = extractJsonErrorMessage(body);
    if (jsonMessage) {
      return `模型服务请求失败（${status}）：${jsonMessage}`;
    }

    if (/<(?:!DOCTYPE|html)\b/i.test(body)) {
      const host = extractErrorHost(body);
      return `模型服务上游暂时不可用（${status}${host ? `，${host}` : ''}），请稍后重试。`;
    }

    const compact = stripHtml(body);
    if (compact) {
      return `模型服务请求失败（${status}）：${compact.slice(0, 200)}`;
    }

    return `模型服务请求失败（${status}），请稍后重试。`;
  }

  return stripHtml(raw) || fallback;
}

module.exports = {
  extractJsonErrorMessage,
  stripHtml,
  extractErrorHost,
  toClientErrorMessage
};
