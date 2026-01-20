/**
 * Rate Limiting Middleware
 *
 * Protects against brute force attacks on authentication endpoints
 */

import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for login endpoint
 * Limits to 5 attempts per 15 minutes per IP
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'too_many_requests',
    error_description: 'Too many login attempts. Please try again in 15 minutes.',
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  // Skip custom keyGenerator - use default (handles IPv6 correctly)
});

/**
 * Rate limiter for token endpoint
 * More lenient than login (10 attempts per 15 minutes)
 */
export const tokenRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: {
    error: 'too_many_requests',
    error_description: 'Too many token requests. Please try again in 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip custom keyGenerator - use default (handles IPv6 correctly)
});

/**
 * Rate limiter for authorization endpoint
 * More lenient (20 attempts per 15 minutes)
 */
export const authorizeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per window
  message: {
    error: 'too_many_requests',
    error_description: 'Too many authorization requests. Please try again in 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip custom keyGenerator - use default (handles IPv6 correctly)
});
