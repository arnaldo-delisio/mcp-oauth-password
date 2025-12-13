/**
 * Express Session Middleware Configuration
 *
 * Configures secure session cookies for OAuth authentication
 * Uses PostgreSQL for persistent session storage
 */

import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import type { Pool } from 'pg';
import type { OAuthConfig } from '../types/index.js';

const PgSession = connectPgSimple(session);

/**
 * Create session middleware with PostgreSQL storage
 */
export function createSessionMiddleware(config: OAuthConfig, pool: Pool) {
  // Detect production environment
  const IS_PRODUCTION = Boolean(
    process.env.NODE_ENV === 'production' ||
    config.serverUrl.includes('railway.app') ||
    config.serverUrl.includes('render.com') ||
    config.serverUrl.includes('fly.io')
  );

  return session({
    store: new PgSession({
      pool,
      tableName: 'session', // PostgreSQL table name
      createTableIfMissing: true, // Auto-create table on first run
      pruneSessionInterval: 60 * 15, // Cleanup expired sessions every 15 minutes
    }),
    name: config.sessionName || 'mcp_session',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    proxy: true, // Trust proxy headers
    cookie: {
      httpOnly: true, // Prevent XSS attacks
      secure: IS_PRODUCTION, // HTTPS only in production
      sameSite: 'lax', // CSRF protection
      maxAge: config.sessionMaxAge || 30 * 24 * 60 * 60 * 1000, // 30 days default
    },
  });
}
