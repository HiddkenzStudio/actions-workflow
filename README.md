# actions-workflow

## Description

This repository contains reusable GitHub Actions workflows and related configurations.

### Key Features
- **Secret Scanning:** Automatically scans PRs for accidentally committed secrets using Gitleaks.
- **Conventional Commits:** Assumes the Conventional Commits standard (via Husky and Commitlint) for clean, readable commit histories.
- **Automated Releases:** Uses Release Please to automatically generate semantic version tags and changelogs when merging to `main`.
- **Automated & Manual Deployments:** Supports deployments to Coolify depending on branch (automated webhook for staging, and manual sync using the `latest` Docker tag for production).

### Workflows

#### 1. CD — Shared Build and Conditional Deploy (`deploy.yml`)

A reusable continuous deployment workflow for building and pushing Docker images to GitHub Container Registry (GHCR).

- **Automated Releases:** Runs Google's Release Please action to automatically create Release PRs, generate changelogs, and tag releases when merged to `main`.
- **Build & Push:** Sets up Docker Buildx, extracts tags/labels, and pushes the image to GHCR.
- **Conditional Deployment:**
  - On the `staging` branch, it automatically triggers a Coolify webhook to deploy.
  - On the `main` branch, it pushes the image (tagged as `latest`) and prompts for a manual sync in Coolify. (Configure Coolify to always pull the `latest` tag).
- **Notifications:** Sends success or failure alerts via Telegram depending on the build status and branch.

#### 2. CI — Shared PR Quality Validation (`pr-validation.yml`)

A reusable continuous integration workflow for validating Pull Requests in Next.js applications using `pnpm`.

- **Secret Scanning:** Runs Gitleaks to detect hardcoded secrets, API keys, and passwords before they are merged.
- **Environment Setup:** Installs Node.js 24 and `pnpm`.
- **Code Quality Checks:** Runs TypeScript type checking (`pnpm run typecheck`) and ESLint (`pnpm run lint`).
- **Build Verification:** Executes a Next.js production build (`pnpm run build`) to ensure there are no build-time errors.
- **Bundle Analysis:** Analyzes the Next.js JavaScript bundle sizes and generates a markdown table in the GitHub Actions step summary.

## License

This project is licensed under the [MIT License](LICENSE).
