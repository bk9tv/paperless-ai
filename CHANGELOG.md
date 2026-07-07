# Changelog

## Unreleased

### Robust Paperless update validation v2

- Treat Paperless API errors with `custom_fields` as recoverable for any Axios response status `>= 400`, including 400, 409, 422, and 500.
- Retry exactly once without `custom_fields` when Paperless rejects nested custom field updates.
- Handle Paperless duplicate custom field integrity errors such as `documents_customfieldinstance_unique_document_field` by preserving safe metadata updates and skipping custom fields.
- Deduplicate `custom_fields` by field id before sending updates to Paperless.
- Record a warning when custom fields are skipped after a successful fallback update.
- Keep writing `processed_documents`, history, and metrics only after the primary or fallback Paperless update succeeds.
- Store failed documents only after both the primary update and fallback update fail.

### Robust Paperless update validation

- Harden Paperless document updates so one Paperless HTTP 400 response does not block the full processing batch.
- Validate and sanitize AI output before sending PATCH payloads to Paperless.
- Normalize unambiguous German dates such as `01.07.2024` to `2024-07-01`.
- Normalize German decimal money values such as `100,00` to `100.00`.
- Map common language names such as `deutsch` and `german` to Paperless language code `de`.
- Omit invalid language values instead of sending them to Paperless.
- Skip invoice-only custom fields for documents that do not look like invoices, receipts, bills, or payments.
- Retry once without `custom_fields` after a Paperless HTTP 400 caused by custom field payloads.
- Add `failed_documents` tracking to avoid endless retry loops for permanently failing documents.
