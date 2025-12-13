/**
 * Audit Logging Utilities
 *
 * Logs authentication events for security monitoring
 */

import type { Pool } from 'pg';
import type { Request } from 'express';

export type AuthEvent =
  | 'login_attempt'
  | 'login_success'
  | 'login_failure'
  | 'token_exchange'
  | 'token_failure'
  | 'authorize_request'
  | 'client_registration';

/**
 * Initialize auth_logs table
 */
export async function initAuditLogging(pool: Pool): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS auth_logs (
        id SERIAL PRIMARY KEY,
        event VARCHAR(50) NOT NULL,
        ip VARCHAR(45),
        user_agent TEXT,
        client_id VARCHAR(255),
        success BOOLEAN,
        error_message TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_auth_logs_event ON auth_logs(event);
      CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at ON auth_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_auth_logs_ip ON auth_logs(ip);
      CREATE INDEX IF NOT EXISTS idx_auth_logs_client_id ON auth_logs(client_id);
    `);

    console.log('[Audit Log] auth_logs table initialized');
  } catch (error) {
    console.error('[Audit Log] Failed to initialize auth_logs table:', error);
  }
}

/**
 * Log an authentication event
 */
export async function logAuthEvent(
  pool: Pool,
  event: AuthEvent,
  req: Request,
  options: {
    success: boolean;
    clientId?: string;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  try {
    const ip = req.ip || req.socket.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;

    await pool.query(
      `INSERT INTO auth_logs (event, ip, user_agent, client_id, success, error_message, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        event,
        ip,
        userAgent,
        options.clientId || null,
        options.success,
        options.errorMessage || null,
        options.metadata ? JSON.stringify(options.metadata) : null,
      ]
    );

    const status = options.success ? 'SUCCESS' : 'FAILURE';
    console.log(`[Audit Log] ${event.toUpperCase()} ${status} from ${ip}`);
  } catch (error) {
    // Don't throw - logging failures shouldn't break the application
    console.error('[Audit Log] Failed to log event:', error);
  }
}
