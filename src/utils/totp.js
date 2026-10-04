// TOTP Generator — browser side (RFC 6238)
// Same algorithm as Go server — SHA1, 6 digits, 30s window
// No server IP needed — runs in browser

async function hmacSHA1(key, data) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, data))
}

function base32Decode(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  str = str.toUpperCase().replace(/=+$/, '').replace(/\s/g, '')
  let bits = 0, val = 0
  const output = []
  for (const char of str) {
    val = (val << 5) | alphabet.indexOf(char)
    bits += 5
    if (bits >= 8) { bits -= 8; output.push((val >> bits) & 0xff) }
  }
  return new Uint8Array(output)
}

export async function generateTOTP(secret) {
  const key  = base32Decode(secret)
  const time = Math.floor(Date.now() / 1000 / 30)
  const buf  = new ArrayBuffer(8)
  new DataView(buf).setUint32(4, time, false)
  const hmac   = await hmacSHA1(key, buf)
  const offset = hmac[19] & 0xf
  const code   = ((hmac[offset] & 0x7f) << 24 |
                   hmac[offset+1] << 16 |
                   hmac[offset+2] << 8  |
                   hmac[offset+3]) % 1000000
  return String(code).padStart(6, '0')
}
