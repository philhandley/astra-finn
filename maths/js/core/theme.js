// Colours and fonts for JavaScript-drawn graphics (style v2: Synthesis-like white work surface).
// Keep in step with css/app.css. Widgets draw on a WHITE surface unless their meta says surface: 'dark'.

// Named palette. Use these names in tutor lines ("the red counters", "the green rods").
export const PAL = {
  red: '#ef4444', redDark: '#c62828',
  yellow: '#fbbf24', yellowDark: '#b7791f',
  blue: '#3b82f6', blueDark: '#1d4ed8',
  green: '#22a565', greenDark: '#15803d',
  orange: '#f97316', orangeDark: '#c2410c',
  pink: '#ec4899', pinkDark: '#be185d',
  purple: '#8b5cf6', purpleDark: '#6d28d9',
  teal: '#14b8a6', tealDark: '#0f766e',
};

export const COL = {
  // Place value, fixed app-wide (as Synthesis): ones blue, tens green, hundreds orange, thousands pink.
  ones: PAL.blue,
  tens: PAL.green,
  hundreds: PAL.orange,
  thousands: PAL.pink,
  // Two-colour counters (UK classroom double-sided counters): a = red, b = yellow.
  a: PAL.red,
  aDark: PAL.redDark,
  b: PAL.yellow,
  bDark: PAL.yellowDark,
  // Ink and lines on the white surface.
  ink: '#1b1e2e',
  ink2: '#4b5168',
  ink3: '#8b91a7',
  line: '#dfe3ec',
  lineStrong: '#c3c9d6',
  surface: '#ffffff',
  surface2: '#f4f6fb',   // soft fills: empty cells, trays, wells
  surface3: '#e9edf5',   // pressed or disabled fills
  // Feedback and highlights.
  good: '#22a565',
  goodSoft: '#e6f6ee',
  focus: '#3b82f6',      // selection outline
  focusSoft: '#e8f0fe',
  warn: '#f59e0b',
  bad: '#ef4444',        // never used for "wrong"; only as the red counter colour
  // Dark surfaces (Blaster, arcade games).
  dark: '#0b1020',
  darkInk: '#f3efe6',
  blast: '#4f9dff',
  grid: '#2a6f9a',
  // Back-compat names used by older code.
  panel: '#ffffff',
  panel2: '#f4f6fb',
};

// Fraction pieces: bold flat colours (purple, red, blue first, as in Synthesis).
export const FRAC = [PAL.purple, PAL.red, PAL.blue, PAL.orange, PAL.green, PAL.pink, PAL.teal, PAL.yellow];

export const FONT = {
  display: "'Lexend', system-ui, sans-serif",
  body: "'Lexend', system-ui, sans-serif",
};

// Sector accents (patches, tiles, runner accent).
export const SECTOR_COL = {
  launchpad: ['#38bdf8', '#bae6fd'],
  number: ['#22a565', '#bbf7d0'],
  bonds: ['#ef4444', '#fecaca'],
  blaster: ['#3b82f6', '#bfdbfe'],
  fractions: ['#8b5cf6', '#ddd6fe'],
  measure: ['#f59e0b', '#fde68a'],
  shape: ['#ec4899', '#fbcfe8'],
  data: ['#14b8a6', '#99f6e4'],
};
