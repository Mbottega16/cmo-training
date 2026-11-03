import type { DemoState, Booking, TrainingSession } from './types';

/** Bump when the saved shape changes; older saved data is replaced with a fresh seed. */
export const STATE_VERSION = 3;

/** Placeholder contact for the demo. Real coach details come from the backend later. */
export const COACH = {
  name: 'Coach',
  phone: '+15550001234',
  phoneLabel: '(555) 000-1234'
};

const HOUR = 3_600_000;
const MIN = 60_000;

/** Round up to the next half hour so demo times look like real bookings. */
function nextHalfHour(ms: number): number {
  const step = 30 * MIN;
  return Math.ceil(ms / step) * step;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/**
 * Made-up demo data with session times placed relative to `now`, so every rule can be
 * tried on any day: one session is live, one starts within 6 hours (a cancel there is
 * late), and the rest are further out (a cancel there restores the credit).
 */
export function createSeed(now: Date = new Date()): DemoState {
  const t = now.getTime();
  const liveStart = t - 15 * MIN;
  const soon = nextHalfHour(t + 4 * HOUR);
  const tomorrow = nextHalfHour(t + 22 * HOUR);
  const inTwoDays = nextHalfHour(t + 48 * HOUR);
  const inThreeDays = nextHalfHour(t + 72 * HOUR);

  const sessions: TrainingSession[] = [
    {
      id: 's1',
      title: 'Elite Guard Skills & Footwork',
      courtLocation: 'The Fieldhouse — Court 2',
      courtAddress: '420 Hoops Blvd, Metro City',
      start: iso(liveStart),
      end: iso(liveStart + 60 * MIN),
      type: 'small_group',
      maxCapacity: 6,
      price: 65
    },
    {
      id: 's2',
      title: 'Finishing & Contact Lab',
      courtLocation: 'Apex Athletics — Main Gym',
      courtAddress: '110 South Stadium Way',
      start: iso(soon),
      end: iso(soon + 60 * MIN),
      type: 'small_group',
      maxCapacity: 4,
      price: 65
    },
    {
      id: 's3',
      title: 'Live Virtual Film & Situational IQ',
      courtLocation: 'CMO Video Room',
      courtAddress: 'Online',
      start: iso(tomorrow),
      end: iso(tomorrow + 45 * MIN),
      type: 'virtual_live',
      maxCapacity: 1,
      price: 60
    },
    {
      id: 's4',
      title: 'Pick & Roll Reads Clinic',
      courtLocation: 'The Fieldhouse — Court 1',
      courtAddress: '420 Hoops Blvd, Metro City',
      start: iso(inTwoDays),
      end: iso(inTwoDays + 75 * MIN),
      type: 'small_group',
      maxCapacity: 6,
      price: 65
    },
    {
      id: 's5',
      title: 'Small Group Shooting Lab',
      courtLocation: 'St. Jude Community Center Court',
      courtAddress: '785 Oak Street',
      start: iso(inThreeDays),
      end: iso(inThreeDays + 75 * MIN),
      type: 'small_group',
      maxCapacity: 6,
      price: 65
    },
    {
      id: 's6',
      title: '1-on-1 Pro Finishing',
      courtLocation: 'Apex Athletics — Main Gym',
      courtAddress: '110 South Stadium Way',
      start: iso(inThreeDays + 2 * HOUR),
      end: iso(inThreeDays + 3 * HOUR),
      type: 'one_on_one',
      maxCapacity: 1,
      price: 120
    }
  ];

  const bookedAt = iso(t - 3 * 24 * HOUR);
  const booking = (id: string, sessionId: string, playerId: string, attendance: Booking['attendance'] = 'pending'): Booking => ({
    id,
    sessionId,
    playerId,
    status: 'confirmed',
    attendance,
    bookedAt
  });

  return {
    version: STATE_VERSION,
    seededAt: iso(t),
    players: [
      {
        id: 'p1',
        name: 'Jordan Cole',
        level: 'College Prep / HS Senior',
        focusAreas: ['Pick & Roll Reads', 'Mid-Range Pull-Up', 'Closeout Defense'],
        creditsRemaining: 4,
        xp: 1250,
        phone: '(555) 234-8901',
        email: 'jordan.cole@example.com'
      },
      {
        id: 'p2',
        name: 'Marcus Vance',
        level: 'NCAA D1 Guard',
        focusAreas: ['Deceleration Pace', 'Float Game', 'Lead Guard IQ'],
        creditsRemaining: 2,
        xp: 2100,
        phone: '(555) 876-5432',
        email: 'marcus.vance@example.com'
      },
      {
        id: 'p3',
        name: 'Tariq Sterling',
        level: 'Overseas Pro / Combo Guard',
        focusAreas: ['Screen Navigation', 'Catch & Shoot Deep 3s', 'Finishing Through Pads'],
        creditsRemaining: 6,
        xp: 3400,
        phone: '(555) 432-1098',
        email: 'tariq.s@example.com'
      },
      {
        id: 'p4',
        name: 'Devon Brooks',
        level: 'College Sophomore',
        focusAreas: ['Tight Handle Combos', 'Off-Foot Layups'],
        creditsRemaining: 1,
        xp: 600,
        phone: '(555) 345-6789',
        email: 'devon.b@example.com'
      }
    ],
    sessions,
    bookings: [
      booking('b1', 's1', 'p1', 'present'),
      booking('b2', 's1', 'p2'),
      booking('b3', 's1', 'p4'),
      booking('b4', 's2', 'p3'),
      booking('b5', 's2', 'p1'),
      booking('b6', 's3', 'p1'),
      booking('b7', 's5', 'p2')
    ],
    homework: [
      {
        id: 'h1',
        playerId: 'p1',
        title: 'Low-Dribble Pound Series & Decel Steps',
        category: 'Ball Handling',
        repsOrMinutes: '10 mins / 100 reps each side',
        notes: 'Focus on dropping your hips before the punch dribble.',
        assignedAt: iso(t - 2 * HOUR),
        completed: false
      },
      {
        id: 'h2',
        playerId: 'p1',
        title: '1-Dribble Pull-Up Balance (Off Left & Right)',
        category: 'Shooting Mechanics',
        repsOrMinutes: '50 makes',
        notes: 'Land on balance, do not fade backward on the jumper.',
        assignedAt: iso(t - 26 * HOUR),
        completed: true
      }
    ],
    films: [
      {
        id: 'f1',
        playerId: 'p1',
        title: 'Sample play — pick & roll (animated diagram)',
        videoUrl: './samples/pick-and-roll.mp4',
        uploadedAt: iso(t - 26 * HOUR),
        notes: [
          { id: 'n1', timestamp: 3.2, text: 'Defender is hedging hard. Snake back to the middle here instead of rejecting baseline.', author: 'Coach' },
          { id: 'n2', timestamp: 7.8, text: 'Great kick-out read to the weak-side corner shooter.', author: 'Coach' }
        ],
        voiceNotes: [],
        drawings: [
          {
            id: 'd1',
            timestamp: 3.2,
            strokes: [
              // Points match the sample clip at 3.2 s: the snake-back lane for 1, and X5's hard hedge.
              { id: 'st1', tool: 'arrow', color: '#facc15', points: [{ x: 0.49, y: 0.45 }, { x: 0.458, y: 0.65 }] },
              { id: 'st2', tool: 'circle', color: '#ef4444', points: [{ x: 0.479, y: 0.481 }, { x: 0.505, y: 0.481 }] }
            ]
          }
        ]
      }
    ],
    coachNotes: [
      { id: 'c1', playerId: 'p1', text: 'Focus on hip angle when breaking down off the catch.', createdAt: iso(t - 26 * HOUR) },
      { id: 'c2', playerId: 'p1', text: 'Eyes on the rim before deciding to pass.', createdAt: iso(t - 26 * HOUR) }
    ],
    notifyPrefs: {}
  };
}
