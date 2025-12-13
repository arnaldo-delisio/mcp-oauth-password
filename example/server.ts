/**
 * Example MCP server using mcp-oauth-password
 *
 * This demonstrates how to use the package to add OAuth 2.1
 * password authentication to your MCP server.
 */

import express, { Request, Response } from 'express';
import { setupOAuth, createAuthMiddleware } from '../src/index.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3456;

// Parse JSON and form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust proxy (required for Railway/Render/etc)
app.set('trust proxy', 1);

// Configure EJS for login view
app.set('view engine', 'ejs');
app.set('views', '../views'); // Use the package's default login view

// Setup OAuth 2.1 endpoints
const { pool } = setupOAuth(app, {
  serverUrl: process.env.SERVER_URL || 'http://localhost:3456',
  database: process.env.DATABASE_URL || 'postgresql://localhost/mcp_oauth_example',
  clientId: process.env.OAUTH_CLIENT_ID || 'example-client-id',
  clientSecret: process.env.OAUTH_CLIENT_SECRET || 'example-client-secret',
  passwordHash: process.env.OAUTH_PASSWORD_HASH || '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', // "password"
  sessionSecret: process.env.SESSION_SECRET || 'example-session-secret',
  apiKey: process.env.API_KEY || 'example-api-key',
});

// Create auth middleware for protecting MCP endpoints
const authMiddleware = createAuthMiddleware({
  serverUrl: process.env.SERVER_URL || 'http://localhost:3456',
  database: pool,
  clientId: process.env.OAUTH_CLIENT_ID || 'example-client-id',
  clientSecret: process.env.OAUTH_CLIENT_SECRET || 'example-client-secret',
  passwordHash: process.env.OAUTH_PASSWORD_HASH || '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  sessionSecret: process.env.SESSION_SECRET || 'example-session-secret',
  apiKey: process.env.API_KEY || 'example-api-key',
});

// Example MCP endpoint (protected by OAuth)
app.post('/mcp', authMiddleware, (req: Request, res: Response) => {
  // Handle MCP JSON-RPC requests here
  const { method, params } = req.body;

  if (method === 'tools/list') {
    res.json({
      jsonrpc: '2.0',
      result: {
        tools: [
          {
            name: 'example_tool',
            description: 'An example tool',
            inputSchema: {
              type: 'object',
              properties: {
                message: { type: 'string' }
              }
            }
          }
        ]
      },
      id: req.body.id
    });
    return;
  }

  res.json({
    jsonrpc: '2.0',
    error: { code: -32601, message: 'Method not found' },
    id: req.body.id
  });
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Documentation endpoint
app.get('/docs', (_req: Request, res: Response) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Example MCP Server</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    h1 { color: #333; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
    pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>Example MCP Server</h1>
  <p>This server demonstrates <code>mcp-oauth-password</code> - simple password-based OAuth for MCP.</p>

  <h2>Features</h2>
  <ul>
    <li>OAuth 2.1 with PKCE</li>
    <li>Password authentication (no GitHub/Auth0 required)</li>
    <li>Persistent sessions in PostgreSQL</li>
    <li>Works with Claude mobile</li>
  </ul>

  <h2>Endpoints</h2>
  <ul>
    <li><code>GET /.well-known/oauth-protected-resource</code></li>
    <li><code>GET /.well-known/oauth-authorization-server</code></li>
    <li><code>GET /oauth/authorize</code></li>
    <li><code>POST /oauth/token</code></li>
    <li><code>POST /login</code></li>
    <li><code>POST /oauth/register</code></li>
    <li><code>POST /mcp</code> (protected)</li>
  </ul>

  <h2>Test Login</h2>
  <p>Default password: <code>password</code></p>
  <p><a href="/oauth/authorize?client_id=example-client-id&redirect_uri=http://localhost:3456/callback&response_type=code&code_challenge=test&code_challenge_method=S256">Try authorization flow</a></p>
</body>
</html>
  `);
});

// Start server
app.listen(PORT, () => {
  console.log(`Example MCP server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Documentation: http://localhost:${PORT}/docs`);
  console.log(`\nDefault password: "password"`);
});
