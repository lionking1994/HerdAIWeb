# Security Policy

## Overview

This document outlines the security measures, scanning tools, and best practices implemented in the HerdAI Web application.

## Static Code Analysis

### CodeQL (GitHub Advanced Security)

We use GitHub's CodeQL for comprehensive static application security testing (SAST).

**What it detects:**
- SQL Injection vulnerabilities
- Cross-Site Scripting (XSS)
- Path traversal attacks
- Insecure deserialization
- Hardcoded credentials
- Cryptographic vulnerabilities
- And 2000+ other security patterns

**Configuration:** `.github/workflows/codeql-analysis.yml`

**Runs on:**
- Every push to `main`, `master`, `develop`
- Every pull request
- Weekly scheduled scan (Mondays at 6 AM UTC)

**View Results:** GitHub Repository → Security → Code scanning alerts

### ESLint Security Plugins

Server-side code is scanned with ESLint security plugins.

**Plugins:**
- `eslint-plugin-security` - Node.js security rules
- `eslint-plugin-no-secrets` - Detects hardcoded secrets

**Configuration:** `server/.eslintrc.js`

**Key Rules:**
| Rule | Severity | Description |
|------|----------|-------------|
| `detect-sql-injection` | Warning | SQL injection patterns |
| `detect-unsafe-regex` | Error | ReDoS vulnerabilities |
| `detect-eval-with-expression` | Error | Dynamic eval() usage |
| `detect-object-injection` | Warning | Object injection attacks |
| `detect-possible-timing-attacks` | Warning | Timing attack patterns |
| `no-secrets` | Error | Hardcoded secrets |

## Dependency Scanning

### npm audit

Automatic dependency vulnerability scanning runs on every CI build.

**Audit Levels:**
- `critical` - Must fix immediately
- `high` - Should fix before deployment
- `moderate` - Should fix in next release
- `low` - Fix when convenient

### OWASP Dependency Check

OWASP Dependency-Check identifies known vulnerable components.

**Reports:** Available as workflow artifacts after each scan.

### Dependabot

GitHub Dependabot automatically creates PRs for vulnerable dependencies.

**Configuration:** `.github/dependabot.yml`

## Secrets Detection

### TruffleHog

Scans for accidentally committed secrets, API keys, and credentials.

**Runs on:** Every push and pull request

## Security Workflows

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| CodeQL Analysis | `codeql-analysis.yml` | Push, PR, Weekly | SAST scanning |
| Security Scan | `security-scan.yml` | Push, PR | ESLint, npm audit, OWASP |

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

1. **DO NOT** create a public GitHub issue
2. Email: security@getherd.ai
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Security Best Practices for Developers

### Code Review Checklist

- [ ] No hardcoded secrets or API keys
- [ ] Input validation on all user inputs
- [ ] Parameterized queries for database operations
- [ ] Proper error handling (no stack traces exposed)
- [ ] Authentication/authorization checks
- [ ] HTTPS enforced for all endpoints
- [ ] Sensitive data encrypted at rest and in transit

### Environment Variables

Never commit `.env` files. Use:
- GitHub Secrets for CI/CD
- AWS Secrets Manager for production
- Local `.env` files (gitignored) for development

### Database Security

- ✅ SSL/TLS encryption in transit (TLSv1.3)
- ✅ Encryption at rest (AWS RDS)
- ✅ Parameterized queries (prevent SQL injection)
- ✅ Least privilege database users

## Compliance

This security setup helps meet requirements for:
- SOC 2 Type II
- GDPR
- HIPAA (with additional controls)
- PCI DSS (with additional controls)

## Running Security Scans Locally

```bash
# Install ESLint security plugins
cd server
npm install --save-dev eslint eslint-plugin-security eslint-plugin-no-secrets

# Run ESLint security scan
npm run lint

# Run npm audit
npm audit

# Run npm audit fix (auto-fix where possible)
npm audit fix
```

## Security Contacts

- Security Team: security@getherd.ai
- DevOps: devops@getherd.ai

---

Last Updated: December 2024

