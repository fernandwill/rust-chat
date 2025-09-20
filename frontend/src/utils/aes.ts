// src/utils/aes.ts
// AES-256-CBC encryption utilities for the frontend

// Convert ArrayBuffer to base64 string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert base64 string to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Generate AES-256 key from password using PBKDF2
export async function generateAesKey(password: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  
  // Import the password as a crypto key
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    data,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  // Derive a 256-bit AES key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('rustchatserver2024_aes_secure'), // Same salt as server
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-CBC', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// Encrypt message using AES-256-CBC
export async function encryptMessageAes(message: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  
  // Generate a random IV
  const iv = crypto.getRandomValues(new Uint8Array(16));
  
  // Encrypt the data
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    key,
    data
  );
  
  // Combine IV and encrypted data
  const encryptedArray = new Uint8Array(encrypted);
  const result = new Uint8Array(iv.length + encryptedArray.length);
  result.set(iv, 0);
  result.set(encryptedArray, iv.length);
  
  // Convert to base64 for transmission
  return arrayBufferToBase64(result);
}

// Decrypt message using AES-256-CBC
export async function decryptMessageAes(encryptedMessage: string, key: CryptoKey): Promise<string> {
  try {
    // Convert base64 to ArrayBuffer
    const data = base64ToArrayBuffer(encryptedMessage);
    const dataArray = new Uint8Array(data);
    
    // Extract IV and encrypted data
    const iv = dataArray.slice(0, 16);
    const encrypted = dataArray.slice(16);
    
    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv },
      key,
      encrypted
    );
    
    // Convert to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch {
    throw new Error('Decryption failed');
  }
}
