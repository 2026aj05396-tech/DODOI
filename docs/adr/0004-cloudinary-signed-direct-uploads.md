# ADR 0004: Cloudinary for media with signed direct uploads

**Status:** Accepted · **Date:** 2026-10-20

## Context
Posts carry images and short videos that need resizing, format conversion, streaming and CDN delivery, on a free tier.

## Decision
Store and deliver media with Cloudinary. Clients upload directly to Cloudinary using short-lived signatures issued by the server; the server then verifies the asset's metadata against MEDIA-01…05 before creating a `MediaAsset` row. The database stores metadata only.

## Alternatives considered
Supabase Storage (no built-in transformations); Cloudflare R2 (needs a payment method; no transformations); storing files on the app server.

## Consequences
Free-tier quotas must be monitored. Each environment uses its own Cloudinary account or product environment.
