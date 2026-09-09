import {
  BIP39_ENGLISH_WORDLIST,
  BIP39_ENGLISH_WORDLIST_SIZE,
} from "./bip39-english.js";

export const PHRASE_PROFILE_ID = "bip39-en-v1";

export const PHRASE_PROFILE_WORDLIST_SHA256 =
  "2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda";

export const PHRASE_PROFILE_SEMANTICS = "lexicon-only"         ;

export const SAFETY_PHRASE_WORD_COUNT = 4;

export const SAFETY_PHRASE_BITS = 44;

const BITS_PER_WORD = 11;

const MINIMUM_DIGEST_BYTES = Math.ceil(SAFETY_PHRASE_BITS / 8);

export function deriveSafetyPhrase(handshakeDigest            )           {
  if (!(handshakeDigest instanceof Uint8Array)) {
    throw new TypeError("handshakeDigest must be a Uint8Array");
  }
  if (handshakeDigest.length < MINIMUM_DIGEST_BYTES) {
    throw new RangeError(
      `handshakeDigest must be at least ${MINIMUM_DIGEST_BYTES} bytes to yield ${SAFETY_PHRASE_BITS} bits`,
    );
  }

  const words           = [];
  let bitOffset = 0;
  for (let word = 0; word < SAFETY_PHRASE_WORD_COUNT; word += 1) {
    let index = 0;
    for (let bit = 0; bit < BITS_PER_WORD; bit += 1) {
      const absoluteBit = bitOffset + bit;
      const byte = handshakeDigest[absoluteBit >>> 3]          ;

      const bitValue = (byte >>> (7 - (absoluteBit & 7))) & 1;
      index = (index << 1) | bitValue;
    }
    bitOffset += BITS_PER_WORD;
    if (index >= BIP39_ENGLISH_WORDLIST_SIZE) {

      throw new RangeError(`safety phrase index ${index} is out of range`);
    }
    words.push(BIP39_ENGLISH_WORDLIST[index]          );
  }
  return words;
}

export function serializePhraseProfileWordlist()         {
  return `${BIP39_ENGLISH_WORDLIST.join("\n")}\n`;
}

export function formatSafetyPhrase(words                   )         {
  return words.join(" ");
}

export function safetyPhrasesMatch(
  left                   ,
  right                   ,
)          {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left[i] === right[i] ? 0 : 1;
  }
  return mismatch === 0;
}
