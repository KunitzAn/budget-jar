async function hmacSha256Hex(keyData: ArrayBuffer, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyTelegramAuth(data: Record<string, unknown>, botToken: string): Promise<boolean> {
  const { hash, ...fields } = data as { hash: string; [key: string]: unknown }
  const secret = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(botToken))
  const checkString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n')
  const computedHash = await hmacSha256Hex(secret, checkString)
  return computedHash === hash
}
