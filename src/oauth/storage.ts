/**
 * PostgreSQL Authorization Code Storage
 *
 * Stores authorization codes with 10-minute TTL in database
 */

import { randomBytes } from 'crypto';
import type { Pool } from 'pg';
import type { StoredAuthCode } from '../types/index.js';

const CODE_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generate a cryptographically secure authorization code
 */
export function generateAuthCode(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Store an authorization code with metadata in database
 */
export async function storeAuthCode(
  pool: Pool,
  clientId: string,
  redirectUri: string,
  codeChallenge: string,
  codeChallengeMethod: string,
  scope?: string
): Promise<string> {
  const code = generateAuthCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRATION_MS);

  try {
    await pool.query(
      `INSERT INTO authorization_codes
        (code, client_id, redirect_uri, code_challenge, code_challenge_method, scope, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [code, clientId, redirectUri, codeChallenge, codeChallengeMethod, scope, expiresAt]
    );

    console.log('[OAuth Storage] Authorization code stored in database');
    return code;
  } catch (error) {
    console.error('[OAuth Storage] Failed to store authorization code:', error);
    throw new Error('Failed to store authorization code');
  }
}

/**
 * Retrieve an authorization code from database
 * Returns null if code doesn't exist or is expired
 */
export async function getAuthCode(pool: Pool, code: string): Promise<StoredAuthCode | null> {
  try {
    const result = await pool.query(
      `SELECT * FROM authorization_codes
       WHERE code = $1 AND expires_at > NOW()`,
      [code]
    );

    if (result.rows.length === 0) {
      console.log('[OAuth Storage] Authorization code not found or expired');
      return null;
    }

    const row = result.rows[0];
    const storedCode: StoredAuthCode = {
      code: row.code,
      clientId: row.client_id,
      redirectUri: row.redirect_uri,
      codeChallenge: row.code_challenge,
      codeChallengeMethod: row.code_challenge_method,
      scope: row.scope,
      createdAt: new Date(row.created_at).getTime(),
      expiresAt: new Date(row.expires_at).getTime(),
    };

    console.log('[OAuth Storage] Authorization code retrieved from database');
    return storedCode;
  } catch (error) {
    console.error('[OAuth Storage] Failed to retrieve authorization code:', error);
    return null;
  }
}

/**
 * Delete an authorization code (single-use)
 */
export async function deleteAuthCode(pool: Pool, code: string): Promise<void> {
  try {
    await pool.query('DELETE FROM authorization_codes WHERE code = $1', [code]);
    console.log('[OAuth Storage] Authorization code deleted from database');
  } catch (error) {
    console.error('[OAuth Storage] Failed to delete authorization code:', error);
  }
}
