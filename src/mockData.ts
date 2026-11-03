import type { Player, TrainingSession, HomeworkAssignment, FilmReview } from './types';

export const INITIAL_PLAYERS: Player[] = [
  {
    id: 'p1',
    name: 'Jordan Cole',
    level: 'College Prep / HS Senior',
    focusAreas: ['Pick & Roll Reads', 'Mid-Range Pull-Up', 'Closeout Defense'],
    creditsRemaining: 4,
    avatar: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=150&auto=format&fit=crop&q=80',
    phone: '(555) 234-8901',
    email: 'jordan.cole@example.com'
  },
  {
    id: 'p2',
    name: 'Marcus Vance',
    level: 'NCAA D1 Guard',
    focusAreas: ['Deceleration Pace', 'Float Game', 'Lead Guard IQ'],
    creditsRemaining: 2,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    phone: '(555) 876-5432',
    email: 'marcus.vance@example.com'
  },
  {
    id: 'p3',
    name: 'Tariq Sterling',
    level: 'Overseas Pro / Combo Guard',
    focusAreas: ['Screen Navigation', 'Catch & Shoot Deep 3s', 'Finishing Through Pads'],
    creditsRemaining: 6,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    phone: '(555) 432-1098',
    email: 'tariq.s@example.com'
  },
  {
    id: 'p4',
    name: 'Devon Brooks',
    level: 'College Sophomore',
    focusAreas: ['Tight Handle Combos', 'Off-Foot Layups'],
    creditsRemaining: 1,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    phone: '(555) 345-6789',
    email: 'devon.b@example.com'
  }
];

export const INITIAL_SESSIONS: TrainingSession[] = [
  {
    id: 's1',
    title: 'Elite Guard Skills & Footwork',
    courtLocation: 'The Fieldhouse — Court 2',
    courtAddress: '420 Hoops Blvd, Metro City',
    startTime: 'Today, 4:00 PM',
    endTime: '5:00 PM',
    type: 'small_group',
    maxCapacity: 6,
    enrolledPlayerIds: ['p1', 'p2', 'p4'],
    price: 65,
    isVirtual: false
  },
  {
    id: 's2',
    title: '1-on-1 Pro Finishing & Contact',
    courtLocation: 'Apex Athletics — Main Gym',
    courtAddress: '110 South Stadium Way',
    startTime: 'Today, 5:30 PM',
    endTime: '6:30 PM',
    type: 'one_on_one',
    maxCapacity: 1,
    enrolledPlayerIds: ['p3'],
    price: 120,
    isVirtual: false
  },
  {
    id: 's3',
    title: 'Live Virtual Film & Situational IQ',
    courtLocation: 'CMO Live Video Room',
    courtAddress: 'Online / In-App Video',
    startTime: 'Tomorrow, 2:00 PM',
    endTime: '2:45 PM',
    type: 'virtual_live',
    maxCapacity: 1,
    enrolledPlayerIds: ['p1'],
    price: 60,
    isVirtual: true
  },
  {
    id: 's4',
    title: 'Small Group Shooting Lab (Max 6)',
    courtLocation: 'St. Jude Community Center Court',
    courtAddress: '785 Oak Street',
    startTime: 'Thursday, 6:00 PM',
    endTime: '7:15 PM',
    type: 'small_group',
    maxCapacity: 6,
    enrolledPlayerIds: ['p2'],
    price: 65,
    isVirtual: false
  }
];

export const INITIAL_HOMEWORK: HomeworkAssignment[] = [
  {
    id: 'h1',
    playerId: 'p1',
    title: 'Low-Dribble Pound Series & Decel Steps',
    category: 'Ball Handling',
    repsOrMinutes: '10 mins / 100 reps each side',
    notes: 'Focus on dropping your hips before the punch dribble.',
    assignedDate: 'Today',
    completed: false
  },
  {
    id: 'h2',
    playerId: 'p1',
    title: '1-Dribble Pull-Up Balance (Off Left & Right)',
    category: 'Shooting Mechanics',
    repsOrMinutes: '50 makes',
    notes: 'Land on balance, do not fade backward on the jumper.',
    assignedDate: 'Yesterday',
    completed: true
  }
];

export const SAMPLE_FILM_REVIEWS: FilmReview[] = [
  {
    id: 'f1',
    playerId: 'p1',
    title: 'HS Game Tape — 4th Quarter Pick & Roll Possession',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    uploadedAt: 'Nov 2, 2026',
    notes: [
      { timestamp: 3.2, text: 'Defender is hedging hard. Snake back to the middle here instead of rejecting baseline.', author: 'Coach' },
      { timestamp: 7.8, text: 'Great kick-out read to the weak-side corner shooter.', author: 'Coach' }
    ],
    voiceNotes: [
      { id: 'v1', duration: 14, timestamp: 3.2 }
    ],
    drawingStrokes: []
  }
];
