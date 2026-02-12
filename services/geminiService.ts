import { GoogleGenAI } from "@google/genai";

// Initialize Gemini client safely
const apiKey = process.env.API_KEY || ''; 
// In a real app, we might handle missing keys gracefully, but for this output we assume it's injected.

export const generateImage = async (prompt: string): Promise<string | null> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please check your configuration.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Using gemini-2.5-flash-image for standard image generation as requested
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `Generate a beautiful, high-quality image suitable for a jigsaw puzzle. 
                   Style: ${prompt}. 
                   Ensure high contrast and clear details. Aspect ratio 1:1.`
          }
        ]
      }
    });

    // Iterate through parts to find the image
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
        const base64EncodeString = part.inlineData.data;
        return `data:${part.inlineData.mimeType};base64,${base64EncodeString}`;
      }
    }

    console.warn("No image data found in response");
    return null;

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};