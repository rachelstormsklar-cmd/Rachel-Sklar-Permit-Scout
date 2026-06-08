/**
 * logger.js — Simple timestamped console logger
 */

const LEVEL = process.env.LOG_LEVEL || "info"; // debug | info | warn | error

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

function ts() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function shouldLog(level) {
  return (LEVELS[level] ?? 1) >= (LEVELS[LEVEL] ?? 1);
}

const log = {
  debug: (...args) => shouldLog("debug") && console.debug(`[${ts()}] DEBUG`, ...args),
  info:  (...args) => shouldLog("info")  && console.log(  `[${ts()}] INFO `, ...args),
  warn:  (...args) => shouldLog("warn")  && console.warn( `[${ts()}] WARN `, ...args),
  error: (...args) => shouldLog("error") && console.error(`[${ts()}] ERROR`, ...args),
};

module.exports = log;
