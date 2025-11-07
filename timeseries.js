export function delta(a, b) {
  return {
    value: a - b,
    percentage: (a - b) / b,
  }
}
