function readQueue(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch (err) {
    console.error('Failed to read offline queue', err);
    return [];
  }
}

function writeQueue(key, values) {
  try {
    if (values.length) {
      localStorage.setItem(key, JSON.stringify(values));
    } else {
      localStorage.removeItem(key);
    }
  } catch (err) {
    console.error('Failed to persist offline queue', err);
  }
}

export function addQueuedItem(key, item) {
 const queue = readQueue(key);
  queue.push(item);
   writeQueue(key, queue);
}

export function flushQueue(key, handler) {
  const queue = readQueue(key);
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
    writeQueue(key, remaining);
  };
  process();
}

export function registerFlushOnOnline(key, handler) {
  const listener = () => {
    if (navigator.onLine) flushQueue(key, handler);
  };
  window.addEventListener('online', listener);
   window.addEventListener('visibilitychange', listener);
  // attempt immediately if online
  if (navigator.onLine) flushQueue(key, handler);
 return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('visibilitychange', listener);
  };
}
