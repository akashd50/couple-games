import { Scene } from '../models/game.types';

// Hand-authored simple line-drawing reference scenes.
// Kept intentionally minimal so the describer can talk through them.
export const SCENES: Scene[] = [
  {
    id: 'house-sun',
    title: 'House with a Sun',
    svg: `
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="200" height="200" fill="#fffdf6"/>
        <circle cx="160" cy="40" r="20" fill="#ffd166" stroke="#e29a1d" stroke-width="2"/>
        <rect x="50" y="100" width="90" height="70" fill="#ffe0b3" stroke="#333" stroke-width="2"/>
        <polygon points="45,100 95,60 145,100" fill="#d96c4f" stroke="#333" stroke-width="2"/>
        <rect x="85" y="130" width="22" height="40" fill="#7a4a2b" stroke="#333" stroke-width="2"/>
        <rect x="60" y="115" width="18" height="18" fill="#bce0fa" stroke="#333" stroke-width="2"/>
        <rect x="115" y="115" width="18" height="18" fill="#bce0fa" stroke="#333" stroke-width="2"/>
        <line x1="0" y1="170" x2="200" y2="170" stroke="#3a8a3a" stroke-width="3"/>
      </svg>
    `,
  },
  {
    id: 'cat-face',
    title: 'Cat Face',
    svg: `
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#fff7fb"/>
        <polygon points="60,60 80,30 95,55" fill="#e7a4c4" stroke="#333" stroke-width="2"/>
        <polygon points="140,60 120,30 105,55" fill="#e7a4c4" stroke="#333" stroke-width="2"/>
        <circle cx="100" cy="110" r="55" fill="#f6c8de" stroke="#333" stroke-width="2"/>
        <circle cx="82" cy="100" r="6" fill="#222"/>
        <circle cx="118" cy="100" r="6" fill="#222"/>
        <polygon points="100,115 92,125 108,125" fill="#cc4477"/>
        <line x1="100" y1="125" x2="100" y2="135" stroke="#333" stroke-width="2"/>
        <path d="M100 135 Q92 142 86 135" stroke="#333" stroke-width="2" fill="none"/>
        <path d="M100 135 Q108 142 114 135" stroke="#333" stroke-width="2" fill="none"/>
        <line x1="60" y1="115" x2="40" y2="110" stroke="#333" stroke-width="2"/>
        <line x1="60" y1="120" x2="40" y2="125" stroke="#333" stroke-width="2"/>
        <line x1="140" y1="115" x2="160" y2="110" stroke="#333" stroke-width="2"/>
        <line x1="140" y1="120" x2="160" y2="125" stroke="#333" stroke-width="2"/>
      </svg>
    `,
  },
  {
    id: 'sailboat',
    title: 'Sailboat at Sea',
    svg: `
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#e6f2ff"/>
        <path d="M0 140 Q50 130 100 140 T200 140 V200 H0 Z" fill="#5fa8d3"/>
        <polygon points="100,40 100,120 60,120" fill="#fff" stroke="#333" stroke-width="2"/>
        <polygon points="105,55 140,120 105,120" fill="#ffd166" stroke="#333" stroke-width="2"/>
        <line x1="100" y1="40" x2="100" y2="120" stroke="#333" stroke-width="3"/>
        <polygon points="50,120 150,120 130,140 70,140" fill="#8b5a2b" stroke="#333" stroke-width="2"/>
        <circle cx="160" cy="40" r="14" fill="#ffe066" stroke="#e29a1d" stroke-width="2"/>
      </svg>
    `,
  },
  {
    id: 'ice-cream',
    title: 'Ice Cream Cone',
    svg: `
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#fff6f0"/>
        <circle cx="100" cy="80" r="35" fill="#ffb4a2" stroke="#333" stroke-width="2"/>
        <circle cx="80" cy="65" r="22" fill="#ffd6a5" stroke="#333" stroke-width="2"/>
        <circle cx="120" cy="65" r="22" fill="#caffbf" stroke="#333" stroke-width="2"/>
        <polygon points="60,110 140,110 100,180" fill="#deb887" stroke="#333" stroke-width="2"/>
        <line x1="75" y1="125" x2="115" y2="160" stroke="#333" stroke-width="1"/>
        <line x1="125" y1="125" x2="85" y2="160" stroke="#333" stroke-width="1"/>
        <circle cx="100" cy="45" r="6" fill="#ef476f" stroke="#333" stroke-width="2"/>
      </svg>
    `,
  },
  {
    id: 'flower',
    title: 'Smiling Flower',
    svg: `
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#f3fff0"/>
        <line x1="100" y1="100" x2="100" y2="190" stroke="#3a8a3a" stroke-width="4"/>
        <ellipse cx="80" cy="150" rx="20" ry="8" fill="#5cb85c" stroke="#333" stroke-width="2" transform="rotate(-25 80 150)"/>
        <ellipse cx="120" cy="160" rx="20" ry="8" fill="#5cb85c" stroke="#333" stroke-width="2" transform="rotate(25 120 160)"/>
        <circle cx="100" cy="60" r="20" fill="#ffd166" stroke="#333" stroke-width="2"/>
        <circle cx="70" cy="80" r="20" fill="#ef476f" stroke="#333" stroke-width="2"/>
        <circle cx="130" cy="80" r="20" fill="#ef476f" stroke="#333" stroke-width="2"/>
        <circle cx="100" cy="110" r="20" fill="#ef476f" stroke="#333" stroke-width="2"/>
        <circle cx="100" cy="85" r="18" fill="#fff3b0" stroke="#333" stroke-width="2"/>
        <circle cx="93" cy="82" r="2" fill="#222"/>
        <circle cx="107" cy="82" r="2" fill="#222"/>
        <path d="M93 92 Q100 98 107 92" stroke="#222" stroke-width="2" fill="none"/>
      </svg>
    `,
  },
];

export function getRandomScene(): Scene {
  return SCENES[Math.floor(Math.random() * SCENES.length)];
}

export function getSceneById(id: string | null | undefined): Scene | null {
  if (!id) return null;
  return SCENES.find((s) => s.id === id) ?? null;
}
