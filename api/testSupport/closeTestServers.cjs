'use strict';

const http = require('node:http');

const cleanupStateKey = Symbol.for('kontra.test.httpServerCleanup');
let cleanupState = http.Server.prototype[cleanupStateKey];
if (!cleanupState) {
  cleanupState = { activeServers: new Set(), observedServers: new WeakSet() };
  Object.defineProperty(http.Server.prototype, cleanupStateKey, { value: cleanupState });

  const originalListen = http.Server.prototype.listen;
  http.Server.prototype.listen = function (...args) {
    cleanupState.activeServers.add(this);
    if (!cleanupState.observedServers.has(this)) {
      cleanupState.observedServers.add(this);
      this.on('close', () => cleanupState.activeServers.delete(this));
    }
    return originalListen.apply(this, args);
  };

  const originalClose = http.Server.prototype.close;
  http.Server.prototype.close = function (callback) {
    if (!this.listening) {
      if (typeof callback === 'function') process.nextTick(callback);
      return this;
    }
    return originalClose.call(this, callback);
  };
}

const activeServers = cleanupState.activeServers;

const activeLongIntervals = new Set();
const originalSetInterval = global.setInterval;
const originalClearInterval = global.clearInterval;
global.setInterval = (callback, delay, ...args) => {
  const timer = originalSetInterval(callback, delay, ...args);
  if (Number(delay) >= 10 * 60 * 1000) {
    activeLongIntervals.add(timer);
    timer.unref?.();
  }
  return timer;
};
global.clearInterval = timer => {
  activeLongIntervals.delete(timer);
  return originalClearInterval(timer);
};

afterAll(async () => {
  for (const timer of activeLongIntervals) originalClearInterval(timer);
  activeLongIntervals.clear();
  const servers = [...activeServers];
  await Promise.all(servers.map(server => new Promise(resolve => {
    server.closeAllConnections?.();
    if (!server.listening) return resolve();
    server.close(() => resolve());
  })));
});
