import { GoogleGenAI, Type, Modality } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
};

export const generatePhishingEmail = async (difficulty: number) => {
  const ai = getAI();
  const prompt = `Generate a realistic phishing email for employee training. 
  Difficulty Level: ${difficulty} (1 = obvious, 5 = extremely sophisticated).
  The email should include:
  - Subject line
  - Sender name and email (suspicious but realistic)
  - Body content (Markdown)
  - A list of "red flags" that the user should identify.
  - A brief explanation of why this is a phishing attempt.`;

  // Using Flash Lite for faster generation of the simulation content
  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          senderName: { type: Type.STRING },
          senderEmail: { type: Type.STRING },
          body: { type: Type.STRING },
          redFlags: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING } 
          },
          explanation: { type: Type.STRING }
        },
        required: ["subject", "senderName", "senderEmail", "body", "redFlags", "explanation"]
      }
    }
  });

  return JSON.parse(response.text);
};

export const quickSecurityChat = async (message: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: message,
    config: {
      systemInstruction: "You are a specialized cybersecurity training assistant. Provide brief, accurate, and actionable advice on digital safety and threat detection. Keep responses under 3 sentences for maximum speed.",
    }
  });
  return response.text;
};

export const generateDeepfakeAudio = async (text: string) => {
  const ai = getAI();
  try {
    // Ensure text is not empty
    if (!text || text.trim().length === 0) {
      throw new Error("Text for audio generation cannot be empty");
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Charon' }, // A deep, authoritative voice
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) {
      console.error("Gemini TTS returned no audio data. Response:", response);
      throw new Error("No audio data received from Gemini API");
    }

    return base64Audio;
  } catch (error) {
    console.error("Deepfake audio generation failed:", error);
    // Re-throw to allow UI to handle it
    throw error;
  }
};

export const analyzeSimulationResponse = async (simulationContent: string, userFlags: string[]) => {
  const ai = getAI();
  const prompt = `Analyze a user's response to a phishing simulation.
  Simulation Content: ${simulationContent}
  User Identified Flags: ${userFlags.join(", ")}
  
  Provide feedback on:
  - What they missed.
  - What they correctly identified.
  - Overall score (0-100).
  - Encouraging advice.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          missedFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
          feedback: { type: Type.STRING }
        },
        required: ["score", "missedFlags", "correctFlags", "feedback"]
      }
    }
  });

  return JSON.parse(response.text);
};

export const generatePhoneSimulation = async (difficulty: number) => {
  const ai = getAI();
  const prompt = `Generate a script for a social engineering phone call (vishing).
  Difficulty Level: ${difficulty}.
  The script should be for an attacker pretending to be from IT, HR, or a Bank.
  Include:
  - Attacker's opening line
  - The "hook" (the reason for the call)
  - The "ask" (what sensitive info they want)
  - A list of red flags in the conversation.`;

  // Using Flash Lite for fast script generation
  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          scenario: { type: Type.STRING },
          attackerScript: { type: Type.STRING },
          redFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
          explanation: { type: Type.STRING }
        },
        required: ["scenario", "attackerScript", "redFlags", "explanation"]
      }
    }
  });

  const data = JSON.parse(response.text);
  
  // Also generate the audio for the opening line
  const audioBase64 = await generateDeepfakeAudio(data.attackerScript);
  
  return { ...data, audioBase64 };
};

export const playAudio = (base64: string) => {
  try {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Gemini TTS returns raw 16-bit PCM at 24kHz. 
    // We need to wrap it in a WAV header for the browser to play it.
    const wavHeader = createWavHeader(len, 24000);
    const wavBytes = new Uint8Array(wavHeader.length + len);
    wavBytes.set(wavHeader, 0);
    wavBytes.set(bytes, wavHeader.length);

    const blob = new Blob([wavBytes], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play().catch(e => console.error("Audio playback failed:", e));
    return audio;
  } catch (e) {
    console.error("Audio processing failed:", e);
    return null;
  }
};

const createWavHeader = (dataLength: number, sampleRate: number) => {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // file length
  view.setUint32(4, 36 + dataLength, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, dataLength, true);

  return new Uint8Array(header);
};

const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

