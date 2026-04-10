function writeSseEvent(res, event, data = {}) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function initSse(res) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      writeSseEvent(res, 'ping', { ts: Date.now() });
    }
  }, 15000);

  const cleanup = () => clearInterval(heartbeat);
  res.on('close', cleanup);
  return cleanup;
}

function endSse(res, cleanup, payload = { ok: true }) {
  cleanup?.();
  if (!res.writableEnded) {
    writeSseEvent(res, 'done', payload);
    res.end();
  }
}

function writeSseErrorAndEnd(res, cleanup, data = {}) {
  writeSseEvent(res, 'error', data);
  return endSse(res, cleanup, {
    ok: false,
    error: data.error || 'stream_failed'
  });
}

module.exports = {
  initSse,
  writeSseEvent,
  endSse,
  writeSseErrorAndEnd
};
