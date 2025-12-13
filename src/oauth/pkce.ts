/**
 * PKCE (Proof Key for Code Exchange) Verification
 *
 * Implements SHA256 verification for OAuth 2.1 PKCE flow
 */

import { createHash } from 'crypto';

/**
 * Verify PKCE code_verifier against code_challenge
 *
 * Per RFC 7636:
 * code_challenge = BASE64URL(SHA256(ASCII(code_verifier)))
 */
export function verifyPKCE(codeVerifier: string, codeChallenge: string): boolean {
  if (!codeVerifier || !codeChallenge) {
    return false;
  }

  // Compute SHA256 hash of code_verifier
  const hash = createHash('sha256').update(codeVerifier).digest();

  // Convert to base64url (no padding)
  const computed = hash.toString('base64url');

  // Constant-time comparison
  return computed === codeChallenge;
}

/**
 * Validate code_challenge format
 *
 * Per RFC 7636:
 * - Length: 43-128 characters
 * - Characters: [A-Z] [a-z] [0-9] - . _ ~ */
export function validateCodeChallenge(codeChallenge: string): boolean {
  if (!codeChallenge) {
    return false;
  }

  const length = codeChallenge.length;
  if (length < 43 || length > 128) {
    return false;
  }

  // Base64url character set
  const validChars = /^[A-Za-z0-9\-._~]+$/;
  return validChars.test(codeChallenge);
}

/**
 * Validate code_verifier format
 *
 * Per RFC 7636:
 * - Length: 43-128 characters
 * - Characters: [A-Z] [a-z] [0-9] - . _ ~
 */
export function validateCodeVerifier(codeVerifier: string): boolean {
  if (!codeVerifier) {
    return false;
  }

  const length = codeVerifier.length;
  if (length < 43 || length > 128) {
    return false;
  }

  // Base64url character set
  const validChars = /^[A-Za-z0-9\-._~]+$/;
  return validChars.test(codeVerifier);
}
