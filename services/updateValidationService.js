function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function toIsoDate(year, month, day) {
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isValidIsoDate(iso) ? iso : null;
}

function contentContainsDate(content, isoDate) {
  if (!content || !isoDate) return false;
  const [year, month, day] = isoDate.split('-');
  const variants = [
    isoDate,
    `${day}.${month}.${year}`,
    `${day}-${month}-${year}`,
    `${day}/${month}/${year}`
  ];
  return variants.some(variant => String(content).includes(variant));
}

function normalizeDateValue(value, content) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  let isoDate = null;
  if (isValidIsoDate(raw)) {
    isoDate = raw;
  } else {
    const germanMatch = raw.match(/^(\d{1,2})[.-](\d{1,2})[.-](\d{4})$/);
    if (germanMatch) {
      isoDate = toIsoDate(
        Number(germanMatch[3]),
        Number(germanMatch[2]),
        Number(germanMatch[1])
      );
    }
  }

  if (!isoDate) return null;

  const placeholderDates = new Set(['1900-01-01', '1970-01-01', '1990-01-01', '2000-01-01']);
  if (placeholderDates.has(isoDate) && !contentContainsDate(content, isoDate)) {
    console.warn(`[WARN] Skipping likely hallucinated placeholder date: ${isoDate}`);
    return null;
  }

  return isoDate;
}

function normalizeLanguage(value) {
  const normalized = normalizeText(value);
  const languageMap = {
    deutsch: 'de',
    german: 'de',
    englisch: 'en',
    english: 'en'
  };

  if (languageMap[normalized]) return languageMap[normalized];
  if (/^[a-z]{2}$/.test(normalized)) return normalized;
  return null;
}

function isFinancialDocument(analysisDocument) {
  const tags = Array.isArray(analysisDocument.tags) ? analysisDocument.tags.join(' ') : '';
  const haystack = normalizeText([
    analysisDocument.title,
    analysisDocument.document_type,
    tags
  ].filter(Boolean).join(' '));

  return [
    'invoice',
    'rechnung',
    'receipt',
    'quittung',
    'bill',
    'payment',
    'zahlung',
    'beleg',
    'faktura',
    'kassenbon'
  ].some(term => haystack.includes(term));
}

function normalizeCustomFields(customFields) {
  if (Array.isArray(customFields)) return customFields;
  if (customFields && typeof customFields === 'object') return Object.values(customFields);
  return [];
}

function normalizeMoneyValue(value) {
  const raw = String(value || '').trim().replace(/\s+/g, '');
  if (!raw) return null;

  if (/^-?\d{1,3}(\.\d{3})+,\d{1,2}$/.test(raw)) {
    return raw.replace(/\./g, '').replace(',', '.');
  }
  if (/^-?\d+,\d{1,2}$/.test(raw)) {
    return raw.replace(',', '.');
  }
  if (/^-?\d+(\.\d{1,2})?$/.test(raw)) {
    return raw;
  }
  return null;
}

function sanitizeCustomFieldValue(fieldName, value, content, financialDocument) {
  const normalizedName = normalizeText(fieldName);
  const rawValue = String(value || '').trim();
  if (!normalizedName || !rawValue) return null;

  const invoiceOnlyFields = new Set([
    'rechnungsnummer',
    'belegdatum',
    'originalwahrung',
    'bruttobetrag'
  ]);
  if (invoiceOnlyFields.has(normalizedName) && !financialDocument) {
    console.warn(`[WARN] Skipping invoice-only custom field "${fieldName}" for non-financial document`);
    return null;
  }

  if (normalizedName.includes('datum') || normalizedName.includes('date')) {
    return normalizeDateValue(rawValue, content);
  }

  if (normalizedName.includes('betrag') ||
      normalizedName.includes('amount') ||
      normalizedName.includes('total') ||
      normalizedName.includes('sum') ||
      normalizedName.includes('price')) {
    return normalizeMoneyValue(rawValue);
  }

  if (normalizedName.includes('wahrung') || normalizedName.includes('currency')) {
    const currency = rawValue.toUpperCase();
    return /^[A-Z]{3}$/.test(currency) ? currency : null;
  }

  return rawValue;
}

function getPaperlessErrorBody(error) {
  return error?.response?.data || error?.message || error;
}

function shouldRetryWithoutCustomFields(error, payload) {
  return error?.response?.status === 400 && !!payload?.custom_fields;
}

module.exports = {
  normalizeText,
  isValidIsoDate,
  normalizeDateValue,
  normalizeLanguage,
  isFinancialDocument,
  normalizeCustomFields,
  normalizeMoneyValue,
  sanitizeCustomFieldValue,
  getPaperlessErrorBody,
  shouldRetryWithoutCustomFields
};
