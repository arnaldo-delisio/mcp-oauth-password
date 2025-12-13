/**
 * Dynamic Client Registration Storage (RFC 7591)
 *
 * Stores dynamically registered OAuth clients in PostgreSQL
 * Persists across server restarts and deployments
 */

import { randomBytes } from 'crypto';
import type { Pool } from 'pg';
import type { RegisteredClient } from '../types/index.js';

/**
 * Generate a client ID (RFC 7591 doesn't specify format)
 */
export function generateClientId(): string {
  // Format: mcp-client-<random>
  return `mcp-client-${randomBytes(16).toString('base64url')}`;
}

/**
 * Generate a client secret
 */
export function generateClientSecret(): string {
  // 32 bytes = 256 bits of entropy
  return randomBytes(32).toString('base64url');
}

/**
 * Register a new OAuth client in the database
 */
export async function registerClient(
  pool: Pool,
  clientName: string | undefined,
  redirectUris: string[],
  tokenEndpointAuthMethod: string,
  grantTypes: string[],
  responseTypes: string[],
  scope?: string
): Promise<RegisteredClient> {
  const clientId = generateClientId();
  const clientSecret = generateClientSecret();

  try {
    await pool.query(
      `INSERT INTO oauth_clients
        (client_id, client_secret, client_name, redirect_uris, token_endpoint_auth_method, grant_types, response_types, scope)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        clientId,
        clientSecret,
        clientName,
        redirectUris,
        tokenEndpointAuthMethod,
        grantTypes,
        responseTypes,
        scope,
      ]
    );

    console.log(`[OAuth Clients] Registered new client in database: ${clientId} (${clientName || 'unnamed'})`);

    const client: RegisteredClient = {
      client_id: clientId,
      client_secret: clientSecret,
      client_name: clientName,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: tokenEndpointAuthMethod,
      grant_types: grantTypes,
      response_types: responseTypes,
      scope,
      createdAt: Date.now(),
    };

    return client;
  } catch (error) {
    console.error('[OAuth Clients] Failed to register client:', error);
    throw new Error('Failed to register OAuth client');
  }
}

/**
 * Get a registered client by ID from the database
 */
export async function getClient(pool: Pool, clientId: string): Promise<RegisteredClient | undefined> {
  try {
    const result = await pool.query(
      'SELECT * FROM oauth_clients WHERE client_id = $1',
      [clientId]
    );

    if (result.rows.length === 0) {
      console.log(`[OAuth Clients] Client ${clientId}: NOT FOUND in database`);
      return undefined;
    }

    const row = result.rows[0];
    console.log(`[OAuth Clients] Client ${clientId}: FOUND in database`);

    const client: RegisteredClient = {
      client_id: row.client_id,
      client_secret: row.client_secret,
      client_name: row.client_name,
      redirect_uris: row.redirect_uris,
      token_endpoint_auth_method: row.token_endpoint_auth_method,
      grant_types: row.grant_types,
      response_types: row.response_types,
      scope: row.scope,
      createdAt: new Date(row.created_at).getTime(),
    };

    return client;
  } catch (error) {
    console.error('[OAuth Clients] Failed to get client:', error);
    return undefined;
  }
}

/**
 * Validate client credentials
 * Returns true if credentials are valid (either static or dynamic)
 */
export async function validateClient(
  pool: Pool,
  clientId: string,
  clientSecret: string,
  staticClientId: string,
  staticClientSecret: string
): Promise<boolean> {
  // Check static client (pre-registered)
  if (clientId === staticClientId && clientSecret === staticClientSecret) {
    return true;
  }

  // Check dynamic client from database
  const client = await getClient(pool, clientId);
  if (client && client.client_secret === clientSecret) {
    return true;
  }

  return false;
}

/**
 * Check if a client ID exists (static or dynamic)
 */
export async function isValidClientId(pool: Pool, clientId: string, staticClientId: string): Promise<boolean> {
  if (clientId === staticClientId) {
    return true;
  }

  const client = await getClient(pool, clientId);
  return client !== undefined;
}
