/**
 * OAuth 2.1 Token Endpoint
 *
 * POST /oauth/token
 *
 * Handles token exchange:
 * 1. Validate request parameters
 * 2. Verify authorization code exists and is not expired
 * 3. Verify PKCE code_verifier
 * 4. Verify redirect_uri matches original request
 * 5. Delete authorization code (single-use)
 * 6. Return access token
 */

import type { Request, Response } from 'express';
import type { Pool } from 'pg';
import { getAuthCode, deleteAuthCode } from './storage.js';
import { verifyPKCE, validateCodeVerifier } from './pkce.js';
import { validateClient, getClient } from './clients.js';
import { logAuthEvent } from '../utils/audit-log.js';
import type { TokenRequest, OAuthError, TokenResponse, OAuthConfig } from '../types/index.js';

/**
 * Send OAuth error response
 */
function sendError(res: Response, error: string, description?: string): void {
  const errorResponse: OAuthError = {
    error,
    error_description: description,
  };

  res.status(400).json(errorResponse);
}

/**
 * Create token handler
 */
export function createTokenHandler(config: OAuthConfig, pool: Pool) {
  return async function handleToken(req: Request, res: Response): Promise<void> {
    try {
      let {
        grant_type,
        code,
        redirect_uri,
        code_verifier,
        client_id,
        client_secret,
      }: Partial<TokenRequest & { client_secret?: string }> = req.body;

      console.log('[OAuth Token] Request received:', {
        grant_type,
        code: code ? '***' : undefined,
        redirect_uri,
        code_verifier: code_verifier ? '***' : undefined,
        client_id,
        client_secret: client_secret ? '***' : undefined,
      });

      // Validate required parameters
      if (!grant_type || grant_type !== 'authorization_code') {
        sendError(res, 'unsupported_grant_type', 'Only "authorization_code" grant_type is supported');
        return;
      }

      if (!code || typeof code !== 'string') {
        sendError(res, 'invalid_request', 'Missing or invalid code');
        return;
      }

      if (!redirect_uri || typeof redirect_uri !== 'string') {
        sendError(res, 'invalid_request', 'Missing or invalid redirect_uri');
        return;
      }

      if (!code_verifier || typeof code_verifier !== 'string') {
        sendError(res, 'invalid_request', 'Missing or invalid code_verifier');
        return;
      }

      // WORKAROUND: Claude Code SDK doesn't send client_id in token request
      // Extract it from the authorization code record instead
      if (!client_id || typeof client_id !== 'string') {
        console.log('[OAuth Token] WORKAROUND: client_id not provided, extracting from authorization code');
        const tempCode = await getAuthCode(pool, code);
        if (tempCode?.clientId) {
          client_id = tempCode.clientId;
          console.log('[OAuth Token] WORKAROUND: Extracted client_id from auth code:', client_id);
        } else {
          sendError(res, 'invalid_request', 'Missing or invalid client_id');
          return;
        }
      }

      // Get client from database to check auth method
      const client = await getClient(pool, client_id);
      const isStaticClient = client_id === config.clientId;

      // Determine expected auth method
      let authMethod = 'client_secret_post'; // default for static client
      if (client) {
        authMethod = client.token_endpoint_auth_method;
      }

      // Verify client credentials based on auth method
      if (authMethod === 'none') {
        // Public client - no secret required, just validate client_id exists
        if (!client && !isStaticClient) {
          sendError(res, 'invalid_client', 'Invalid client_id');
          return;
        }
      } else {
        // Confidential client - require client_secret
        if (!client_secret || typeof client_secret !== 'string') {
          sendError(res, 'invalid_client', 'Missing or invalid client_secret');
          return;
        }

        const isValid = await validateClient(
          pool,
          client_id,
          client_secret,
          config.clientId,
          config.clientSecret
        );

        if (!isValid) {
          sendError(res, 'invalid_client', 'Invalid client_id or client_secret');
          return;
        }
      }

      // Validate code_verifier format
      if (!validateCodeVerifier(code_verifier)) {
        sendError(res, 'invalid_request', 'Invalid code_verifier format');
        return;
      }

      // Retrieve authorization code
      const storedCode = await getAuthCode(pool, code);

      if (!storedCode) {
        sendError(res, 'invalid_grant', 'Invalid or expired authorization code');
        return;
      }

      // Verify client_id matches
      if (storedCode.clientId !== client_id) {
        deleteAuthCode(pool, code);
        sendError(res, 'invalid_grant', 'client_id mismatch');
        return;
      }

      // Verify redirect_uri matches original request
      if (storedCode.redirectUri !== redirect_uri) {
        deleteAuthCode(pool, code);
        sendError(res, 'invalid_grant', 'redirect_uri mismatch');
        return;
      }

      // Verify PKCE: SHA256(code_verifier) === code_challenge
      const pkceValid = verifyPKCE(code_verifier, storedCode.codeChallenge);

      if (!pkceValid) {
        deleteAuthCode(pool, code);

        // Log failed token exchange
        await logAuthEvent(pool, 'token_failure', req, {
          success: false,
          clientId: client_id,
          errorMessage: 'PKCE verification failed',
        });

        sendError(res, 'invalid_grant', 'PKCE verification failed');
        return;
      }

      // Delete authorization code (single-use)
      deleteAuthCode(pool, code);

      console.log('[OAuth Token] Token exchange successful');

      // Log successful token exchange
      await logAuthEvent(pool, 'token_exchange', req, {
        success: true,
        clientId: client_id,
      });

      // Return access token
      const scopes = config.scopes || ['mcp:tools:*', 'mcp:resources:*', 'mcp:prompts:*'];
      const tokenResponse: TokenResponse = {
        access_token: config.apiKey,
        token_type: 'Bearer',
        scope: storedCode.scope || scopes.join(' '),
      };

      res.json(tokenResponse);
    } catch (error) {
      console.error('[OAuth Token] Error:', error);
      sendError(res, 'server_error', 'Internal server error');
    }
  };
}
