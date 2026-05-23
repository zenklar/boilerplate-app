# React Native Expo Boilerplate

A production-ready React Native boilerplate using Expo Router, Supabase authentication, Zustand state management, and a full theme system with light/dark mode.

## Stack

- **Framework**: Expo SDK 56 with Expo Router (file-based routing)
- **Auth**: Supabase Auth (OAuth via Google, Facebook, Apple)
- **Database**: Supabase (PostgreSQL)
- **State**: Zustand v5
- **Theme**: Custom theme system with AsyncStorage persistence
- **UI**: React Native core + @expo/vector-icons (Ionicons)

## Quick Start

```bash
# 1. Clone and install
git clone <your-repo>
cd boilerplate-app
npm install

# 2. Set up environment variables
cp .env.example .env
# Fill in your Supabase URL and anon key in .env

# 3. Run the app
npm run ios       # iOS simulator
npm run android   # Android emulator
npm run web       # Web browser
```

## Required Environment Variables

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

## Supabase Setup

### 1. Create a project at supabase.com

### 2. Enable OAuth providers (Authentication > Providers)
- Google: add your Google OAuth client ID and secret
- Facebook: add your Facebook App ID and secret
- Apple: add your Apple credentials

### 3. Run this SQL in the Supabase SQL Editor

```sql
-- Create profiles table
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  first_name text,
  last_name text,
  email text,
  subscription_status text default 'free',
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- Policies
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### 4. Set your app URL scheme in Supabase
In Authentication > URL Configuration, add your redirect URL:
```
boilerplate-app://
```

## Project Structure

```
app/
  _layout.tsx          # Root layout (ThemeProvider, SafeAreaProvider)
  index.tsx            # Auth gate — redirects to login or home
  (auth)/
    _layout.tsx        # Auth stack layout
    login.tsx          # Login screen
    signup.tsx         # Signup screen
  (app)/
    _layout.tsx        # Protected layout (AppHeader + BottomNav)
    home.tsx           # Home screen
    settings.tsx       # Settings screen

components/
  AppHeader.tsx        # Top header bar
  BottomNav.tsx        # Tab bar (Home, Settings)
  SocialButton.tsx     # OAuth button (Google / Facebook / Apple)
  settings/
    SettingsSection.tsx
    SettingsRow.tsx
    FaqAccordion.tsx
  modals/
    ChangePasswordModal.tsx
    LogoutModal.tsx
    DeleteAccountModal.tsx

constants/
  social.ts            # App name, slogan, social URLs, privacy policy URL

hooks/
  useAuth.ts           # Session management + profile fetching
  useSubscription.ts   # Subscription status helpers

lib/
  supabase.ts          # Supabase client

store/
  profileStore.ts      # Zustand profile store

theme/
  index.ts             # Full theme system (colors, spacing, fontSize, radius)
```

## Adding a New Screen

1. Create a file in `app/(app)/yourscreen.tsx`
2. Export a default React component
3. Navigate to it with `router.push('/(app)/yourscreen')`
4. Optionally add it as a tab in `components/BottomNav.tsx`

## Branding Customization

See `BRANDING.md` for the full checklist of files to update when starting a new project.

## Subscription Integration

The boilerplate includes a `subscription_status` field on profiles (`free`, `pro`, `cancelled`). To add real payments:

- **Stripe**: Use Stripe Customer Portal. Invoke from the "Manage Subscription" row in settings.
- **RevenueCat**: Replace the subscription row handler with RevenueCat's paywall SDK.

Update `store/profileStore.ts` if you need additional subscription states.
