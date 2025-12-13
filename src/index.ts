/**
 * mcp-oauth-password
 *
 * Simple password-based OAuth 2.1 implementation for MCP servers
 * No third-party OAuth providers required
 */

import type { Express, Request, Response } from 'express';
import pg from 'pg';
import type { OAuthConfig } from './types/index.js';
import { createSessionMiddleware } from './middleware/session.js';
import { createAuthorizeHandler } from './oauth/authorize.js';
import { createTokenHandler } from './oauth/token.js';
import { createLoginHandler } from './oauth/login.js';
import { createRegisterHandler } from './oauth/register.js';

const { Pool } = pg;

/**
 * Setup OAuth 2.1 endpoints on an Express app
 */
export function setupOAuth(app: Express, config: OAuthConfig) {
  // Create or use existing database pool
  const pool = typeof config.database === 'string'
    ? new Pool({ connectionString: config.database })
    : config.database;

  // Add session middleware
  const sessionMiddleware = createSessionMiddleware(config, pool);
  app.use(sessionMiddleware);

  // OAuth 2.1 Discovery Endpoints
  app.get('/.well-known/oauth-protected-resource', (_req: Request, res: Response) => {
    const scopes = config.scopes || ['mcp:tools:*', 'mcp:resources:*', 'mcp:prompts:*'];
    res.json({
      resource: config.serverUrl,
      authorization_servers: [config.serverUrl],
      bearer_methods_supported: ['header'],
      resource_documentation: `${config.serverUrl}/docs`,
      scopes_supported: scopes,
    });
  });

  app.get('/.well-known/oauth-authorization-server', (_req: Request, res: Response) => {
    const scopes = config.scopes || ['mcp:tools:*', 'mcp:resources:*', 'mcp:prompts:*'];
    res.json({
      issuer: config.serverUrl,
      authorization_endpoint: `${config.serverUrl}/oauth/authorize`,
      token_endpoint: `${config.serverUrl}/oauth/token`,
      registration_endpoint: `${config.serverUrl}/oauth/register`,
      jwks_uri: `${config.serverUrl}/.well-known/jwks`,
      scopes_supported: scopes,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none'],
      service_documentation: `${config.serverUrl}/docs`,
    });
  });

  // OAuth 2.1 Authorization Endpoints
  app.get('/oauth/authorize', createAuthorizeHandler(config, pool));
  app.post('/oauth/token', createTokenHandler(config, pool));
  app.post('/login', createLoginHandler(config));
  app.post('/oauth/register', createRegisterHandler(pool));

  return { pool, sessionMiddleware };
}

/**
 * Create auth middleware for protecting MCP endpoints
 */
export function createAuthMiddleware(config: OAuthConfig) {
  return function authMiddleware(req: Request, res: Response, next: () => void) {
    const authHeader = req.headers.authorization;

    const wwwAuthenticateHeader = [
      `Bearer realm="${config.serverUrl}"`,
      `resource_metadata="${config.serverUrl}/.well-known/oauth-protected-resource"`,
      `scope="${(config.scopes || ['mcp:tools:*', 'mcp:resources:*']).join(' ')}"`,
    ].join(', ');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res
        .status(401)
        .set('WWW-Authenticate', wwwAuthenticateHeader)
        .json({
          error: 'unauthorized',
          error_description: 'Bearer token required',
        });
    }

    const token = authHeader.slice(7);
    if (token !== config.apiKey) {
      return res
        .status(401)
        .set('WWW-Authenticate', wwwAuthenticateHeader)
        .json({
          error: 'invalid_token',
          error_description: 'Bearer token is invalid or expired',
        });
    }

    next();
  };
}

// Export types
export * from './types/index.js';
