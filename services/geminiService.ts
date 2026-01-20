import { GoogleGenAI } from "@google/genai";

// Initialize Gemini Client
// Note: In a real production app, API keys should be handled via backend proxy or strictly controlled environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Converts a File object to a Base64 string suitable for Gemini API.
 */
const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Generates a mnemonic code based on the image content.
 * e.g., "GATO-ROJO-SALTANDO"
 */
export const generateMnemonicCode = async (file: File): Promise<string | null> => {
  if (!process.env.API_KEY) return null;

  try {
    const base64Data = await fileToGenerativePart(file);
    
    // Use gemini-3-flash-preview for fast multimodal tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: file.type, data: base64Data } },
          { text: "Analyze the image and generate a code of exactly 3 Spanish words separated by hyphens that describes the main subject. Example: 'PERRO-AZUL-CORRIENDO'. It must be UPPERCASE. Do not use special characters other than the hyphen. Return ONLY the code." }
        ]
      }
    });

    const text = response.text?.trim();
    // Validate format (LETTERS-LETTERS-LETTERS)
    if (text && /^[A-ZÑ]+-[A-ZÑ]+-[A-ZÑ]+$/.test(text)) {
        return text;
    }
    return null;
  } catch (error) {
    console.warn("AI Code generation failed, falling back to random.", error);
    return null;
  }
};

/**
 * Checks if the image contains unsafe content (NSFW, Violence, etc).
 * Returns TRUE if safe, FALSE if unsafe.
 */
export const validateContentSafety = async (file: File): Promise<boolean> => {
    if (!process.env.API_KEY) return true; // Fail open if no key, or handle as needed
  
    try {
      const base64Data = await fileToGenerativePart(file);
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: file.type, data: base64Data } },
            { text: "Is this image safe to display in a general audience public web application? Look for explicit nudity, extreme violence, or gore. Answer strictly with 'YES' if it is safe, or 'NO' if it is unsafe." }
          ]
        }
      });
  
      const answer = response.text?.trim().toUpperCase();
      return answer === 'YES';
    } catch (error) {
      console.error("Safety check error:", error);
      return true; // Assume safe on error to avoid blocking valid users if API fails
    }
  };