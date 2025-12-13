/**
 * OAuth 2.1 Authorization Endpoint
 *
 * GET /oauth/authorize
 *
 * Handles authorization requests:
 * 1. Validate query parameters
 * 2. Check redirect_uri whitelist
 * 3. If authenticated → auto-approve and redirect
 * 4. If not authenticated → show login form
 */

import type { Request, Response } from 'express';
import type { Pool } from 'pg';
import { storeAuthCode } from './storage.js';
import { validateCodeChallenge } from './pkce.js';
import { isValidClientId, getClient } from './clients.js';
import type { AuthorizationRequest, OAuthError, OAuthConfig } from '../types/index.js';

/**
 * Validate redirect_uri against whitelist
 */
function isValidRedirectUri(redirectUri: string, allowedPrefixes: string[]): boolean {
  return allowedPrefixes.some((prefix) => redirectUri.startsWith(prefix));
}

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
 * Generate authorization code and redirect to client
 */
async function approveAndRedirect(
  res: Response,
  pool: Pool,
  authReq: AuthorizationRequest
): Promise<void> {
  // Generate and store authorization code
  const code = await storeAuthCode(
    pool,
    authReq.client_id,
    authReq.redirect_uri,
    authReq.code_challenge,
    authReq.code_challenge_method,
    authReq.scope
  );

  // Build redirect URL
  const redirectUrl = new URL(authReq.redirect_uri);
  redirectUrl.searchParams.set('code', code);

  if (authReq.state) {
    redirectUrl.searchParams.set('state', authReq.state);
  }

  console.log('[OAuth Authorize] Generated authorization code:', code);
  console.log('[OAuth Authorize] Redirect URL:', redirectUrl.toString());
  res.redirect(redirectUrl.toString());
}

/**
 * Create authorization handler
 */
export function createAuthorizeHandler(config: OAuthConfig, pool: Pool) {
  return async function handleAuthorize(req: Request, res: Response): Promise<void> {
    try {
      // Extract query parameters
      const {
        client_id,
        redirect_uri,
        response_type,
        code_challenge,
        code_challenge_method,
        state,
        scope,
      } = req.query;

      console.log('[OAuth Authorize] Request received:', {
        client_id,
        redirect_uri,
        response_type,
        code_challenge_method,
        state,
        scope,
        authenticated: req.session.authenticated,
      });

      // Validate required parameters
      if (!client_id || typeof client_id !== 'string') {
        sendError(res, 'invalid_request', 'Missing or invalid client_id');
        return;
      }

      if (!redirect_uri || typeof redirect_uri !== 'string') {
        sendError(res, 'invalid_request', 'Missing or invalid redirect_uri');
        return;
      }

      if (!response_type || response_type !== 'code') {
        sendError(res, 'unsupported_response_type', 'Only "code" response_type is supported');
        return;
      }

      if (!code_challenge || typeof code_challenge !== 'string') {
        sendError(res, 'invalid_request', 'Missing or invalid code_challenge');
        return;
      }

      if (!code_challenge_method || code_challenge_method !== 'S256') {
        sendError(res, 'invalid_request', 'Only "S256" code_challenge_method is supported');
        return;
      }

      // Validate code_challenge format
      if (!validateCodeChallenge(code_challenge)) {
        sendError(res, 'invalid_request', 'Invalid code_challenge format');
        return;
      }

      // Validate client_id (supports both static and dynamic clients)
      const clientIdValid = await isValidClientId(pool, client_id, config.clientId);
      if (!clientIdValid) {
        sendError(res, 'unauthorized_client', 'Invalid client_id');
        return;
      }

      // Validate redirect_uri
      // For static client: check against whitelist
      // For dynamic client: check against registered redirect URIs
      let redirectUriValid = false;

      const allowedPrefixes = config.allowedRedirectPrefixes || [
        'https://claude.ai/',
        'http://localhost:',
      ];

      if (client_id === config.clientId) {
        // Static client: use whitelist
        redirectUriValid = isValidRedirectUri(redirect_uri, allowedPrefixes);
      } else {
        // Dynamic client: check registered redirect URIs
        const client = await getClient(pool, client_id);
        if (client) {
          redirectUriValid = client.redirect_uris.includes(redirect_uri);
        }
      }

      if (!redirectUriValid) {
        sendError(res, 'invalid_request', 'Unauthorized redirect_uri');
        return;
      }

      // Build authorization request object
      const authReq: AuthorizationRequest = {
        client_id,
        redirect_uri,
        response_type,
        code_challenge,
        code_challenge_method,
        state: typeof state === 'string' ? state : undefined,
        scope: typeof scope === 'string' ? scope : undefined,
      };

      // Check if user is already authenticated (session cookie)
      if (req.session.authenticated) {
        console.log('[OAuth Authorize] User already authenticated, auto-approving');
        console.log('[OAuth Authorize] Auth request:', JSON.stringify(authReq, null, 2));
        await approveAndRedirect(res, pool, authReq);
        return;
      }

      // User not authenticated → show login form
      console.log('[OAuth Authorize] User not authenticated, showing login form');

      // Encode the current URL to return to after login
      const originalUrl = req.originalUrl;

      res.render('login', {
        error: null,
        originalUrl,
      });
    } catch (error) {
      console.error('[OAuth Authorize] Error:', error);
      sendError(res, 'server_error', 'Internal server error');
    }
  };
}
