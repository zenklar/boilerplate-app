"""
Run this script from your local machine to replace the placeholder covers
with real AI-generated images from Pollinations.ai (free, no API key needed).

Usage:
  cd assets/games
  python generate-ai-covers.py

Requirements:
  pip install requests pillow
"""

import os, time, urllib.parse
import requests
from PIL import Image
from io import BytesIO

W, H = 480, 640

GAMES = [
    ("asteroids",  "retro arcade game cover art, Asteroids 1979, lone spaceship surrounded by jagged asteroids in deep space, dramatic neon lighting, dark background, cinematic digital art, 4k"),
    ("invaders",   "retro arcade game cover art, Space Invaders 1978, army of pixel alien invaders descending from the sky, neon glow, dark night, classic arcade style, cinematic digital art"),
    ("pacman",     "retro arcade game cover art, Pac-Man 1980, yellow chomping character navigating a glowing neon maze, colorful ghosts chasing, dark background, vibrant neon, cinematic"),
    ("tetris",     "retro arcade game cover art, Tetris 1984, colorful geometric blocks falling and stacking, neon glow, dark space background, dramatic lighting, cinematic digital art"),
    ("centipede",  "retro arcade game cover art, Centipede 1980, giant glowing centipede winding through a mushroom field, dramatic lighting, dark green background, classic arcade, cinematic"),
    ("donkeykong", "retro arcade game cover art, Donkey Kong 1981, giant gorilla on steel construction girders throwing barrels, dramatic orange lighting, cinematic digital art, dark background"),
    ("galaga",     "retro arcade game cover art, Galaga 1981, space fighter ship battling formation of alien insect spacecraft, purple neon space background, cinematic, dramatic lighting"),
    ("frogger",    "retro arcade game cover art, Frogger 1981, cartoon frog dodging cars on a busy road and logs on a river, vibrant colors, dramatic lighting, cinematic arcade art"),
    ("breakout",   "retro arcade game cover art, Breakout 1976, neon ball smashing through colorful brick wall, glowing paddle, dark dramatic background, cinematic digital art, Atari style"),
]

def download_image(prompt: str, filename: str):
    encoded = urllib.parse.quote(prompt)
    url = f"https://image.pollinations.ai/prompt/{encoded}?width={W}&height={H}&nologo=true&seed=42"
    print(f"  Generating {filename}...")
    try:
        resp = requests.get(url, timeout=120)
        resp.raise_for_status()
        img = Image.open(BytesIO(resp.content)).convert("RGB")
        img = img.resize((W, H), Image.LANCZOS)
        img.save(filename, "PNG")
        print(f"  ✓ Saved {filename}")
        return True
    except Exception as e:
        print(f"  ✗ Failed {filename}: {e}")
        return False

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    for game_id, prompt in GAMES:
        out_path = os.path.join(script_dir, f"{game_id}.png")
        ok = download_image(prompt, out_path)
        if ok:
            time.sleep(2)   # be polite to the free API
    print("\nDone. Rebuild the app to see the new covers.")
