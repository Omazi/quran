/** Base64 of bytes, for the tests (Node's `Buffer` is not in the app's types). */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: readonly number[]): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a = 0, b = 0, c = 0] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    const triple = (a << 16) | (b << 8) | c;
    text += ALPHABET[(triple >> 18) & 63]! + ALPHABET[(triple >> 12) & 63]!;
    text += i + 1 < bytes.length ? ALPHABET[(triple >> 6) & 63]! : '=';
    text += i + 2 < bytes.length ? ALPHABET[triple & 63]! : '=';
  }
  return text;
}
