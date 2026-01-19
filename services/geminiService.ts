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
 * e.g., "Gato-Rojo-Saltando"
 */
export const generateMnemonicCode = async (file: File): Promise<string | null> => {
  if (!process.env.API_KEY) {
    console.warn("API Key is missing. Using fallback code generation.");
    return null;
  }

  try {
    const base64Data = await fileToGenerativePart(file);
    
    // Use gemini-3-flash-preview for multimodal (image-to-text) tasks as per guidelines
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: file.type,
              data: base64Data
            }
          },
          {
            text: "Generate a unique code consisting of 3 Spanish words separated by hyphens that describes this image. Example: 'Perro-Azul-Corriendo'. Keep it short, uppercase, and no special characters other than hyphens. Just the code."
          }
        ]
      }
    });

    const text = response.text?.trim();
    if (text && text.length > 5 && text.length < 50) {
        return text.toUpperCase().replace(/\s/g, '');
    }
    return null;
  } catch (error) {
    console.error("Error generating AI code:", error);
    return null;
  }
};