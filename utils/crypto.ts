// Utility for Client-Side Encryption (AES-GCM) based on the File Code

// Derive a CryptoKey directly from the simple code string (e.g., "GATO-ROJO")
export const getKeyFromCode = async (code: string): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  // Use SHA-256 to create a 256-bit key from the code string
  const hash = await window.crypto.subtle.digest('SHA-256', data);
  return window.crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
};

// Encrypts file + metadata using the Code as key
export const encryptFile = async (
  file: File, 
  code: string,
  options: any
): Promise<Blob> => {
  const key = await getKeyFromCode(code);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // 1. Read file as ArrayBuffer
  const fileBuffer = await file.arrayBuffer();

  // 2. Create a package with metadata
  const dataPackage = JSON.stringify({
    mimeType: file.type,
    fileName: file.name,
    options: options,
    data: arrayBufferToBase64(fileBuffer)
  });

  const encoder = new TextEncoder();
  const encodedData = encoder.encode(dataPackage);

  // 3. Encrypt
  const encryptedContent = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encodedData
  );

  // 4. Combine IV + Encrypted Data
  const combinedBuffer = new Uint8Array(iv.length + encryptedContent.byteLength);
  combinedBuffer.set(iv);
  combinedBuffer.set(new Uint8Array(encryptedContent), iv.length);

  return new Blob([combinedBuffer], { type: 'application/octet-stream' });
};

export const decryptFile = async (
  encryptedBlob: Blob, 
  code: string
): Promise<{ blob: Blob; options: any; mimeType: string }> => {
  const key = await getKeyFromCode(code);
  const arrayBuffer = await encryptedBlob.arrayBuffer();
  
  // Extract IV (first 12 bytes)
  const iv = arrayBuffer.slice(0, 12);
  const data = arrayBuffer.slice(12);

  try {
    const decryptedContent = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv) },
      key,
      data
    );

    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decryptedContent);
    const packageData = JSON.parse(jsonString);

    const fileBuffer = base64ToArrayBuffer(packageData.data);
    
    return {
      blob: new Blob([fileBuffer], { type: packageData.mimeType }),
      options: packageData.options,
      mimeType: packageData.mimeType
    };
  } catch (e) {
    throw new Error("No se pudo desencriptar. El código podría ser incorrecto o el archivo está dañado.");
  }
};

// Helpers
function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string) {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}