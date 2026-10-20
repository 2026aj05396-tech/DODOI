# ADR 0006: Tailwind CSS and shadcn/ui

**Status:** Accepted · **Date:** 2026-10-20

## Context
dodoi has a custom, editorial, pattern-rich visual identity from Claude Design, and must stay light on mobile.

## Decision
Style with Tailwind CSS 4 using design tokens defined once in `src/styles/tokens.css`; build primitives from shadcn/ui (Radix) copied into `src/components/ui` and restyled with tokens. Typeface: DM Sans via `next/font`.

## Alternatives considered
MUI (Material look needs heavy theming; runtime CSS-in-JS adds client JavaScript); CSS Modules (no ready accessible primitives).

## Consequences
No raw colour values or arbitrary Tailwind values in components; new visual values become tokens first (CODE_QUALITY §11).
