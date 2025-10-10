/**
 * Buffer polyfill for browser environment
 * This file is injected by esbuild to provide Buffer support in the browser
 */

import { Buffer } from 'buffer';

// Make Buffer available globally
window.Buffer = Buffer;
export { Buffer };
