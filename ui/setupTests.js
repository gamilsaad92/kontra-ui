import '@testing-library/jest-dom';

const { randomUUID } = require('node:crypto');
const { TextEncoder, TextDecoder } = require('node:util');
if (typeof globalThis.crypto?.randomUUID !== 'function') {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    configurable: true,
    value: randomUUID,
  });
}
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder;
}
