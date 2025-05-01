# Spotify AI Agent

A conversational AI agent that helps users discover and play music on Spotify. The agent can search for songs by artist, genre, or album and add them to your Spotify queue.

## Features

- Search for songs by artist, genre, or album
- Add songs to your Spotify queue
- Conversational AI interface using Groq's LLM
- Spotify authentication integration
- Separate server and agent architecture for better maintainability

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Spotify Developer Account
- Groq API Key

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd spotify-agent
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
CLIENT_ID=your_spotify_client_id
CLIENT_SECRET=your_spotify_client_secret
REDIRECT_URI=http://localhost:8000/callback
GROQ_API_KEY=your_groq_api_key
```

4. Set up your Spotify Developer Application:
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Create a new application
   - Add `http://localhost:8000/callback` as a Redirect URI
   - Copy the Client ID and Client Secret to your `.env` file

## Running the Application

The application consists of two parts that need to be run separately:

1. Start the server:
```bash
npm run dev
```

2. In a new terminal, start the agent:
```bash
node agent.js
```

## Usage

1. When you first run the agent, you'll need to authenticate with Spotify:
   - Visit `http://localhost:8000/login` in your browser
   - Log in to your Spotify account and authorize the application

2. Once authenticated, you can interact with the agent using natural language:
   - "Find songs by Taylor Swift"
   - "Play some rock music"
   - "Search for albums by The Beatles"

3. The agent will:
   - Search for the requested music
   - Display the results
   - Ask if you want to add any songs to your queue

## Architecture

The application is split into two main components:

1. **Server (`server.js`)**:
   - Handles Spotify authentication
   - Manages access tokens
   - Provides API endpoints for Spotify operations
   - Exports tools for the agent to use

2. **Agent (`agent.js`)**:
   - Runs the conversational AI interface
   - Processes user queries
   - Uses Groq's LLM to understand and respond to requests
   - Communicates with the server to perform Spotify operations

## API Endpoints

- `GET /login`: Initiates Spotify authentication
- `GET /callback`: Handles Spotify OAuth callback
- `GET /token`: Returns the current access token
- `GET /`: Simple health check endpoint

## Error Handling

The application includes robust error handling:
- Invalid access tokens are detected and users are prompted to re-authenticate
- API errors are caught and displayed to the user
- JSON parsing errors are handled gracefully

## Limitations

- The agent is limited to searching for 3 songs at a time
- Spotify API rate limits apply
- The conversation history is limited to 10 messages to prevent token overflow

## Contributing

Feel free to submit issues and enhancement requests!
