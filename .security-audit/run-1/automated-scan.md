# Automated Security Scan Report

**Target:** `/home/naiplawan/Desktop/Workhub/cafe-pos`
**Scanned at:** 2026-10-18 (local time, Asia/Bangkok)
**Languages detected:** TypeScript, JavaScript, YAML, JSON
**Semgrep rulesets:** `p/owasp-top-ten`, `p/secrets`, `p/javascript`, `p/typescript`, `p/react`, `p/nextjs`
**Tools run:** Semgrep 1.163.0, Trivy 0.69.3, TruffleHog 3.93.8, osv-scanner 2.6.0, `pnpm audit`
**Tools skipped:** Bandit (not applicable; no Python source)
**Raw logs:** `.security-audit/run-1/`

## Pre-flight Summary

| Tool | Status | Version |
| --- | --- | --- |
| Semgrep | OK | 1.163.0 |
| Trivy | OK | 0.69.3 |
| TruffleHog | OK | 3.93.8 |
| Bandit | N-A | 1.9.4 installed; no Python files |
| osv-scanner | OK | 2.6.0 |
| pnpm audit | OK | pnpm 11.21.0 |

## Credential-File Handling

**Credential-like files detected by filename:** `backend/.env.local`, `frontend/.env.local`; example templates `backend/.env.example` and `frontend/.env.example` also exist. Their contents were not manually read.

**Path excludes applied:** Semgrep excluded `.security-audit/` and credential filename patterns. TruffleHog scanned Git history and cannot reliably exclude historical credentials by present path. Trivy was rerun with explicit excludes for the two nested `.env.local` paths, `.next` build directories, and credential patterns; `.security-audit/` was excluded.

**Limitations:** The first Trivy run used basename-style nested excludes that were insufficient; its output showed masked JWT-like detections in ignored local environment files and generated `.next` bundles. A corrected run with explicit path exclusions reported no findings in the repository scan. TruffleHog's history scan reported zero verified and zero unverified secrets. No secret values were copied into this summary. The first Trivy log was replaced by the corrected run log during the rerun.

## Tool Results

### Semgrep

**Summary:** Completed 145 rules on 417 Git-tracked files; 8 match instances across 5 distinct rule/path groups. Alerts covered mutable GitHub Action tags, missing pnpm supply-chain policy settings (`blockExoticSubdeps`, `minimumReleaseAge`, and `trustPolicy`), and AES-GCM `createDecipheriv` without an explicit tag length. The tag-length alert is a manual review lead only: application writes use the default full GCM tag, and the decryption path accepts stored encrypted LINE credentials rather than attacker-supplied ciphertext. The pnpm and Action findings are supply-chain hardening recommendations without a demonstrated exploitable path in the application.

**Rulesets:** `p/owasp-top-ten`, `p/secrets`, `p/javascript`, `p/typescript`, `p/react`, `p/nextjs`
**Log:** `semgrep.log`

### Trivy

**Summary:** Corrected scan completed; 0 dependency vulnerabilities reported for `pnpm-lock.yaml`. The scan excluded local env files and generated `.next` artifacts.
**Log:** `trivy.log`

### TruffleHog

**Summary:** Git history scan completed: 0 verified, 0 unverified secret detections.
**Log:** `trufflehog.log`

### Bandit

**Summary:** Not applicable — no Python source files.
**Log:** Not created.

### osv-scanner

**Summary:** Completed against the recursive source and `pnpm-lock.yaml`; no issues found.
**Log:** `osv-scanner.log`

### pnpm audit

**Summary:** 0 vulnerabilities across 788 resolved dependencies (302 dependencies, 435 dev dependencies, 224 optional dependencies as reported by pnpm).
**Log:** `pnpm-audit.log`

## Cross-Tool Observations

No dependency advisory overlap was detected. Semgrep's GCM tag-length alert merits source review but did not establish that an attacker controls ciphertext or has a verification oracle.

## Manual Review Leads

- `frontend/src/lib/crypto.ts`: implicit AES-GCM tag length; assessed in the manual audit. Current encryption emits a full tag and decryption is fed from stored LINE credentials; no attacker-controlled ciphertext path was found.
- `.github/workflows/ci.yml` and `pnpm-workspace.yaml`: mutable action tags and missing pnpm policy controls; hardening items, not confirmed application vulnerabilities.

## Coverage Gaps

Scanners do not establish role correctness, tenant binding, account/email ownership, checkout/reward invariants, forwarded-IP trust, or deployed proxy/database configuration. These were reviewed manually where source evidence was available. No live deployment requests or live-secret verification were performed.
