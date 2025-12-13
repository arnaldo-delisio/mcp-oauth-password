# mcp-oauth-password

Simple password-based OAuth 2.1 implementation for MCP (Model Context Protocol) servers. **No third-party OAuth providers required** - just a password and PostgreSQL.

## Why?

Most MCP OAuth implementations require complex third-party providers (GitHub, Keycloak, Auth0). This package provides:

- ✅ **Simple password authentication** - No GitHub/Google/Auth0 required
- ✅ **OAuth 2.1 compliant** - Authorization Code Flow with PKCE
- ✅ **Secure for personal use** - Persistent sessions, secure cookies, bcrypt
- ✅ **Works on Claude mobile** - Tested and working
- ✅ **Self-contained** - Just Node.js + PostgreSQL

Perfect for personal MCP servers and self-hosted tools.

## Security & Production Readiness

**✅ Current Version (0.2.x):** Suitable for **personal/self-hosted** MCP servers with enhanced security

**Roadmap to Production:**
- **v0.2.0** ✅ - Rate limiting + audit logging
- **v0.3.0** (Coming Soon) - Token expiration + refresh tokens
- **v1.0.0** - Production-ready with multi-user support

**Security Features (v0.2.0):**
- ✅ OAuth 2.1 with PKCE
- ✅ Bcrypt password hashing (10 rounds)
- ✅ Secure session cookies (httpOnly, secure, sameSite)
- ✅ PostgreSQL session storage (persistent)
- ✅ Short-lived auth codes (10 min, single-use)
- ✅ Redirect URI validation
- ✅ HTTPS enforcement in production
- ✅ **NEW:** Rate limiting (5 login attempts per 15 min)
- ✅ **NEW:** Audit logging (tracks all auth events)

**Still Missing for Production:**
- ❌ Token expiration + refresh tokens
- ❌ Multi-user support
- ❌ Account lockout after failed attempts

For production use, wait for v1.0 or add token expiration yourself.

## Installation

```bash
npm install mcp-oauth-password
```

## Quick Start

```typescript
import express from 'express';
import { setupOAuth, createAuthMiddleware } from 'mcp-oauth-password';

const app = express();

// 1. Setup OAuth endpoints
setupOAuth(app, {
  serverUrl: 'https://your-server.com',
  database: process.env.DATABASE_URL,
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  passwordHash: '$2b$10$...', // bcrypt hash of your password
  sessionSecret: 'random-secret-key',
  apiKey: 'your-api-key',
});

// 2. Configure EJS for login view
app.set('view engine', 'ejs');
app.set('views', './node_modules/mcp-oauth-password/views');

// 3. Protect your MCP endpoints
const authMiddleware = createAuthMiddleware({
  serverUrl: 'https://your-server.com',
  apiKey: 'your-api-key',
});

app.post('/mcp', authMiddleware, (req, res) => {
  // Your MCP handler
});

app.listen(3000);
```

## Configuration

### OAuthConfig

```typescript
interface OAuthConfig {
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

  /** Session max age in ms (default: 30 days) */
  sessionMaxAge?: number;

  /** Allowed redirect URI prefixes */
  allowedRedirectPrefixes?: string[];

  /** OAuth scopes supported */
  scopes?: string[];

  /** Custom login view path (optional) */
  loginViewPath?: string;
}
```

## Generating Credentials

### Password Hash (bcrypt)

```bash
npm install -g bcrypt-cli
bcrypt-cli hash "your-password" 10
```

Or in Node.js:

```typescript
import bcrypt from 'bcrypt';
const hash = await bcrypt.hash('your-password', 10);
console.log(hash); // Use this as passwordHash
```

### Client ID & Secret

```typescript
import { randomBytes } from 'crypto';

const clientId = `mcp-${randomBytes(8).toString('hex')}`;
const clientSecret = randomBytes(32).toString('base64url');
const sessionSecret = randomBytes(32).toString('hex');
const apiKey = randomBytes(32).toString('base64url');
```

## Database Setup

The package automatically creates required tables:

- `authorization_codes` - Temporary auth codes (10-min TTL)
- `oauth_clients` - Registered OAuth clients
- `session` - Persistent sessions
- `auth_logs` - Audit log for security monitoring **(v0.2.0+)**

Just provide a PostgreSQL connection string.

## New in v0.2.0

### Rate Limiting

Automatic rate limiting protects against brute force attacks:
- **Login:** 5 attempts per 15 minutes
- **Token:** 10 attempts per 15 minutes
- **Authorize:** 20 attempts per 15 minutes

Rate limiters are automatically applied. You can customize them:

```typescript
import { setupOAuth, loginRateLimiter } from 'mcp-oauth-password';
import rateLimit from 'express-rate-limit';

// Use default rate limiting
setupOAuth(app, config);

// OR customize the login rate limiter
const customLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3, // 3 attempts
});

app.post('/login', customLimiter, ...);
```

### Audit Logging

All authentication events are automatically logged to the `auth_logs` table:

```sql
SELECT * FROM auth_logs
WHERE event IN ('login_success', 'login_failure', 'token_exchange')
ORDER BY created_at DESC
LIMIT 100;
```

Logged events:
- `login_success` / `login_failure` - Password login attempts
- `token_exchange` / `token_failure` - OAuth token exchanges
- `authorize_request` - Authorization requests
- `client_registration` - New OAuth client registrations

Each log includes: IP address, user agent, client ID, success/failure, error message, and timestamp.

## Claude Mobile Configuration

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "your-server": {
      "type": "http",
      "url": "https://your-server.com/mcp",
      "oauth": {
        "clientId": "your-client-id",
        "clientSecret": "your-client-secret"
      }
    }
  }
}
```

## API Reference

### `setupOAuth(app, config)`

Sets up OAuth 2.1 endpoints on an Express app.

**Returns:** `{ pool, sessionMiddleware }`

**Endpoints created:**
- `GET /.well-known/oauth-protected-resource` - RFC 9728 metadata
- `GET /.well-known/oauth-authorization-server` - RFC 8414 metadata
- `GET /oauth/authorize` - Authorization endpoint
- `POST /oauth/token` - Token exchange endpoint
- `POST /login` - Password login handler
- `POST /oauth/register` - RFC 7591 dynamic client registration

### `createAuthMiddleware(config)`

Creates Express middleware to protect endpoints with Bearer token authentication.

**Usage:**

```typescript
const authMiddleware = createAuthMiddleware(config);
app.post('/mcp', authMiddleware, handler);
```

## Custom Login View

Create your own `login.ejs` and point to it:

```typescript
setupOAuth(app, {
  // ...
  loginViewPath: './views/custom-login.ejs'
});

app.set('view engine', 'ejs');
app.set('views', './views');
```

The login view receives:
- `error` - Error message (if any)
- `originalUrl` - URL to redirect after login

## Environment Variables Example

```bash
SERVER_URL=https://your-server.com
DATABASE_URL=postgresql://user:pass@localhost/dbname
OAUTH_CLIENT_ID=mcp-a8ff0614d0153f07
OAUTH_CLIENT_SECRET=cqlJlRhOpGE3n5ZOeW_PYERAY75-5lDqNoDMr3v1D7Y
OAUTH_PASSWORD_HASH=$2b$10$N9qo8uLOickgx2ZMRZoMye...
SESSION_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
API_KEY=your-api-key-here
```

## Full Example

See `/example` directory for a complete MCP server implementation.

## Security Features

- ✅ OAuth 2.1 with PKCE (Proof Key for Code Exchange)
- ✅ Bcrypt password hashing
- ✅ Secure session cookies (httpOnly, secure, sameSite)
- ✅ PostgreSQL session storage (survives restarts)
- ✅ Authorization code expiration (10 minutes)
- ✅ Dynamic client registration (RFC 7591)
- ✅ Bearer token authentication

## Comparison with Alternatives

| Feature | mcp-oauth-password | mcp-oauth-gateway | Others |
|---------|-------------------|-------------------|---------|
| Third-party OAuth | ❌ None | ✅ GitHub | ✅ GitHub/Auth0/etc |
| Setup complexity | ⭐ Simple | ⭐⭐⭐ Complex | ⭐⭐⭐ Complex |
| Dependencies | Node.js + PostgreSQL | Traefik + Redis + Docker | Varies |
| Production ready | ✅ Yes | ❌ Reference only | ✅ Yes |
| Mobile support | ✅ Tested | ❓ Unknown | ✅ Yes |

## License

MIT

## Author

Arnaldo Delisio

## Contributing

Issues and PRs welcome at https://github.com/arnaldo-delisio/mcp-oauth-password
