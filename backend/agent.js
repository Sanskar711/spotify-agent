import dotenv from "dotenv";
import Groq from "groq-sdk";
import readlineSync from "readline-sync";
import { tools } from './server.js';
import { GoogleGenAI } from "@google/genai";
dotenv.config();

export const SYSTEM_PROMPT = `
You are a helpful Spotify AI assistant.

Your goal is to assist users in finding songs based on artist, genre, or album and help them add these songs to their Spotify queue if they wish.

You have access to these tools and always use them for searching:
- getSongsByArtist(artist, limit): Search for songs by artist name.
- getSongByGenre(genre, limit): Search for songs by genre.
- getSongsByAlbum(album, limit): Search for songs by album.
- getSongByName(songName): Search for songs by song name.
- addToQueue(songId): Add a song to the user's active Spotify queue.

Strict instructions:
- Strictly follow the JSON format. No extra text or comments or anything else after or before the JSON object.
- Strictly only output **one JSON object** per response.
- The JSON format must be **strict** with fields: { "type": ..., "message": ... } or { "type": "tool", "name": ..., "args": { ... } }.
- Always greet the user politely at the beginning.
- Always ask if the user wants to add a song to their queue after showing results.
  
Spotify Search API key notes:
- Endpoint: GET /search
- Required fields: q (query string) and type (artist, album, track).
- Optional: limit (max 50), market, offset.

- songId should be in the format of "spotify:track:xyz"

use the follwing sequence
user->plan->tool->observation->output

Examples of correct interaction:

1. {"type":"output", "message":"Hi there! What kind of songs would you like? Artist, genre, or album?"}
2. {"type":"user", "message":"Taylor Swift 3 songs"}
3. { "type": "plan", "message": "Using getSongsByArtist to search..." },
4. { "type": "tool", "name": "getSongsByArtist", "args": { "artist": "Taylor Swift", "limit": 3 } }
5. { "type":"observation", "message":"summarize the json response {JSON Object} by song name and its url in a concise manner"}
6. { "type":"output", "message":"Here are the top songs by Taylor Swift 
  1. https://open.spotify.com/track/{xaksdfj} 
  2. https://open.spotify.com/track/{xaksdfj} 
  3. https://open.spotify.com/track/{xaksdfj} 
. Would you like to add them to your queue?"}
If user says yes:
1. { "type": "plan", "message": "Using addToQueue tool to add song." },
2. { "type": "tool", "name": "addToQueue", "args": { "songId": "<spotify:track:xyz>" } }
3. { "type":"observation", "message":"{success:true}"}
3. { "type":"output", "message":"Successfully added the song to your queue!"}
please follow the above sequence strictly.
`


const messages = [];
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function fetchAccessToken() {
    const response = await fetch('http://localhost:8000/token');
    const data = await response.json();
    return data.token;
}

function cleanJsonResponse(text) {
  try {
    if (!text) {
      console.error("No text to clean!");
      return null;
    }
    text = text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    console.error("Error in cleanJsonResponse:", error);
    return null;
  }
}

async function runAgent() {
  while (true) {
      const query = readlineSync.question("Enter your query: ");
      const userQuery = {
          type: "user",
          user: query
      };

      messages.push({
          role: "user",
          parts: [{ text: JSON.stringify(userQuery) }]
      });

      while (true) {
          let response;
          try {
              response = await ai.models.generateContent({
                  model: "gemini-2.0-flash",
                  contents: messages,
                  config: {
                      systemInstruction: SYSTEM_PROMPT
                  },
              });
          } catch (error) {
              console.error("Gemini API call failed:", error);
              break;
          }

          const geminiText = response?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!geminiText) {
              console.error("No valid Gemini response. Breaking...");
              break;
          }

        //   console.log("----------GEMINI TEXT----------");
        //   console.log(geminiText);
        //   console.log("----------END----------");

          const action = cleanJsonResponse(geminiText);
        //   console.log("----------Action----------");
        //   console.log(action);
        //   console.log("----------END----------");

          if (!action) {
              console.error("No valid action. Breaking...");
              break;
          }

          messages.push({
              role: "assistant",
              parts: [{ text: JSON.stringify(action) }]
          });

          if (action.type === "output") {
              console.log(` 🤖 :${action.message}`);
              break;
          } else if (action.type === "plan") {
              messages.push({
                  role: "user",
                  parts: [{ text: JSON.stringify({ type: "user", user: "continue" }) }]
              });
              continue;
          } else if (action.type === "tool") {
              const fn = tools[action.name];
              if (!fn) {
                  throw new Error("Invalid tool call");
              }
              const args = Object.values(action.args);
              if (action.name === "addToQueue" && args[0]) {
                const songId = args[0];
                if (songId.startsWith('spotify:track:')) {
                    args[0] = songId.split('spotify:track:')[1]; // remove extra prefix
                }
            }
              const accessToken = await fetchAccessToken();
              const observation = await fn(...args, accessToken);
              console.log("----------Observation----------");
              console.log(observation);
              console.log("----------END----------");

              if (observation === "Invalid access token") {
                  console.log(" 🤖 :Please visit http://localhost:8000/login to get a new access token.");
                  const loginMessage = {
                      type: 'output',
                      message: "Please visit http://localhost:8000/login to get a new access token."
                  };
                  messages.push({ role: 'assistant', parts: [{ text: JSON.stringify(loginMessage) }] });
                  break;
              }

              const observationMessage = {
                  type: 'observation',
                  message: `summarize the json response ${JSON.stringify(observation)} by song name and its url in a concise manner`
              };
              messages.push({ role: 'assistant', parts: [{ text: JSON.stringify(observationMessage) }] });

              // 🛑 IMPORTANT: Immediately call Gemini again after pushing observation
              continue; // start a new loop to generate new output
          }
      }
  }
}

// runAgent(); 