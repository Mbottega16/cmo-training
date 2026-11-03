export type Role = 'coach' | 'player';

export interface Player {
  id: string;
  name: string;
  level: string; // Free text on purpose, e.g. "Prep / Division 1 Target", "Overseas Pro"
  focusAreas: string[];
  creditsRemaining: number;
  xp: number;
  phone: string;
  email: string;
}

export type SessionType = 'one_on_one' | 'small_group' | 'virtual_live';

export interface TrainingSession {
  id: string;
  title: string;
  courtLocation: string;
  courtAddress: string;
  start: string; // ISO date-time
  end: string; // ISO date-time
  type: SessionType;
  maxCapacity: number;
  price: number;
}

export type BookingStatus =
  | 'confirmed'
  | 'cancelled_early' // 6+ hours' notice: credit restored
  | 'cancelled_late' // under 6 hours: credit held while the 24h grace window runs
  | 'excused' // coach waived a late cancel: credit restored
  | 'forfeited'; // coach enforced, or grace ran out: credit used

export type Attendance = 'pending' | 'present' | 'absent';

export interface Booking {
  id: string;
  sessionId: string;
  playerId: string;
  status: BookingStatus;
  attendance: Attendance;
  bookedAt: string;
  cancelledAt?: string;
  graceExpiresAt?: string;
  hoursNoticeAtCancel?: number;
  decidedAt?: string;
}

export interface HomeworkAssignment {
  id: string;
  playerId: string;
  title: string;
  category: string;
  repsOrMinutes: string;
  notes: string;
  assignedAt: string;
  completed: boolean;
}

/** Drawing coordinates are 0..1 of the video box, so they survive resizes and rotation. */
export interface Point {
  x: number;
  y: number;
}

export type DrawTool = 'pen' | 'arrow' | 'circle';

export interface Stroke {
  id: string;
  tool: DrawTool;
  color: string;
  points: Point[]; // pen: the path; arrow and circle: [start, end]
}

export interface DrawingFrame {
  id: string;
  timestamp: number;
  strokes: Stroke[];
}

export interface FilmNote {
  id: string;
  timestamp: number;
  text: string;
  author: string;
}

export interface VoiceNote {
  id: string;
  timestamp: number;
  duration: number;
  mediaKey: string; // key of the audio in this browser's media store
}

export interface FilmReview {
  id: string;
  playerId: string;
  title: string;
  videoUrl?: string; // a sample clip on the web
  videoKey?: string; // or a clip loaded from this device, kept in the media store
  uploadedAt: string;
  notes: FilmNote[];
  voiceNotes: VoiceNote[];
  drawings: DrawingFrame[];
}

export interface CoachNote {
  id: string;
  playerId: string;
  text: string;
  createdAt: string;
}

export interface NotifyPrefs {
  sms: boolean;
  email: boolean;
  push: boolean;
}

export interface DemoState {
  version: number;
  seededAt: string;
  players: Player[];
  sessions: TrainingSession[];
  bookings: Booking[];
  homework: HomeworkAssignment[];
  films: FilmReview[];
  coachNotes: CoachNote[];
  notifyPrefs: Record<string, NotifyPrefs>;
}
