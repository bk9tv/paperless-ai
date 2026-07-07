const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  normalizeDateValue,
  normalizeMoneyValue,
  normalizeLanguage,
  sanitizeCustomFieldValue,
  dedupeCustomFields,
  shouldRetryWithoutCustomFields
} = require('./services/updateValidationService');

assert.strictEqual(
  normalizeDateValue('01.07.2024', 'Rechnungsdatum: 01.07.2024'),
  '2024-07-01',
  'DD.MM.YYYY should be converted to YYYY-MM-DD'
);

assert.strictEqual(
  normalizeMoneyValue('100,00'),
  '100.00',
  'German decimal comma should be converted to dot decimal'
);

assert.strictEqual(normalizeLanguage('deutsch'), 'de', 'deutsch should map to de');
assert.strictEqual(normalizeLanguage('german'), 'de', 'german should map to de');
assert.strictEqual(normalizeLanguage('klingon'), null, 'unsupported language should be omitted');

assert.strictEqual(
  sanitizeCustomFieldValue(
    'Rechnungsnummer',
    '123456789',
    'Allgemeine Geschaeftsbedingungen fuer den Ladedienst',
    false
  ),
  null,
  'invoice-only custom fields should be skipped for non-invoice documents'
);

assert.strictEqual(
  shouldRetryWithoutCustomFields(
    { response: { status: 400 } },
    { title: 'Bad custom field payload', custom_fields: [{ field: 1, value: 'bad' }] }
  ),
  true,
  'HTTP 400 with custom_fields should trigger a retry without custom_fields'
);

assert.strictEqual(
  shouldRetryWithoutCustomFields(
    { response: { status: 500 } },
    { title: 'Duplicate custom field payload', custom_fields: [{ field: 7, value: '123456789' }] }
  ),
  true,
  'HTTP 500 with custom_fields should trigger a retry without custom_fields'
);

assert.strictEqual(
  shouldRetryWithoutCustomFields(
    { response: { status: 422 } },
    { title: 'Invalid custom field payload', custom_fields: [{ field: 7, value: '123456789' }] }
  ),
  true,
  'HTTP 422 with custom_fields should trigger a retry without custom_fields'
);

assert.strictEqual(
  shouldRetryWithoutCustomFields(
    { response: { status: 399 } },
    { title: 'Non-error response', custom_fields: [{ field: 7, value: '123456789' }] }
  ),
  false,
  'status below 400 should not trigger retry'
);

assert.deepStrictEqual(
  dedupeCustomFields([
    { field: 7, value: '123456789' },
    { field: 7, value: 'ignored duplicate' },
    { field: '8', value: ' 2024-07-01 ' },
    { field: 8, value: 'ignored numeric duplicate' },
    { field: 9, value: '' },
    { field: { id: 10 }, value: 'EUR' }
  ]),
  [
    { field: 7, value: '123456789' },
    { field: 8, value: '2024-07-01' },
    { field: 10, value: 'EUR' }
  ],
  'duplicate custom_fields should be deduplicated by field id'
);

const documentModelPath = path.join(__dirname, 'models', 'document.js');
const documentModelSource = fs.readFileSync(documentModelPath, 'utf8');
assert.match(
  documentModelSource,
  /CREATE TABLE IF NOT EXISTS failed_documents/,
  'failed_documents table should exist'
);
assert.match(
  documentModelSource,
  /isDocumentPermanentlyFailed/,
  'failed documents should be skippable after repeated failures'
);

const setupRoutePath = path.join(__dirname, 'routes', 'setup.js');
const setupRouteSource = fs.readFileSync(setupRoutePath, 'utf8');
assert(
  setupRouteSource.indexOf('updatedDocument = await paperlessService.updateDocument(docId, { ...updateData });') <
    setupRouteSource.indexOf('documentModel.addProcessedDocument'),
  'processed/history writes should happen only after the primary update succeeds'
);
assert(
  setupRouteSource.indexOf('updatedDocument = await paperlessService.updateDocument(docId, retryPayload);') <
    setupRouteSource.indexOf('documentModel.addProcessedDocument'),
  'processed/history writes should happen only after fallback update succeeds'
);
assert.match(
  setupRouteSource,
  /catch \(retryError\)[\s\S]*documentModel\.addFailedDocument[\s\S]*throw retryError;/,
  'failed_documents should be written only after the fallback update fails'
);
assert.match(
  setupRouteSource,
  /for \(const doc of documents\)[\s\S]*catch \(error\)[\s\S]*documentModel\.addFailedDocument/,
  'scan loop should catch per-document failures and continue'
);

console.log('robust update validation checks passed');
