import { GoogleGenAI, Modality } from "@google/genai";
import * as fs from "node:fs";

export async function generateImage(prompt) {
  const ai = new GoogleGenAI({
    apiKey: "AIzaSyAOFfxprLXWGiOxkm3gWUs39k8IrdJ_Ftg",
  });

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-preview-image-generation",
    contents: prompt,
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });

  let imageBuffer = null;
  let text = "";

  for (const part of response.candidates[0].content.parts) {
    if (part.text) text = part.text;
    if (part.inlineData) imageBuffer = Buffer.from(part.inlineData.data, "base64");
  }

  return { text, imageBuffer };
}