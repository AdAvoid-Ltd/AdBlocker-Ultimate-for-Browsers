export function isNumber(value) {
  return value != null && value !== '' && !Number.isNaN(Number(value));
}
