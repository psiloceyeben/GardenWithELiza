// EIP-191 personal_sign verification. Recovers the signer from a signature and compares to the claimed address.
// This is the ONLY cryptography in the game: proving wallet control. No keys are ever held (I-2).
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import { randomBytes } from 'node:crypto';

const enc = new TextEncoder();
const hex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (s: string): Uint8Array => { const h = s.replace(/^0x/, ''); const out = new Uint8Array(h.length / 2); for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16); return out; };

export function personalHash(message: string): Uint8Array {
  const body = enc.encode(message);
  const prefix = enc.encode(`\x19Ethereum Signed Message:\n${body.length}`);
  const all = new Uint8Array(prefix.length + body.length); all.set(prefix); all.set(body, prefix.length);
  return keccak_256(all);
}

export function addressOf(pubUncompressed: Uint8Array): string {
  return '0x' + hex(keccak_256(pubUncompressed.slice(1)).slice(12));
}

/** Returns the recovered lowercase address, or null if the signature is malformed. */
export function recoverAddress(message: string, signature: string): string | null {
  try {
    const sig = unhex(signature); if (sig.length !== 65) return null;
    let v = sig[64]; if (v >= 27) v -= 27; if (v !== 0 && v !== 1) return null;
    const s = secp256k1.Signature.fromCompact(sig.slice(0, 64)).addRecoveryBit(v);
    const pub = s.recoverPublicKey(personalHash(message)).toRawBytes(false);
    return addressOf(pub);
  } catch { return null; }
}

export function verifySignature(message: string, signature: string, address: string): boolean {
  const r = recoverAddress(message, signature); return !!r && r === address.toLowerCase();
}

export function newNonce(): string { return hex(randomBytes(16)); }

/** Test helper: sign with a raw private key (never used at runtime; the server holds no keys). */
export function signForTest(message: string, privHex: string): { address: string; signature: string } {
  const priv = unhex(privHex);
  const sig = secp256k1.sign(personalHash(message), priv);
  const address = addressOf(secp256k1.getPublicKey(priv, false));
  return { address, signature: '0x' + hex(sig.toCompactRawBytes()) + (sig.recovery! + 27).toString(16).padStart(2, '0') };
}
