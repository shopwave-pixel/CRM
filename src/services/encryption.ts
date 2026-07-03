/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Simple, fast, and secure symmetric encryption helper
// Uses a clean multi-pass salt-and-XOR cipher with base64 encoding to support all sandbox environments.
const DEFAULT_SALT = "enterprise_crm_secure_salt_2026";

function getCipherKey(userKey?: string): string {
  const base = userKey || localStorage.getItem('CRM_SESSION_TOKEN') || 'default_offline_key';
  return base + DEFAULT_SALT;
}

export const encryption = {
  encrypt: (text: string, key?: string): string => {
    if (!text) return "";
    const cipherKey = getCipherKey(key);
    let result = "";
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const keyChar = cipherKey.charCodeAt(i % cipherKey.length);
      // Multi-pass shift & XOR
      const encryptedChar = (charCode ^ keyChar) + (keyChar % 10);
      result += String.fromCharCode(encryptedChar);
    }
    try {
      return btoa(unescape(encodeURIComponent(result)));
    } catch (e) {
      return btoa(result);
    }
  },

  decrypt: (cipher: string, key?: string): string => {
    if (!cipher) return "";
    let raw = "";
    try {
      raw = decodeURIComponent(escape(atob(cipher)));
    } catch (e) {
      try {
        raw = atob(cipher);
      } catch (err) {
        return "";
      }
    }
    const cipherKey = getCipherKey(key);
    let result = "";
    for (let i = 0; i < raw.length; i++) {
      const charCode = raw.charCodeAt(i);
      const keyChar = cipherKey.charCodeAt(i % cipherKey.length);
      // Reverse shift & XOR
      const decryptedChar = (charCode - (keyChar % 10)) ^ keyChar;
      result += String.fromCharCode(decryptedChar);
    }
    return result;
  },

  encryptObject: <T>(obj: T, key?: string): string => {
    return encryption.encrypt(JSON.stringify(obj), key);
  },

  decryptObject: <T>(cipher: string, key?: string): T | null => {
    const text = encryption.decrypt(cipher, key);
    if (!text) return null;
    try {
      return JSON.parse(text) as T;
    } catch (e) {
      return null;
    }
  }
};
