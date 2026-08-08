import { httpError } from './errors.js';

export function readRequiredFiniteNumber(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw httpError(400, `${fieldName} must be a number`);
  }
  return number;
}

export function readOptionalFiniteNumber(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  return readRequiredFiniteNumber(value, fieldName);
}

export function readRequiredString(value, fieldName) {
  const text = String(value ?? '').trim();
  if (!text) {
    throw httpError(400, `${fieldName} is required`);
  }
  return text;
}

export function readOptionalString(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}
