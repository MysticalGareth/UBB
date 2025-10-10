const shouldLog = (): boolean => {
  if (process.env.UBB_SILENT === '1') return false;
  if (process.env.NODE_ENV === 'test') return false;
  return true;
};

export const logInfo = (...args: unknown[]): void => {
  if (shouldLog()) console.log(...args);
};

export const logWarn = (...args: unknown[]): void => {
  if (shouldLog()) console.warn(...args);
};

export const logError = (...args: unknown[]): void => {
  if (shouldLog()) console.error(...args);
};


