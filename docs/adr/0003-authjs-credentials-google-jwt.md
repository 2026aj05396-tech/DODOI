# ADR 0003: Auth.js with Credentials and Google, JWT sessions

**Status:** Accepted · **Date:** 2026-10-20

## Context
Users sign up with email + password or Google. The product owner chose Auth.js. Auth.js's Credentials provider does not support database sessions.

## Decision
Use Auth.js with Credentials and Google providers and JWT sessions. (P1-04 update: Auth.js v5 `5.0.0-beta.32` pinned; an own minimal adapter replaces `@auth/prisma-adapter`, which does not support Prisma 7, and the `signIn` callback creates/links Google users.) Server-side revocation uses a `sessionVersion` counter on User, checked in the JWT callback. Registration, email verification, password reset and the 18+ date-of-birth check are custom Route Handlers. Google sign-in links automatically to an existing account with the same email; if that account was never verified, its password is removed.

## Alternatives considered
Database sessions (not supported with Credentials); managed auth such as Clerk (paid at scale, data outside our database).

## Consequences
Every request that needs a fresh revocation check reads `sessionVersion`. Password-reset and verification tokens are stored hashed.
