-- Spotify Agent — Supabase / Postgres schema
-- Run in the Supabase SQL editor (or psql). Safe to re-run.

create extension if not exists "pgcrypto";

-- Users: one row per Spotify account (created on first OAuth login).
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  spotify_id text unique not null,
  email text,
  display_name text,
  avatar_url text,
  country text,
  product text,
  spotify_access_token text,          -- encrypted (AES-256-GCM) app-side
  spotify_refresh_token text,         -- encrypted
  spotify_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Per-user LLM provider choice + encrypted API key (bring-your-own-key).
create table if not exists public.user_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  provider text not null default 'gemini',
  model text,
  api_key_enc text,                   -- encrypted
  has_key boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Chat history per user.
create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_user_time_idx
  on public.chat_messages (user_id, created_at);

-- All access goes through the backend service-role key, so RLS stays enabled
-- with no public policies (locks out anon/browser clients).
alter table public.users enable row level security;
alter table public.user_settings enable row level security;
alter table public.chat_messages enable row level security;
