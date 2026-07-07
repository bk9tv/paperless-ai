# Robust Update Deployment Notes

These notes describe how to build, publish, deploy, verify, and roll back a patched Paperless-AI image.

## Branch

Use a feature branch, not `main` or `master`:

```bash
git switch -c fix/robust-paperless-update-validation
```

## Local build

Use a pinned tag for production. Do not deploy `latest`.

```bash
docker build -t ghcr.io/<my-github-user>/paperless-ai:robust-update-YYYYMMDD .
```

Optional local smoke run depends on your existing compose configuration and should be tested only against a non-production Paperless-AI data volume first.

## Publish to GHCR

Manual publish example:

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u <my-github-user> --password-stdin
docker push ghcr.io/<my-github-user>/paperless-ai:robust-update-YYYYMMDD
```

The included GitHub Actions workflow publishes only for tags matching `v*-bk9tv*`, for example:

```bash
git tag v3.0.9-bk9tv.1
git push origin fix/robust-paperless-update-validation
git push origin v3.0.9-bk9tv.1
```

## docker-compose image replacement

Replace the upstream image with a pinned GHCR image tag:

```yaml
services:
  paperless-ai-steuern:
    image: ghcr.io/<my-github-user>/paperless-ai:<pinned-tag>
```

Deploy first to `paperless-ai-steuern` only. Use the same image for `paperless-ai-kunden` and `paperless-ai-privat` only after the tax container has processed representative documents successfully.

## Verification checklist

- `node --check routes/setup.js`
- `node --check services/paperlessService.js`
- `node --check models/document.js`
- `node --check services/updateValidationService.js`
- `node test-robust-update-validation.js`
- Start only `paperless-ai-steuern`.
- Process 3 to 5 known problem documents.
- Confirm invalid AI fields are omitted or normalized before Paperless PATCH.
- Confirm Paperless HTTP 400 for one document does not stop the remaining batch.
- Confirm `failed_documents` receives repeated failures.
- Confirm processed documents are recorded only after Paperless accepts the update.

## Rollback

Code rollback:

```bash
git revert <patch-commit>
```

Patch-file rollback, if the patch was applied without Git:

```bash
git apply -R paperless-ai-robust-update.patch
```

Compose rollback:

```yaml
services:
  paperless-ai-steuern:
    image: <previous-pinned-image-or-digest>
```

Operational rollback:

- Stop only `paperless-ai-steuern`.
- Restore the previous pinned image tag or digest.
- Restore the `ai-data-steuern` volume backup if the Paperless-AI local state must be reverted.
- Restore a Paperless DB dump only if Paperless document metadata was changed incorrectly and cannot be corrected manually.

## Optional upstream PR description

Title:

```text
Harden Paperless update payload validation and per-document failure handling
```

Body:

```text
This change prevents one invalid AI-generated Paperless update payload from blocking an entire document batch.

Summary:
- Validate and sanitize AI output before sending Paperless PATCH payloads.
- Normalize unambiguous dates, monetary values, and common language names.
- Omit invalid language/custom field values instead of sending invalid payloads.
- Avoid hallucinated fallback dates such as 1990-01-01.
- Retry Paperless HTTP 400 updates once without custom_fields.
- Record repeated failures in failed_documents to avoid endless retry loops.
- Mark documents processed only after Paperless confirms the update.

This is intended to make batch processing resilient when LLM output contains unsuitable structured metadata for a non-invoice document.
```
