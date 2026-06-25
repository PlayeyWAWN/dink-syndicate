import {
  buildActiveMatchAnnouncementText,
  buildQueueAnnouncementText,
  formatCourtLabelForSpeech,
  stripTextForSpeech,
} from '@/lib/tts-service';
import { Player } from '@/types/player';
import { Match, QueueEntry } from '@/types/queue';

const players: Player[] = [
  {
    id: 'p1',
    name: 'Jenny',
    gender: 'female',
    excluded: false,
    checkedIn: true,
    gamesPlayed: 2,
    wins: 1,
    losses: 1,
    career: { gamesPlayed: 2, wins: 1, losses: 1 },
    dupr: { duprConnected: false, duprRatingSource: 'manual', duprDoublesRating: 2 },
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'p2',
    name: 'Carmen',
    gender: 'female',
    excluded: false,
    checkedIn: true,
    gamesPlayed: 1,
    wins: 0,
    losses: 1,
    career: { gamesPlayed: 1, wins: 0, losses: 1 },
    dupr: { duprConnected: false, duprRatingSource: 'manual', duprDoublesRating: 4 },
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'p3',
    name: 'Dottie',
    gender: 'female',
    excluded: false,
    checkedIn: true,
    gamesPlayed: 2,
    wins: 1,
    losses: 1,
    career: { gamesPlayed: 2, wins: 1, losses: 1 },
    dupr: { duprConnected: false, duprRatingSource: 'manual', duprDoublesRating: 2 },
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'p4',
    name: 'Jesse',
    gender: 'male',
    excluded: false,
    checkedIn: true,
    gamesPlayed: 1,
    wins: 1,
    losses: 0,
    career: { gamesPlayed: 1, wins: 1, losses: 0 },
    dupr: { duprConnected: false, duprRatingSource: 'manual', duprDoublesRating: 4 },
    createdAt: 1,
    updatedAt: 1,
  },
];

describe('stripTextForSpeech', () => {
  it('removes emoji and punctuation from player names', () => {
    expect(stripTextForSpeech('Jenny 😊!')).toBe('Jenny');
    expect(stripTextForSpeech('<b>Alice</b>')).toBe('Alice');
  });
});

describe('formatCourtLabelForSpeech', () => {
  it('prefixes pure numbers with Court', () => {
    expect(formatCourtLabelForSpeech('1')).toBe('Court 1');
  });

  it('leaves labels that already include court unchanged', () => {
    expect(formatCourtLabelForSpeech('Court 1')).toBe('Court 1');
    expect(formatCourtLabelForSpeech("Winner's Court")).toBe("Winner's Court");
  });
});

describe('buildActiveMatchAnnouncementText', () => {
  const match: Match = {
    id: 'm1',
    courtId: 'court-1',
    playerIds: ['p1', 'p2', 'p3', 'p4'],
    format: 'doubles',
    status: 'active',
    winnerPlayerIds: [],
    startedAt: Date.now(),
  };

  it('announces active doubles with smart court naming', () => {
    expect(buildActiveMatchAnnouncementText(match, '1', players)).toBe(
      "Match on Court 1. Jenny and Carmen, versus, Dottie and Jesse."
    );
    expect(buildActiveMatchAnnouncementText(match, "Winner's Court", players)).toBe(
      "Match on Winner's Court. Jenny and Carmen, versus, Dottie and Jesse."
    );
  });
});

describe('buildQueueAnnouncementText', () => {
  const entry: QueueEntry = {
    id: 'q1',
    playerIds: ['p1', 'p2', 'p3', 'p4'],
    format: 'doubles',
    createdAt: Date.now(),
  };

  it('builds doubles queue announcement', () => {
    expect(buildQueueAnnouncementText(entry, 1, players)).toBe(
      'Next in queue, position 1. Jenny and Carmen, versus, Dottie and Jesse.'
    );
  });

  it('builds singles queue announcement', () => {
    const singlesEntry: QueueEntry = {
      ...entry,
      format: 'singles',
      playerIds: ['p1', 'p3'],
    };
    expect(buildQueueAnnouncementText(singlesEntry, 2, players)).toBe(
      'Next in queue, position 2. Singles. Jenny, versus, Dottie.'
    );
  });
});
