/**
 * RFC 7591: OAuth 2.0 Dynamic Client Registration Protocol
 *
 * POST /oauth/register
 *
 * Allows clients to register themselves dynamically without pre-configuration.
 * This is required for Claude Code CLI to connect to the MCP server.
 */

import type { Request, Response } from 'express';
import type { Pool } from 'pg';
import { registerClient } from './clients.js';
import type {
  ClientRegistrationRequest,
  ClientRegistrationResponse,
  OAuthError,
} from '../types/index.js';

/**
 * Send OAuth error response (RFC 6749 format)
 */
function sendError(res: Response, error: string, description?: string, status = 400): void {
  const errorResponse: OAuthError = {
    error,
    error_description: description,
  };

  res.status(status).json(errorResponse);
}

/**
 * Create register handler
 */
export function createRegisterHandler(pool: Pool) {
  return async function handleRegister(req: Request, res: Response): Promise<void> {
    try {
      const registrationRequest: ClientRegistrationRequest = req.body;

      console.log('[OAuth Register] Registration request received:', {
        client_name: registrationRequest.client_name,
        redirect_uris: registrationRequest.redirect_uris,
        grant_types: registrationRequest.grant_types,
      });

      // Default values per RFC 7591 Section 2
      const redirectUris = registrationRequest.redirect_uris || [];
      const tokenEndpointAuthMethod =
        registrationRequest.token_endpoint_auth_method || 'client_secret_basic';
      const grantTypes = registrationRequest.grant_types || ['authorization_code'];
      const responseTypes = registrationRequest.response_types || ['code'];

      // Validation: redirect_uris is required for authorization_code grant
      if (grantTypes.includes('authorization_code') && redirectUris.length === 0) {
        sendError(
          res,
          'invalid_redirect_uri',
          'redirect_uris is required for authorization_code grant'
        );
        return;
      }

      // Validate redirect URIs (must be HTTPS or localhost)
      for (const uri of redirectUris) {
        try {
          const url = new URL(uri);
          const isHttps = url.protocol === 'https:';
          const isLocalhost =
            url.hostname === 'localhost' || url.hostname === '127.0.0.1';

          // Allow HTTPS or localhost (for development/testing)
          if (!isHttps && !isLocalhost) {
            sendError(
              res,
              'invalid_redirect_uri',
              `Invalid redirect URI: ${uri}. Must use HTTPS or localhost.`
            );
            return;
          }
        } catch {
          sendError(
            res,
            'invalid_redirect_uri',
            `Malformed redirect URI: ${uri}`
          );
          return;
        }
      }

      // Validate token_endpoint_auth_method
      const supportedAuthMethods = ['client_secret_post', 'client_secret_basic', 'none'];
      if (!supportedAuthMethods.includes(tokenEndpointAuthMethod)) {
        sendError(
          res,
          'invalid_client_metadata',
          `Unsupported token_endpoint_auth_method: ${tokenEndpointAuthMethod}. ` +
            `Supported: ${supportedAuthMethods.join(', ')}`
        );
        return;
      }

      // Validate grant_types
      const supportedGrantTypes = ['authorization_code', 'refresh_token'];
      for (const grantType of grantTypes) {
        if (!supportedGrantTypes.includes(grantType)) {
          sendError(
            res,
            'invalid_client_metadata',
            `Unsupported grant_type: ${grantType}. Supported: ${supportedGrantTypes.join(', ')}`
          );
          return;
        }
      }

      // Validate response_types
      const supportedResponseTypes = ['code'];
      for (const responseType of responseTypes) {
        if (!supportedResponseTypes.includes(responseType)) {
          sendError(
            res,
            'invalid_client_metadata',
            `Unsupported response_type: ${responseType}. Supported: ${supportedResponseTypes.join(', ')}`
          );
          return;
        }
      }

      // Register the client
      const client = await registerClient(
        pool,
        registrationRequest.client_name,
        redirectUris,
        tokenEndpointAuthMethod,
        grantTypes,
        responseTypes,
        registrationRequest.scope
      );

      // Build response per RFC 7591 Section 3.2.1
      const response: ClientRegistrationResponse = {
        client_id: client.client_id,
        client_secret: client.client_secret,
        client_id_issued_at: Math.floor(client.createdAt / 1000), // Unix timestamp in seconds
        client_secret_expires_at: 0, // 0 = never expires
        client_name: client.client_name,
        redirect_uris: client.redirect_uris,
        token_endpoint_auth_method: client.token_endpoint_auth_method,
        grant_types: client.grant_types,
        response_types: client.response_types,
        scope: client.scope,
      };

      console.log('[OAuth Register] Client registered successfully:', client.client_id);

      res.status(201).json(response);
    } catch (error) {
      console.error('[OAuth Register] Error:', error);
      sendError(res, 'server_error', 'Internal server error', 500);
    }
  };
}
