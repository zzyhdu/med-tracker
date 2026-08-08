/**
 * 统一错误处理约定：
 * - 业务代码抛 httpError(status, message)，由 errorMiddleware 兜底输出
 * - 响应体固定为 { error: { message } }，前端 apiClient 依赖该形状
 */
export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function sendError(res, status, message) {
  return res.status(status).json({ error: { message } });
}

export function errorMiddleware(error, _req, res, _next) {
  console.error(error);
  if (res.headersSent) return;
  sendError(res, error.status || 500, error.status ? error.message : 'Internal server error');
}
