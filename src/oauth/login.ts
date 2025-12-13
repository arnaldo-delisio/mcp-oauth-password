/**
 * OAuth Login Handler
 *
 * POST /login
 *
 * Handles password verification:
 * 1. Extract password and original_url from form
 * 2. Verify password against bcrypt hash
 * 3. On success: set session cookie and redirect to original_url
 * 4. On failure: re-render login form with error
 */

import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import type { OAuthConfig } from '../types/index.js';

/**
 * Create login handler
 */
export function createLoginHandler(config: OAuthConfig) {
  return async function handleLogin(req: Request, res: Response): Promise<void> {
    try {
      const { password, original_url } = req.body;

      console.log('[OAuth Login] Login attempt received');

      // Validate input
      if (!password || typeof password !== 'string') {
        res.render('login', {
          error: 'Password is required',
          originalUrl: original_url || '/oauth/authorize',
        });
        return;
      }

      if (!original_url || typeof original_url !== 'string') {
        res.status(400).send('Missing original_url');
        return;
      }

      // Check if password hash is configured
      if (!config.passwordHash) {
        console.error('[OAuth Login] passwordHash not configured');
        res.status(500).send('Server configuration error');
        return;
      }

      // Verify password using bcrypt
      const passwordValid = await bcrypt.compare(password, config.passwordHash);

      if (!passwordValid) {
        console.log('[OAuth Login] Invalid password');
        res.render('login', {
          error: 'Invalid password',
          originalUrl: original_url,
        });
        return;
      }

      // Password correct → set session cookie
      req.session.authenticated = true;

      console.log('[OAuth Login] Authentication successful, redirecting to:', original_url);

      // Redirect to original authorization URL
      res.redirect(original_url);
    } catch (error) {
      console.error('[OAuth Login] Error:', error);
      res.status(500).send('Internal server error');
    }
  };
}
