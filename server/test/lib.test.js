const test = require('node:test');
const assert = require('node:assert/strict');

const { toClientErrorMessage } = require('../lib/client-errors');
const { toClientState } = require('../lib/public-state');
const { writeSseErrorAndEnd } = require('../lib/sse');
const { createJsonFieldDeltaTracker } = require('../lib/stream-json');

test('toClientErrorMessage sanitizes JSON upstream errors', () => {
  const message = toClientErrorMessage(new Error('openai_error_400: {"error":{"message":"bad request"}}'));
  assert.equal(message, '模型服务请求失败（400）：bad request');
});

test('toClientErrorMessage sanitizes HTML upstream errors and preserves host context', () => {
  const message = toClientErrorMessage(new Error('openai_chat_error_502: <html><title>Cloudflare | Error</title><body><h1>Bad gateway</h1></body></html>'));
  assert.equal(message, '模型服务上游暂时不可用（502，Cloudflare），请稍后重试。');
});

test('toClientErrorMessage explains empty upstream results clearly', () => {
  const message = toClientErrorMessage(new Error('draft_generation_failed: responses=Error: openai_responses_empty_output; chat=Error: openai_chat_empty_sse'));
  assert.equal(message, '模型服务返回了空结果（接口返回 200 但没有正文），当前上游网关兼容性异常，请稍后重试。');
});

test('createJsonFieldDeltaTracker emits incremental deltas for a JSON string field', () => {
  const deltas = [];
  const tracker = createJsonFieldDeltaTracker('assistantReply', (delta, fullText) => {
    deltas.push({ delta, fullText });
  });

  tracker('{"assistantReply":"你');
  tracker('好，');
  tracker('可以直接生成"}');

  assert.deepEqual(deltas, [
    { delta: '你', fullText: '你' },
    { delta: '好，', fullText: '你好，' },
    { delta: '可以直接生成', fullText: '你好，可以直接生成' }
  ]);
});

test('writeSseErrorAndEnd emits error event before failed done payload', () => {
  const chunks = [];
  const res = {
    writableEnded: false,
    write(chunk) {
      chunks.push(chunk);
    },
    end() {
      this.writableEnded = true;
    }
  };
  let cleaned = false;

  writeSseErrorAndEnd(res, () => {
    cleaned = true;
  }, { error: 'chat_failed', message: '失败' });

  const joined = chunks.join('');
  assert.equal(cleaned, true);
  assert.match(joined, /event: error/);
  assert.match(joined, /event: done/);
  assert.match(joined, /"ok":false/);
  assert.doesNotMatch(joined, /"ok":true/);
  assert.ok(joined.indexOf('event: error') < joined.indexOf('event: done'));
});

test('toClientState strips legacy openmaic state before returning payload', () => {
  const payload = toClientState({
    id: 'session-1',
    fields: { subject: '光合作用' },
    openmaic: { status: 'running', classroomUrl: 'http://127.0.0.1:3001/classroom/1' },
    uploadedFiles: []
  });

  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'openmaic'), false);
  assert.equal(payload.fields.subject, '光合作用');
});
