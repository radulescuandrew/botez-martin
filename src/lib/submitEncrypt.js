/**
 * Encrypt progress payload for submit_progress_by_invite_token.
 * Key: 32-byte AES-256, from VITE_SUBMIT_ENCRYPTION_KEY (64 hex chars).
 * Output: base64( iv_16 || aes256cbc_ciphertext ).
 */

function getEncryptionKeyHex() {
  const hex = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUBMIT_ENCRYPTION_KEY
  return typeof hex === 'string' && hex.length === 64 && /^[0-9a-fA-F]+$/.test(hex) ? hex : null
}

function hexToBytes(hex) {
  const len = hex.length / 2
  const out = new Uint8Array(len)
  for (let i = 0; i < len; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

function uint8ArrayToBase64(u8) {
  let bin = ''
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i])
  return typeof btoa !== 'undefined' ? btoa(bin) : Buffer.from(u8).toString('base64')
}

/**
 * @param {Object} payload - { attempts, username, intro_seen, difficulty, last_score, run_duration_seconds }
 * @returns {Promise<string|null>} base64(iv||ciphertext) or null if key missing / encrypt fails
 */
export async function encryptProgressPayload(payload) {
  const keyHex = getEncryptionKeyHex()
  if (!keyHex) return null
  const keyBytes = hexToBytes(keyHex)
  const json = JSON.stringify({
    attempts: payload.attempts,
    username: payload.username ?? '',
    intro_seen: payload.intro_seen ?? false,
    difficulty: payload.difficulty ?? 'medium',
    last_score: payload.last_score ?? 0,
    run_duration_seconds: Math.max(0, Math.min(3600, Number.isFinite(payload.run_duration_seconds) ? payload.run_duration_seconds : 0)),
  })
  try {
    const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-CBC', false, ['encrypt'])
    const iv = crypto.getRandomValues(new Uint8Array(16))
    const encoded = new TextEncoder().encode(json)
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, encoded)
    const combined = new Uint8Array(iv.length + ciphertext.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(ciphertext), iv.length)
    return uint8ArrayToBase64(combined)
  } catch {
    return null
  }
}

export { getEncryptionKeyHex }
