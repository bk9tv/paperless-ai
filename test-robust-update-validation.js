const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  normalizeDateValue,
  normalizeMoneyValue,
  normalizeLanguage,
  sanitizeCustomFieldValue,
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

console.log('robust update validation checks passed');
