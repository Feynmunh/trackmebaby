# Shared Contracts Guide

This directory defines the contracts used by both the Bun backend and the webview frontend.
Changes here affect multiple modules and should be coordinated carefully.

## Files and Ownership
- `types.ts`: domain types used across backend and frontend
- `rpc-types.ts`: RPC contract between Bun and webview

## Change Guidelines
1. Prefer **additive changes** (new fields/types) over breaking edits.
2. Avoid renaming or removing fields without updating all consumers.
3. Update related RPC handlers and UI types in the same PR.
4. Note contract changes in the PR summary.

## Review Checklist
- [ ] Types updated are backwards compatible (or migration is documented)
- [ ] RPC schema updates have matching handlers
- [ ] Frontend usage updated for new/changed fields
