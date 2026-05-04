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
  {
    id: 'heart-arrow',
    title: "Cupid's Heart",
    svg: `
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#fff0f3"/>
        <path d="M100 165 C 25 115, 30 50, 70 50 C 88 50, 100 65, 100 80 C 100 65, 112 50, 130 50 C 170 50, 175 115, 100 165 Z" fill="#ef476f" stroke="#333" stroke-width="2"/>
        <line x1="35" y1="65" x2="170" y2="135" stroke="#7a4a2b" stroke-width="3"/>
        <polygon points="170,135 156,128 162,142" fill="#7a4a2b" stroke="#333" stroke-width="2"/>
        <polygon points="35,65 25,60 30,72 22,74" fill="#7a4a2b" stroke="#333" stroke-width="2"/>
        <path d="M70 80 Q80 85 78 95" stroke="#fff" stroke-width="3" fill="none" opacity="0.7"/>
      </svg>
    `,
  },
  {
    id: 'love-birds',
    title: 'Love Birds on a Branch',
    svg: `
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#eaf6ff"/>
        <line x1="10" y1="140" x2="190" y2="135" stroke="#7a4a2b" stroke-width="5"/>
        <ellipse cx="35" cy="125" rx="12" ry="5" fill="#5cb85c" stroke="#333" stroke-width="1"/>
        <ellipse cx="170" cy="123" rx="12" ry="5" fill="#5cb85c" stroke="#333" stroke-width="1"/>
        <ellipse cx="75" cy="115" rx="22" ry="16" fill="#ffb4a2" stroke="#333" stroke-width="2"/>
        <circle cx="93" cy="105" r="10" fill="#ffb4a2" stroke="#333" stroke-width="2"/>
        <polygon points="103,107 112,106 103,112" fill="#ffd166" stroke="#333" stroke-width="1"/>
        <circle cx="95" cy="103" r="1.6" fill="#222"/>
        <line x1="70" y1="131" x2="68" y2="140" stroke="#333" stroke-width="2"/>
        <line x1="80" y1="131" x2="82" y2="140" stroke="#333" stroke-width="2"/>
        <ellipse cx="125" cy="115" rx="22" ry="16" fill="#a0c4ff" stroke="#333" stroke-width="2"/>
        <circle cx="107" cy="105" r="10" fill="#a0c4ff" stroke="#333" stroke-width="2"/>
        <polygon points="97,107 88,106 97,112" fill="#ffd166" stroke="#333" stroke-width="1"/>
        <circle cx="105" cy="103" r="1.6" fill="#222"/>
        <line x1="120" y1="131" x2="118" y2="140" stroke="#333" stroke-width="2"/>
        <line x1="130" y1="131" x2="132" y2="140" stroke="#333" stroke-width="2"/>
        <path d="M100 80 C 92 70, 80 78, 100 95 C 120 78, 108 70, 100 80 Z" fill="#ef476f" stroke="#333" stroke-width="1.5"/>
      </svg>
    `,
  },
  {
    id: 'hot-air-balloon',
    title: 'Hot Air Balloon',
    svg: `
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#cfe9ff"/>
        <ellipse cx="35" cy="50" rx="15" ry="7" fill="#fff" opacity="0.85"/>
        <ellipse cx="170" cy="40" rx="18" ry="8" fill="#fff" opacity="0.85"/>
        <ellipse cx="100" cy="80" rx="50" ry="58" fill="#ef476f" stroke="#333" stroke-width="2"/>
        <path d="M100 22 Q72 50 100 138" fill="none" stroke="#333" stroke-width="1"/>
        <path d="M100 22 Q128 50 100 138" fill="none" stroke="#333" stroke-width="1"/>
        <path d="M52 80 Q100 92 148 80" fill="none" stroke="#333" stroke-width="1"/>
        <line x1="65" y1="133" x2="82" y2="160" stroke="#333" stroke-width="2"/>
        <line x1="135" y1="133" x2="118" y2="160" stroke="#333" stroke-width="2"/>
        <line x1="100" y1="138" x2="100" y2="160" stroke="#333" stroke-width="2"/>
        <rect x="80" y="160" width="40" height="25" fill="#deb887" stroke="#333" stroke-width="2"/>
        <line x1="80" y1="170" x2="120" y2="170" stroke="#7a4a2b" stroke-width="1"/>
      </svg>
    `,
  },
  {
    id: 'picnic',
    title: 'Picnic Basket',
    svg: `
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#f3fff0"/>
        <line x1="0" y1="170" x2="200" y2="170" stroke="#3a8a3a" stroke-width="3"/>
        <rect x="20" y="130" width="160" height="50" fill="#ef476f" stroke="#333" stroke-width="2"/>
        <line x1="20" y1="148" x2="180" y2="148" stroke="#fff" stroke-width="1"/>
        <line x1="20" y1="164" x2="180" y2="164" stroke="#fff" stroke-width="1"/>
        <line x1="60" y1="130" x2="60" y2="180" stroke="#fff" stroke-width="1"/>
        <line x1="100" y1="130" x2="100" y2="180" stroke="#fff" stroke-width="1"/>
        <line x1="140" y1="130" x2="140" y2="180" stroke="#fff" stroke-width="1"/>
        <path d="M70 80 Q100 60 130 80" fill="none" stroke="#7a4a2b" stroke-width="3"/>
        <rect x="65" y="80" width="70" height="55" fill="#deb887" stroke="#333" stroke-width="2"/>
        <line x1="65" y1="98" x2="135" y2="98" stroke="#7a4a2b" stroke-width="1"/>
        <line x1="80" y1="80" x2="80" y2="135" stroke="#7a4a2b" stroke-width="1"/>
        <line x1="100" y1="80" x2="100" y2="135" stroke="#7a4a2b" stroke-width="1"/>
        <line x1="120" y1="80" x2="120" y2="135" stroke="#7a4a2b" stroke-width="1"/>
        <rect x="40" y="100" width="14" height="30" fill="#5cb85c" stroke="#333" stroke-width="1"/>
        <rect x="44" y="92" width="6" height="10" fill="#5cb85c" stroke="#333" stroke-width="1"/>
        <circle cx="160" cy="118" r="10" fill="#ef476f" stroke="#333" stroke-width="1"/>
        <line x1="160" y1="108" x2="160" y2="103" stroke="#7a4a2b" stroke-width="1.5"/>
        <ellipse cx="163" cy="105" rx="4" ry="2" fill="#5cb85c" stroke="#333" stroke-width="1"/>
      </svg>
    `,
  },
  {
    id: 'rose-vase',
    title: 'Rose in a Vase',
    svg: `
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#fff7fb"/>
        <path d="M70 120 L130 120 L120 185 L80 185 Z" fill="#a0c4ff" stroke="#333" stroke-width="2"/>
        <ellipse cx="100" cy="120" rx="30" ry="6" fill="#cfe9ff" stroke="#333" stroke-width="2"/>
        <line x1="100" y1="120" x2="100" y2="55" stroke="#3a8a3a" stroke-width="3"/>
        <ellipse cx="80" cy="100" rx="14" ry="6" fill="#5cb85c" stroke="#333" stroke-width="1" transform="rotate(-30 80 100)"/>
        <ellipse cx="118" cy="88" rx="12" ry="5" fill="#5cb85c" stroke="#333" stroke-width="1" transform="rotate(35 118 88)"/>
        <circle cx="100" cy="50" r="22" fill="#ef476f" stroke="#333" stroke-width="2"/>
        <circle cx="100" cy="50" r="14" fill="none" stroke="#a8324f" stroke-width="1.5"/>
        <circle cx="100" cy="50" r="7" fill="none" stroke="#a8324f" stroke-width="1.5"/>
        <path d="M88 42 Q100 32 112 42" fill="none" stroke="#a8324f" stroke-width="1.5"/>
      </svg>
    `,
  },
  {
    id: 'wine-cheers',
    title: 'Wine Glass Cheers',
    svg: `
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#fff3e8"/>
        <g transform="translate(70 90) rotate(-20)">
          <path d="M-26 -32 Q0 6 26 -32 Z" fill="#ef476f" stroke="#333" stroke-width="2"/>
          <line x1="0" y1="6" x2="0" y2="55" stroke="#333" stroke-width="2"/>
          <line x1="-16" y1="55" x2="16" y2="55" stroke="#333" stroke-width="2"/>
        </g>
        <g transform="translate(130 90) rotate(20)">
          <path d="M-26 -32 Q0 6 26 -32 Z" fill="#ef476f" stroke="#333" stroke-width="2"/>
          <line x1="0" y1="6" x2="0" y2="55" stroke="#333" stroke-width="2"/>
          <line x1="-16" y1="55" x2="16" y2="55" stroke="#333" stroke-width="2"/>
        </g>
        <line x1="100" y1="50" x2="100" y2="34" stroke="#ffd166" stroke-width="3"/>
        <line x1="84" y1="56" x2="73" y2="48" stroke="#ffd166" stroke-width="3"/>
        <line x1="116" y1="56" x2="127" y2="48" stroke="#ffd166" stroke-width="3"/>
        <circle cx="100" cy="62" r="3" fill="#ffd166"/>
      </svg>
    `,
  },
  {
    id: 'cupcake-heart',
    title: 'Cupcake with Heart',
    svg: `
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#fff7fb"/>
        <polygon points="60,120 140,120 130,185 70,185" fill="#ffd6a5" stroke="#333" stroke-width="2"/>
        <line x1="78" y1="120" x2="83" y2="185" stroke="#333" stroke-width="1"/>
        <line x1="100" y1="120" x2="100" y2="185" stroke="#333" stroke-width="1"/>
        <line x1="122" y1="120" x2="117" y2="185" stroke="#333" stroke-width="1"/>
        <path d="M55 122 Q60 95 78 100 Q82 78 100 84 Q118 78 122 100 Q140 95 145 122 Z" fill="#f6c8de" stroke="#333" stroke-width="2"/>
        <path d="M70 108 Q90 98 110 102" fill="none" stroke="#a8324f" stroke-width="1"/>
        <path d="M100 70 C 88 58, 72 72, 100 92 C 128 72, 112 58, 100 70 Z" fill="#ef476f" stroke="#333" stroke-width="2"/>
        <circle cx="80" cy="115" r="2" fill="#ffd166"/>
        <circle cx="120" cy="115" r="2" fill="#a0c4ff"/>
        <circle cx="100" cy="118" r="2" fill="#5cb85c"/>
        <circle cx="90" cy="112" r="1.5" fill="#fff"/>
        <circle cx="110" cy="112" r="1.5" fill="#fff"/>
      </svg>
    `,
  },
  {
    id: 'moon-stars',
    title: 'Crescent Moon and Stars',
    svg: `
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#1a1a3a"/>
        <path d="M125 35 A 65 65 0 1 0 125 165 A 48 48 0 1 1 125 35 Z" fill="#ffe066" stroke="#fff" stroke-width="1"/>
        <circle cx="108" cy="78" r="2" fill="#d9b94a"/>
        <circle cx="100" cy="108" r="1.6" fill="#d9b94a"/>
        <circle cx="115" cy="130" r="1.4" fill="#d9b94a"/>
        <polygon points="40,40 43,50 53,50 45,56 48,66 40,60 32,66 35,56 27,50 37,50" fill="#fff"/>
        <polygon points="170,150 172,158 180,158 174,162 176,170 170,166 164,170 166,162 160,158 168,158" fill="#fff"/>
        <polygon points="50,140 52,146 58,146 53,150 55,156 50,152 45,156 47,150 42,146 48,146" fill="#fff"/>
        <polygon points="160,55 162,61 168,61 163,65 165,71 160,67 155,71 157,65 152,61 158,61" fill="#fff"/>
        <circle cx="30" cy="100" r="1.5" fill="#fff"/>
        <circle cx="20" cy="170" r="1.2" fill="#fff"/>
        <circle cx="80" cy="175" r="1.5" fill="#fff"/>
        <circle cx="190" cy="100" r="1.2" fill="#fff"/>
      </svg>
    `,
  },
  {
    id: 'love-mailbox',
    title: 'Mailbox with Love Letter',
    svg: `
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#f3fff0"/>
        <line x1="0" y1="180" x2="200" y2="180" stroke="#3a8a3a" stroke-width="3"/>
        <rect x="92" y="120" width="16" height="60" fill="#7a4a2b" stroke="#333" stroke-width="2"/>
        <path d="M40 90 Q40 70 65 70 L160 70 L160 130 L40 130 Z" fill="#ef476f" stroke="#333" stroke-width="2"/>
        <line x1="40" y1="90" x2="160" y2="90" stroke="#333" stroke-width="1"/>
        <circle cx="55" cy="110" r="4" fill="#333"/>
        <line x1="160" y1="75" x2="160" y2="110" stroke="#333" stroke-width="2"/>
        <rect x="160" y="75" width="22" height="14" fill="#ffd166" stroke="#333" stroke-width="2"/>
        <rect x="75" y="30" width="60" height="40" fill="#fff" stroke="#333" stroke-width="2"/>
        <path d="M75 30 L105 55 L135 30" fill="none" stroke="#333" stroke-width="1.5"/>
        <path d="M105 50 C 95 40, 82 50, 105 68 C 128 50, 115 40, 105 50 Z" fill="#ef476f" stroke="#333" stroke-width="1.5"/>
      </svg>
    `,
  },
  {
    id: 'ferris-wheel',
    title: 'Ferris Wheel',
    svg: `
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#cfe9ff"/>
        <line x1="0" y1="180" x2="200" y2="180" stroke="#7a4a2b" stroke-width="3"/>
        <line x1="60" y1="180" x2="100" y2="100" stroke="#333" stroke-width="3"/>
        <line x1="140" y1="180" x2="100" y2="100" stroke="#333" stroke-width="3"/>
        <circle cx="100" cy="100" r="60" fill="none" stroke="#333" stroke-width="3"/>
        <line x1="100" y1="100" x2="100" y2="40" stroke="#333" stroke-width="1.5"/>
        <line x1="100" y1="100" x2="100" y2="160" stroke="#333" stroke-width="1.5"/>
        <line x1="100" y1="100" x2="40" y2="100" stroke="#333" stroke-width="1.5"/>
        <line x1="100" y1="100" x2="160" y2="100" stroke="#333" stroke-width="1.5"/>
        <line x1="100" y1="100" x2="58" y2="58" stroke="#333" stroke-width="1.5"/>
        <line x1="100" y1="100" x2="142" y2="142" stroke="#333" stroke-width="1.5"/>
        <line x1="100" y1="100" x2="142" y2="58" stroke="#333" stroke-width="1.5"/>
        <line x1="100" y1="100" x2="58" y2="142" stroke="#333" stroke-width="1.5"/>
        <circle cx="100" cy="100" r="6" fill="#ffd166" stroke="#333" stroke-width="2"/>
        <rect x="92" y="32" width="16" height="14" fill="#ef476f" stroke="#333" stroke-width="1.5"/>
        <rect x="92" y="158" width="16" height="14" fill="#a0c4ff" stroke="#333" stroke-width="1.5"/>
        <rect x="32" y="92" width="16" height="14" fill="#5cb85c" stroke="#333" stroke-width="1.5"/>
        <rect x="152" y="92" width="16" height="14" fill="#ffd166" stroke="#333" stroke-width="1.5"/>
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
