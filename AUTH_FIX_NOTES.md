# Authentication Fix Notes

## Fixed root cause

The production login endpoint always created the session cookie with `secure: true` because `NODE_ENV=production`.
The current deployment is served directly over HTTP on port 5042, so browsers rejected that cookie. The API returned success, but `/crm` immediately behaved as unauthenticated.

## Changes

- Login and logout cookies now use `AUTH_COOKIE_SECURE` when explicitly configured, otherwise infer HTTP/HTTPS from the request.
- Login now verifies `/api/me` before redirecting, so a rejected cookie produces a visible error instead of appearing stuck.
- Login redirect targets are limited to internal `/crm` paths.
- Removed the middleware redirect based only on cookie presence, preventing `/login` and `/crm` redirect loops for expired or invalid sessions.
- Login page validates the session against PostgreSQL before redirecting an already-authenticated user.
- Password reset database operations now use a single PostgreSQL client transaction.
- Password reset responses no longer reveal whether an email exists.
- Reset tokens are no longer printed in production logs.
- `package-lock.json` no longer contains environment-specific internal registry URLs.

## Current HTTP deployment

Use:

```env
AUTH_COOKIE_SECURE=false
```

After HTTPS is configured, change it to:

```env
AUTH_COOKIE_SECURE=true
```

## Verification

After deployment:

```bash
curl -I http://127.0.0.1:5042/login
curl -s http://127.0.0.1:5042/api/health
pm2 logs pax-retail-crm --lines 100
```

In the browser, confirm that the `crm_session` cookie is created after login and that `/api/me` returns HTTP 200.
