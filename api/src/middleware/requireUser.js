import { sendError } from '../lib/errors.js';
import { clearSessionCookie, getUserFromRequest } from '../lib/session.js';

/**
 * 受保护路由的守门：会话无效时清掉脏 cookie 并返回 401。
 */
export async function requireUser(req, res, next) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      clearSessionCookie(res);
      return sendError(res, 401, 'Authentication required');
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}
