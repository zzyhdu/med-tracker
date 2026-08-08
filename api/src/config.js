export const config = {
  port: Number(process.env.PORT || 3000),
  sessionCookieName: process.env.SESSION_COOKIE_NAME || 'med_tracker_session',
  sessionDays: Number(process.env.SESSION_DAYS || 14),
  isProduction: process.env.NODE_ENV === 'production',
};
