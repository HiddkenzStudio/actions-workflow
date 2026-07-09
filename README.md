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

## Setup Instructions for Caller Repositories

To ensure your target repositories comply with the pipeline's code quality and release standards, you should set up Husky, Commitlint, and pre-commit/pre-push hooks.

Run the following commands in your target project (assuming `pnpm`):

```bash
# Initialize Husky
pnpm exec husky init

# Install Commitlint and the conventional config
pnpm add -D @commitlint/config-conventional @commitlint/cli

# Configure Commitlint
echo "export default { extends: ['@commitlint/config-conventional'] };" > commitlint.config.mjs

# Add the commit-msg hook (enforces conventional commits)
echo 'pnpm exec commitlint --edit "${1}"' > .husky/commit-msg
chmod +x .husky/commit-msg

# Add the pre-commit hook (runs typecheck and linting)
cat << 'EOF' > .husky/pre-commit
pnpm typecheck
pnpm lint-staged
EOF
chmod +x .husky/pre-commit

# Add the pre-push hook (runs tests only if a Vitest config exists)
cat << 'EOF' > .husky/pre-push
if [ -f "vitest.config.ts" ] || [ -f "vitest.config.js" ] || [ -f "vitest.config.mjs" ]; then
  pnpm test
else
  echo "No vitest config found, skipping tests."
fi
EOF
chmod +x .husky/pre-push
```

## Usage

To use these workflows in your repository, create the following files in your `.github/workflows/` directory.

### 1. Continuous Deployment (`cd.yml`)

Create `.github/workflows/cd.yml`:

```yaml
name: CD

on:
  push:
    branches:
      - main
      - staging

# Explicitly grant the caller workflow permission to write to GHCR, create releases, and open PRs
permissions:
  contents: write
  pull-requests: write
  packages: write

jobs:
  call-deployment:
    uses: HiddkenzStudio/actions-workflow/.github/workflows/deploy.yml@main
    with:
      image_name: ${{ github.repository }}
    secrets: inherit
```

### 2. Continuous Integration (`ci.yml`)

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches:
      - main
      - staging

# Explicitly grant permissions needed for code analysis, PR status updates, and PR reads (for Gitleaks)
permissions:
  contents: read
  statuses: write
  pull-requests: read

jobs:
  call-pr-validation:
    uses: HiddkenzStudio/actions-workflow/.github/workflows/pr-validation.yml@main
    secrets: inherit
```

### Required Secrets

Ensure the following repository secrets are configured in the caller repository:
- `GITLEAKS_LICENSE`: License key for Gitleaks.
- `COOLIFY_WEBHOOK_STAGING`: Webhook URL for staging deployments in Coolify.
- `COOLIFY_SECRET`: Authorization token for the Coolify webhook.
- `TELEGRAM_CHAT_ID`: Chat ID for Telegram notifications.
- `TELEGRAM_BOT_TOKEN`: Bot token for Telegram notifications.

## License

This project is licensed under the [MIT License](LICENSE).
