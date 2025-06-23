function loggingMiddleware() {
  return function log(route, level, service, message, meta) {
    // Example log object
    const logObj = {
      LogId: Math.random().toString(36).substring(2, 10),
      route,
      level,
      service,
      message,
      meta,
      timestamp: new Date().toISOString(),
    };
    // You can log to console or a file here
    console.log(logObj);
    return logObj;
  };
}

module.exports = loggingMiddleware;
