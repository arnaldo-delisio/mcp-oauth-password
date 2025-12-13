/**
 * OAuth 2.1 Authorization Code Flow with PKCE - Type Definitions
 */

import type { Request } from 'express';
import type { Pool } from 'pg';

export interface AuthorizationRequest {
  client_id: string;
  redirect_uri: string;
  response_type: string; // Should be 'code'
  code_challenge: string;
  code_challenge_method: string; // Should be 'S256'
  state?: string;
  scope?: string;
}

export interface TokenRequest {
  grant_type: string; // Should be 'authorization_code'
  code: string;
  redirect_uri: string;
  code_verifier: string;
  client_id: string;
}

export interface StoredAuthCode {
  code: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope?: string;
  createdAt: number; // Unix timestamp
  expiresAt: number; // Unix timestamp
}

export interface OAuthError {
  error: string;
  error_description?: string;
  error_uri?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}

/**
 * RFC 7591: Dynamic Client Registration
 */
export interface ClientRegistrationRequest {
  client_name?: string;
  redirect_uris?: string[];
  token_endpoint_auth_method?: string;
  grant_types?: string[];
  response_types?: string[];
  scope?: string;
  contacts?: string[];
  logo_uri?: string;
  client_uri?: string;
  policy_uri?: string;
  tos_uri?: string;
}

export interface RegisteredClient {
  client_id: string;
  client_secret: string;
  client_name?: string;
  redirect_uris: string[];
  token_endpoint_auth_method: string;
  grant_types: string[];
  response_types: string[];
  scope?: string;
  createdAt: number;
}

export interface ClientRegistrationResponse {
  client_id: string;
  client_secret: string;
  client_id_issued_at?: number;
  client_secret_expires_at?: number;
  client_name?: string;
  redirect_uris?: string[];
  token_endpoint_auth_method?: string;
  grant_types?: string[];
  response_types?: string[];
  scope?: string;
}

/**
 * Configuration for mcp-oauth-password
 */
export interface OAuthConfig {
  /** Server URL (e.g., 'https://your-server.com') */
  serverUrl: string;

  /** PostgreSQL connection string or Pool instance */
  database: string | Pool;

  /** Static OAuth client ID (pre-registered) */
  clientId: string;

  /** Static OAuth client secret (pre-registered) */
  clientSecret: string;

  /** Bcrypt hash of the login password */
  passwordHash: string;

  /** Session secret for cookie signing */
  sessionSecret: string;

  /** API key returned as access token */
  apiKey: string;

  /** Session cookie name (default: 'mcp_session') */
  sessionName?: string;

  /** Session max age in milliseconds (default: 30 days) */
  sessionMaxAge?: number;

  /** Allowed redirect URI prefixes (default: ['https://claude.ai/', 'http://localhost:']) */
  allowedRedirectPrefixes?: string[];

  /** OAuth scopes supported (default: ['mcp:tools:*', 'mcp:resources:*', 'mcp:prompts:*']) */
  scopes?: string[];

  /** Custom login view path (optional, uses default if not provided) */
  loginViewPath?: string;
}

/**
 * Extend express-session types
 */
declare module 'express-session' {
  interface SessionData {
    authenticated?: boolean;
  }
}

/**
 * Express Request with session
 */
export interface AuthenticatedRequest extends Request {
  session: {
    authenticated?: boolean;
  } & Request['session'];
}
