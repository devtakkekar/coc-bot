/**
 * Sequential API queue with exponential backoff.
 * Prevents simultaneous API calls and handles 429/503 gracefully.
 */
import logger from './logger.js';

let queue = Promise.resolve();

export function enqueue(fn) {
  queue = queue.then(() => runWithBackoff(fn));
  return queue;
}

async function runWithBackoff(fn, attempt = 0) {
  try {
    return await fn();
  } catch (e) {
    const status = parseInt(e.message?.match(/\d{3}/)?.[0]);
    if ((status === 429 || status === 503) && attempt < 4) {
      const delay = Math.min(1000 * 2 ** attempt, 30_000);
      logger.warn(`[API] Rate limited (${status}), retrying in ${delay}ms (attempt ${attempt + 1})`);
      await sleep(delay);
      return runWithBackoff(fn, attempt + 1);
    }
    throw e;
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
