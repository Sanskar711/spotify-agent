import React, { useRef, useState } from 'react';
import api from '../utils/api';

interface ShazamButtonProps {
  // Called with a formatted message describing the recognized song.
  onResult: (message: string) => void;
}

const RECORD_MS = 8000; // ~8s clip is plenty for AudD

const ShazamButton: React.FC<ShazamButtonProps> = ({ onResult }) => {
  const [state, setState] = useState<'idle' | 'recording' | 'identifying'>('idle');
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const stop = () => {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.stop();
    }
    if (timerRef.current) window.clearTimeout(timerRef.current);
  };

  const identify = async (blob: Blob) => {
    setState('identifying');
    try {
      const form = new FormData();
      form.append('audio', blob, 'clip.webm');
      const res = await api.post('/recognize', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const r = res.data;
      if (!r.found) {
        onResult("I couldn't recognize that song. Try a clearer, louder clip.");
      } else {
        const link = r.spotifyUrl ? `\n${r.spotifyUrl}` : '';
        onResult(`🎵 Recognized: **${r.title}** — ${r.artist}${r.album ? ` (${r.album})` : ''}${link}`);
      }
    } catch {
      onResult('Recognition failed. Check the AudD configuration and try again.');
    } finally {
      setState('idle');
    }
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mediaRef.current = mr;
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        identify(blob);
      };
      mr.start();
      setState('recording');
      timerRef.current = window.setTimeout(stop, RECORD_MS);
    } catch {
      onResult('Microphone access denied. Enable it to use song recognition.');
      setState('idle');
    }
  };

  const label =
    state === 'recording' ? 'Listening… tap to stop' : state === 'identifying' ? 'Identifying…' : 'Identify song';

  return (
    <button
      onClick={state === 'recording' ? stop : state === 'idle' ? start : undefined}
      disabled={state === 'identifying'}
      title="Shazam-like recognition"
      className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded-full transition ${
        state === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-white/20 hover:bg-white/30'
      } disabled:opacity-60`}
    >
      🎤 {label}
    </button>
  );
};

export default ShazamButton;
