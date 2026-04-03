# Project Guidelines

## Architecture
This workspace is for a mobile-friendly attendance management PWA.
Build the app as a client-side React + Vite + TypeScript application for GitHub Pages deployment.
Keep the implementation offline-capable and suitable for home-screen installation on smartphones.

## Build and Tooling
Use `mise` for runtime management and `pnpm` for package management.
Do not use `npm` commands or npm-specific lockfiles.
Prefer Vite conventions and keep the app compatible with static hosting on GitHub Pages.

## Data and Storage
Persist daily attendance records in IndexedDB and keep at most two months of data.
Persist the configurable daily standard working time in browser storage.
Compute actual working time from clock-in, clock-out, and break duration, then compute overtime from the configured daily standard.
Keep monthly overtime totals derived from stored daily records rather than duplicating aggregate state when avoidable.

## Product Conventions
Prioritize a touch-friendly mobile UI before desktop polish.
Implement the workflow incrementally: daily entry first, then persistence, monthly aggregation, PWA support, and GitHub Pages deployment.

## Delivery Expectations
Prefer small, verifiable changes that keep the app runnable at each step.
When adding deployment or PWA configuration, keep paths and asset settings correct for GitHub Pages static hosting.
