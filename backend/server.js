import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "./agent.js";
dotenv.config();

const frontendUrl = process.env.FRONTEND_URL;
const app = express();
app.use(cors({
  origin: frontendUrl
}));
app.use(express.json());

// Get environment variables
const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const redirectUri = process.env.REDIRECT_URI; 
let token = null;

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const messages = [];

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

function setAccessToken(newToken) {
    token = newToken;
}

function getAccessToken() {
    return token;
}


// Tools
const getSpotifyAccessToken = async () => {
  const state = Math.random().toString(36).substring(2, 15);
  const client_id = process.env.CLIENT_ID;  
  const scope = "user-read-private user-read-email user-modify-playback-state";
  const authorizeUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${client_id}&scope=${scope}&redirect_uri=${redirectUri}&state=${state}`;
  return authorizeUrl;
};

const searchArtist = async (artist, accessToken) => {
  try {
    const searchResponse = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(artist)}&type=artist&limit=1`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    const searchData = await searchResponse.json();
    if (!searchData.artists.items.length) {
      throw new Error("Artist not found");
    }

    return searchData.artists.items[0].id;
  } catch (error) {
    console.error("Error searching for artist:", error);
    throw error;
  }
};

const getArtistTopTracks = async (artistId, limit, accessToken) => {
  try {
    const tracksResponse = await fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    const tracksData = await tracksResponse.json();
    return tracksData.tracks.slice(0, limit);
  } catch (error) {
    console.error("Error fetching artist's top tracks:", error);
    throw error;
  }
};

const getSongsByArtist = async (artist, limit, accessToken) => {
  try {
    if(!accessToken){
      return "Invalid access token";
    }
    const artistId = await searchArtist(artist, accessToken);
    const tracks = await getArtistTopTracks(artistId, limit, accessToken);
    return tracks;
  } catch (error) {
    console.error("Error in getSongsByArtist:", error);
    return error;
  }
};

const getSongByGenre = async (genre,limit,accessToken) => {
  try{
    const response = await fetch(`https://api.spotify.com/v1/search?q=${genre}&type=track&limit=${limit}`,{
        headers: {
            'Authorization': `Bearer ${accessToken}`
    }
    });
    const data = await response.json();
    return data;
  }catch(error){
    console.error("Error fetching songs by genre:", error);
    return error;
  }
};
const getSongByName = async (songName,accessToken) => {
  try{
    const response = await fetch(`https://api.spotify.com/v1/search?q=${songName}&type=track`,{
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    const data = await response.json();
    return data;
  }catch(error){
    console.error("Error fetching songs by name:", error);
    return error;
  }
};
const getSongsByAlbum = async (album,limit,accessToken) => {
  try{
    const response = await fetch(`https://api.spotify.com/v1/search?q=${album}&type=album&limit=${limit}`,{
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    const data = await response.json();
    return data;
  }catch(error){
    console.error("Error fetching songs by album:", error);
    return error;
  }
};

const addToQueue = async (songId, accessToken) => {
  try {
    const trackUri = `spotify:track:${songId}`;
    const response = await fetch(`https://api.spotify.com/v1/me/player/queue?uri=${trackUri}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    if (response.status === 200) {
      return { success: true };
    } else {
      const errorData = await response.json();
      console.error('Failed to add to queue:', errorData);
      throw new Error(errorData.error?.message || 'Unknown error while adding to queue');
    }
  } catch (error) {
    console.error("Error adding to queue:", error);
    throw error;
  }
};

const tools = {
    getSongsByArtist: getSongsByArtist,
    getSongByGenre: getSongByGenre,
    getSongsByAlbum: getSongsByAlbum,
    getSongByName: getSongByName,
    addToQueue: addToQueue
}

app.get("/login", async (req, res) => {
    const authorizeUrl = await getSpotifyAccessToken();
    res.json({ url: authorizeUrl });
});

app.get('/token', (req, res) => {
    if (token) {
      res.json({ token });
    } else {
      res.status(404).json({ error: 'Token not available' });
    }
  });

app.get('/callback', async function(req, res) {
  const code = req.query.code || null;
  const state = req.query.state || null;

  if (state === null) {
    res.redirect('/#' + querystring.stringify({ error: 'state_mismatch' }));
    return;
  }

  const body = new URLSearchParams({
    code: code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });

  const authHeader = 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64');

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': authHeader
      },
      body: body.toString()
    });

    const data = await response.json();
    token = data.access_token;
    setAccessToken(token);
    // Redirect to frontend app with token
    res.redirect(`${frontendUrl}/app?token=${data.access_token}`);
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    res.redirect(`${frontendUrl}/login?error=auth_failed`);
  }
});

app.get('/', (req, res) => {
    res.send('Hello from your Spotify AI agent');
});

app.post('/chat', async (req, res) => {
  try {
    const { query, token: userToken, messages: conversationHistory } = req.body;
    
    if (!userToken) {
      return res.status(401).json({ error: 'No access token provided' });
    }

    const userQuery = {
      type: "user",
      user: query
    };

    // If we have conversation history, use it
    if (conversationHistory && conversationHistory.length > 0) {
      messages.length = 0; // Clear existing messages
      conversationHistory.forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          parts: [{ text: JSON.stringify(msg.role === 'user' ? { type: "user", user: msg.content } : { type: "output", message: msg.content }) }]
        });
      });
    }

    messages.push({
      role: "user",
      parts: [{ text: JSON.stringify(userQuery) }]
    });

    let finalResponse = null;
    let shouldContinue = true;
    
    while (shouldContinue) {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: messages,
        config: {
          systemInstruction: SYSTEM_PROMPT
        },
      });
      // console.log(SYSTEM_PROMPT)
      const geminiText = response?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!geminiText) {
        throw new Error("No valid Gemini response");
      }

      const action = cleanJsonResponse(geminiText);
      if (!action) {
        throw new Error("Invalid action format");
      }

      messages.push({
        role: "assistant",
        parts: [{ text: JSON.stringify(action) }]
      });

      if (action.type === "output") {
        finalResponse = action.message;
        shouldContinue = false;
      } else if (action.type === "plan") {
        messages.push({
          role: "user",
          parts: [{ text: JSON.stringify({ type: "user", user: "continue" }) }]
        });
      } else if (action.type === "tool") {
        const fn = tools[action.name];
        if (!fn) {
          throw new Error("Invalid tool call");
        }

        const args = Object.values(action.args);
        if (action.name === "addToQueue" && args[0]) {
          const songId = args[0];
          if (songId.startsWith('spotify:track:')) {
            args[0] = songId.split('spotify:track:')[1];
          }
        }

        const observation = await fn(...args, userToken);
        
        if (observation === "Invalid access token") {
          return res.json({ response: "Access token expired. Please visit logout and login again to get a fresh access token." });
        }

        const observationMessage = {
          type: 'observation',
          message: `summarize the json response ${JSON.stringify(observation)} by song name and its url in a concise manner`
        };
        messages.push({ role: 'user', parts: [{ text: JSON.stringify(observationMessage) }] });
      
      }
    }

    res.json({ response: finalResponse });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(8000, () => {
    console.log("Server is running on port 8000");
});

export { tools, getAccessToken}; 