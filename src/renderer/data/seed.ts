export type Cue = {
  id: string;
  number: number;
  title: string;
  durationLabel?: string;
  subtitle?: string;
  notes?: string;
  mediaPath?: string;
  toneHz?: number;
  gainDb?: number;
  pan?: number;
};

export type Pad = {
  id: string;
  label: string;
  mediaPath?: string;
};

export type Show = {
  id: string;
  title: string;
  subtitle: string;
  cues: Cue[];
  pads: Pad[];
};

export const seededShows: Show[] = [
  {
    id: 'tone-test',
    title: 'Tone Test',
    subtitle: '8 cues, — total / 0 hits',
    cues: [
      { id: 't1', number: 1, title: 'A3 — 220 Hz', toneHz: 220, gainDb: 0, pan: 0 },
      { id: 't2', number: 2, title: 'A4 — 440 Hz', toneHz: 440, gainDb: 0, pan: 0 },
      { id: 't3', number: 3, title: 'C5 — 523.25 Hz', toneHz: 523.25, gainDb: 0, pan: 0 },
      { id: 't4', number: 4, title: 'E5 — 659.25 Hz', toneHz: 659.25, gainDb: 0, pan: 0 },
      { id: 't5', number: 5, title: 'A5 — 880 Hz', toneHz: 880, gainDb: 0, pan: 0 },
      { id: 't6', number: 6, title: '1 kHz — 1000 Hz', toneHz: 1000, gainDb: 0, pan: 0 },
      { id: 't7', number: 7, title: '2 kHz — 2000 Hz', toneHz: 2000, gainDb: 0, pan: 0 },
      { id: 't8', number: 8, title: 'Low — 110 Hz', toneHz: 110, gainDb: 0, pan: 0 },
    ],
    pads: [],
  },
  {
    id: 'tatavla',
    title: "Tatavla’da Son Dans",
    subtitle: '21 cues, 36:14 total / 1 hit',
    cues: [
      { id: 'c1', number: 1, title: '0 - Shirley 10 dakika Anonsu', durationLabel: '-00:04,8', gainDb: 0, pan: 0 },
      { id: 'c2', number: 2, title: '0.1 - Shirley 5 dakika Anonsu', durationLabel: '-00:05,0', gainDb: 0, pan: 0 },
      { id: 'c3', number: 3, title: '0.2 Shirley 1.Perde Anons', durationLabel: '-00:14,8', gainDb: 0, pan: 0 },
      { id: 'c4', number: 4, title: '1-Giriş Eleni ve Gül', durationLabel: '-03:03,3', gainDb: 0, pan: 0 },
      { id: 'c5', number: 5, title: '2-İnşaat Ses Efekti', durationLabel: '-02:01,9', gainDb: 0, pan: 0 },
      { id: 'c6', number: 6, title: '3-yağma uzatılmış Demans', durationLabel: '-01:00,7', gainDb: 0, pan: 0 },
      { id: 'c7', number: 7, title: '4-Çay Demans', durationLabel: '-01:00,7', gainDb: 0, pan: 0 }
    ],
    pads: [{ id: 'p1', label: 'Applause' }],
  },
  {
    id: 'hamlet-tech',
    title: 'Hamlet (Tech)',
    subtitle: '12 cues, 18:02 total / 6 hits',
    cues: [
      { id: 'h1', number: 1, title: 'House to Half', durationLabel: '-00:20,0', gainDb: 0, pan: 0 },
      { id: 'h2', number: 2, title: 'Half to Blackout', durationLabel: '-00:05,0', gainDb: 0, pan: 0 },
      { id: 'h3', number: 3, title: 'Storm Ambience (Loop)', durationLabel: '-05:00,0', gainDb: 0, pan: 0 },
      { id: 'h4', number: 4, title: 'Door Knock (3x)', durationLabel: '-00:03,0', gainDb: 0, pan: 0 },
      { id: 'h5', number: 5, title: 'Footsteps Corridor', durationLabel: '-00:12,0', gainDb: 0, pan: 0 },
      { id: 'h6', number: 6, title: 'Underscore: Soliloquy', durationLabel: '-02:30,0', gainDb: 0, pan: 0 },
    ],
    pads: [
      { id: 'hp1', label: 'Applause' },
      { id: 'hp2', label: 'Thunder' },
      { id: 'hp3', label: 'Phone Buzz' },
      { id: 'hp4', label: 'Glass Break' },
    ],
  },
  {
    id: 'macbeth-show',
    title: 'Macbeth (Show)',
    subtitle: '28 cues, 42:10 total / 10 hits',
    cues: [
      { id: 'm1', number: 1, title: 'Preset: Wind Low', durationLabel: '-01:30,0', gainDb: 0, pan: 0 },
      { id: 'm2', number: 2, title: 'Cue 2: Witch Stinger', durationLabel: '-00:02,5', gainDb: 0, pan: 0 },
      { id: 'm3', number: 3, title: 'Scene 1 Underscore', durationLabel: '-03:10,0', gainDb: 0, pan: 0 },
      { id: 'm4', number: 4, title: 'Transition: Drum Pulse', durationLabel: '-00:18,0', gainDb: 0, pan: 0 },
      { id: 'm5', number: 5, title: 'Dagger Echo', durationLabel: '-00:04,0', gainDb: 0, pan: 0 },
    ],
    pads: [
      { id: 'mp1', label: 'Knife' },
      { id: 'mp2', label: 'Crow' },
      { id: 'mp3', label: 'Thunder' },
      { id: 'mp4', label: 'Scream' },
    ],
  },
  {
    id: 'demo-sfx',
    title: 'Demo: SFX Board',
    subtitle: '0 cues, 0:00 total / 12 hits',
    cues: [],
    pads: [
      { id: 'd1', label: 'Applause' },
      { id: 'd2', label: 'Boo' },
      { id: 'd3', label: 'Door Slam' },
      { id: 'd4', label: 'Footsteps' },
      { id: 'd5', label: 'Rain' },
      { id: 'd6', label: 'Thunder' },
    ],
  },
];
