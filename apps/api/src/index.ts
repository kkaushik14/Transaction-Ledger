/** Reusable Express application factory; never imports startup or diagnostic executables. Explicit exports define this folder's public boundary. */
export { createApp } from './app.js';
export type { AppDependencies } from './app.js';
