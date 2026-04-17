export const generateImage = async (prompt: string): Promise<string | null> => {
  try {
    const apiKey = import.meta.env.VITE_PEXELS_API_KEY;
    if (!apiKey) {
      console.warn("Pexels API key is missing. Please add VITE_PEXELS_API_KEY to your environment variables.");
      return null;
    }

    const searchUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(prompt)}&per_page=15`;
    
    const response = await fetch(searchUrl, {
      headers: {
        Authorization: apiKey
      }
    });
    
    const data = await response.json();
    
    if (!data.photos || data.photos.length === 0) {
        console.warn("No images found on Pexels for the prompt.");
        return null;
    }
    
    // Pick a random image from the results
    const randomPhoto = data.photos[Math.floor(Math.random() * data.photos.length)];
    
    if (randomPhoto && randomPhoto.src && randomPhoto.src.large) {
        const imageUrl = randomPhoto.src.large;
        
        // Fetch the image and convert to base64
        const imgResponse = await fetch(imageUrl);
        const blob = await imgResponse.blob();
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
    
    return null;
  } catch (error) {
    console.error("Pexels API Error:", error);
    throw error;
  }
};
