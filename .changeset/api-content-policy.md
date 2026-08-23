---
'@kernhq/kernel': minor
---

Every service now sends a content security policy.

`createHttpServer` registered helmet with `contentSecurityPolicy: false`, so nothing constrained what
a response could load or who could frame it. A JSON API renders nothing, so it now says exactly
that — `default-src 'none'`, plus `frame-ancestors`, `base-uri` and `form-action` set to `'none'`.

This is a behaviour change for any service that serves HTML from a kernel-hosted route: it will be
blocked unless it sets its own header. Core's `/api/docs` is the one such route today and does.
