import { splitTeams } from '@/lib/format-utils';
import { Player } from '@/types/player';
import { Match, QueueEntry } from '@/types/queue';

export interface TtsVoiceOption {
  voiceURI: string;
  name: string;
  lang: string;
  isDefault: boolean;
  isNetwork: boolean;
}

export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Strips HTML, emoji, and symbols so the announcer reads plain names only. */
export function stripTextForSpeech(str: unknown): string {
  if (str == null) return '';
  let t = String(str).replace(/<[^>]*>/g, '');
  try {
    t = t.replace(/\p{Extended_Pictographic}/gu, '');
  } catch {
    // Engines without Unicode property escapes: skip
  }
  t = t.replace(/[\uFE0E\uFE0F\u200D\uFEFF\u2060]/g, '');
  try {
    t = t.replace(
      /[^\p{L}\p{M}\p{N}\p{Zs}'\u00B4\u00B7\u2018\u2019\u2010-\u2014.\-]/gu,
      ' '
    );
  } catch {
    t = t.replace(/[!@#$%^&*()_+=[\]{}|;:",/<>?`~\\-]/g, ' ');
  }
  return t.replace(/[\s\u00A0]+/g, ' ').trim();
}

/** Normalize court labels for natural TTS ("1" → "Court 1", "Court 1" unchanged). */
export function formatCourtLabelForSpeech(rawLabel: string | undefined | null): string {
  const cleaned = stripTextForSpeech(rawLabel ?? '');
  if (!cleaned) return 'the court';
  if (/^\d+$/.test(cleaned)) return `Court ${cleaned}`;
  if (/\bcourt\b/i.test(cleaned)) return cleaned;
  return `Court ${cleaned}`;
}

function cleanPlayerName(player: Player | undefined): string {
  const text = stripTextForSpeech(player?.name ?? '');
  return text || 'Player';
}

function buildTeamsVersusSpeech(
  playerIds: string[],
  players: Player[],
  format: QueueEntry['format']
): { isSingles: boolean; text: string } {
  const { teamA, teamB } = splitTeams(playerIds);
  const teamAPlayers = teamA.map((id) => players.find((p) => p.id === id));
  const teamBPlayers = teamB.map((id) => players.find((p) => p.id === id));
  const isSingles = format === 'singles' || (teamA.length === 1 && teamB.length === 1);

  if (isSingles) {
    const a1 = cleanPlayerName(teamAPlayers[0]);
    const b1 = cleanPlayerName(teamBPlayers[0]);
    return { isSingles: true, text: `${a1}, versus, ${b1}` };
  }

  if (teamA.length < 1 || teamB.length < 1) {
    throw new Error('Cannot announce: match is missing player data.');
  }

  const a1 = cleanPlayerName(teamAPlayers[0]);
  const a2 = cleanPlayerName(teamAPlayers[1]);
  const b1 = cleanPlayerName(teamBPlayers[0]);
  const b2 = cleanPlayerName(teamBPlayers[1]);

  if (teamA.length === 1 && teamB.length >= 2) {
    return { isSingles: false, text: `${a1}, versus, ${b1} and ${b2}` };
  }
  if (teamA.length >= 2 && teamB.length === 1) {
    return { isSingles: false, text: `${a1} and ${a2}, versus, ${b1}` };
  }

  return { isSingles: false, text: `${a1} and ${a2}, versus, ${b1} and ${b2}` };
}

export function buildQueueAnnouncementText(
  entry: QueueEntry,
  position: number,
  players: Player[]
): string {
  const { isSingles, text } = buildTeamsVersusSpeech(entry.playerIds, players, entry.format);
  if (isSingles) {
    return `Next in queue, position ${position}. Singles. ${text}.`;
  }
  return `Next in queue, position ${position}. ${text}.`;
}

export function buildActiveMatchAnnouncementText(
  match: Match,
  courtLabel: string | undefined,
  players: Player[]
): string {
  const court = formatCourtLabelForSpeech(courtLabel);
  const { isSingles, text } = buildTeamsVersusSpeech(match.playerIds, players, match.format);
  if (isSingles) return `Singles on ${court}. ${text}.`;
  return `Match on ${court}. ${text}.`;
}

export function getAvailableTtsVoices(): TtsVoiceOption[] {
  if (!isTtsSupported()) return [];
  const voices = window.speechSynthesis.getVoices().slice();
  return voices
    .sort(
      (a, b) =>
        (a.lang || '').localeCompare(b.lang || '', undefined, { sensitivity: 'base' }) ||
        a.name.localeCompare(b.name)
    )
    .map((voice) => ({
      voiceURI: voice.voiceURI,
      name: voice.name || 'Voice',
      lang: voice.lang || '',
      isDefault: voice.default,
      isNetwork: voice.localService === false,
    }));
}

function resolveVoice(voiceUri?: string): SpeechSynthesisVoice | null {
  if (!isTtsSupported() || !voiceUri) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.voiceURI === voiceUri) ?? null;
}

export function speakText(text: string, voiceUri?: string): void {
  if (!isTtsSupported()) {
    throw new Error('Text to speech is not available in this browser.');
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.lang = document.documentElement.lang || 'en';

  const voice = resolveVoice(voiceUri);
  if (voice) {
    utterance.voice = voice;
    if (voice.lang) utterance.lang = voice.lang;
  }

  window.speechSynthesis.speak(utterance);
}

export function announceQueueEntry(
  entry: QueueEntry,
  position: number,
  players: Player[],
  voiceUri?: string
): void {
  const text = buildQueueAnnouncementText(entry, position, players);
  speakText(text, voiceUri);
}

export function announceActiveMatch(
  match: Match,
  courtLabel: string | undefined,
  players: Player[],
  voiceUri?: string
): void {
  const text = buildActiveMatchAnnouncementText(match, courtLabel, players);
  speakText(text, voiceUri);
}

export const TTS_TEST_PHRASE =
  'This is the Dink Syndicate announce voice. Next in queue, position one.';
