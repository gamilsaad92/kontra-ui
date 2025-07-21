export function addQueuedItem(key, item) {
  const queue = JSON.parse(localStorage.getItem(key) || '[]');
  queue.push(item);
  localStorage.setItem(key, JSON.stringify(queue));
}

export function flushQueue(key, handler) {
  const queue = JSON.parse(localStorage.getItem(key) || '[]');
  if (!queue.length) return;
  const remaining = [];
  const process = async () => {
    for (const item of queue) {
      try {
        await handler(item);
      } catch (err) {
        console.error('Failed to process queued item', err);
        remaining.push(item);
      }
    }
    if (remaining.length) {
      localStorage.setItem(key, JSON.stringify(remaining));
    } else {
      localStorage.removeItem(key);
    }
  };
  process();
}

export function registerFlushOnOnline(key, handler) {
  const listener = () => {
    if (navigator.onLine) flushQueue(key, handler);
  };
  window.addEventListener('online', listener);
  // attempt immediately if online
  if (navigator.onLine) flushQueue(key, handler);
  return () => window.removeEventListener('online', listener);
}
