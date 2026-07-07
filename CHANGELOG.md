# Changelog

## Unreleased

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
