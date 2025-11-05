# Git Hooks Setup (Optional)

This directory contains example git hooks that can help prevent version management mistakes.

## Setup Instructions

To enable these hooks, you'll need to install husky:

```bash
# Install husky
npm install --save-dev husky

# Initialize husky
npx husky install

# Copy the pre-commit hook
cp .husky-example/pre-commit .husky/pre-commit
chmod +x .husky/pre-commit
```

## What the hooks do

### pre-commit

This hook runs before every commit and:
- Detects if you're committing changes to `package.json` or `app.json`
- Automatically runs `npm run version:verify`
- Blocks the commit if versions are inconsistent
- Reminds you to use the version bump scripts

## Benefits

- Prevents accidentally committing inconsistent version numbers
- Ensures you use the automated version bump scripts
- Catches version errors before they reach the repository
- Saves time by catching issues early

## Disable hooks temporarily

If you need to bypass the hooks for a specific commit:

```bash
git commit --no-verify -m "your message"
```

## Remove hooks

To remove the hooks:

```bash
rm -rf .husky
```

## Note

These hooks are optional but highly recommended for teams to ensure consistent version management practices.
