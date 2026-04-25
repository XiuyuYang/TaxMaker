function hex(arr: Uint8Array): string {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function unhex(h: string): Uint8Array {
  const pairs = h.match(/.{2}/g);
  if (!pairs) return new Uint8Array(0);
  return new Uint8Array(pairs.map((b) => parseInt(b, 16)));
}

export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 },
    key,
    256
  );
  const saltHex = hex(salt);
  const hashHex = hex(new Uint8Array(bits));
  return `pbkdf2:${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [, saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = unhex(saltHex);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 },
    key,
    256
  );
  return hex(new Uint8Array(bits)) === hashHex;
}

export async function generateSessionToken(): Promise<{ token: string; hash: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = hex(bytes);
  const hash = await sha256hex(token);
  return { token, hash };
}

export async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return hex(new Uint8Array(buf));
}

export function generateId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return hex(bytes);
}
