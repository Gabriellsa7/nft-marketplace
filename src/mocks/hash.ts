/**
 * Deterministic non-cryptographic hash used only to avoid storing plaintext
 * passwords in the mock database. This is a simulation, not real security.
 */
export function mockHashPassword(password: string): string {
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    hash = (Math.imul(31, hash) + password.charCodeAt(i)) | 0
  }
  return `h${hash.toString(16)}.${password.length}`
}
