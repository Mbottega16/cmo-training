export type Role = 'coach' | 'player';

export interface Player {
  id: string;
  name: string;
  level: string; // Flexible/customizable, e.g. "Prep / Division 1 Target", "Overseas Pro"
  focusAreas: string[]; // General basketball focus tags
  creditsRemaining: number;
  avatar: string;
  phone: string;
  email: string;
}

export interface TrainingSession {
  id: string;
  title: string;
  courtLocation: string;
  courtAddress: string;
  startTime: string; // ISO string or display time
  endTime: string;
  type: 'one_on_one' | 'small_group' | 'virtual_live';
  maxCapacity: number;
  enrolledPlayerIds: string[];
  price: number;
  isVirtual?: boolean;
}

export interface Booking {
  id: string;
  sessionId: string;
  playerId: string;
  status: 'confirmed' | 'attended' | 'cancelled_early' | 'cancelled_late' | 'excused';
  bookedAt: string;
  cancelledAt?: string;
  graceExpiresAt?: string;
  hoursUntilSessionAtCancellation?: number;
}

export interface FilmReview {
  id: string;
  playerId: string;
  title: string;
  videoUrl: string;
  uploadedAt: string;
  notes: { timestamp: number; text: string; author: string }[];
  voiceNotes: { id: string; duration: number; url?: string; timestamp: number }[];
  drawingStrokes: any[];
}

export interface HomeworkAssignment {
  id: string;
  playerId: string;
  title: string;
  category: string;
  repsOrMinutes: string;
  notes: string;
  assignedDate: string;
  completed: boolean;
}
