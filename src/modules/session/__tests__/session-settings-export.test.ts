import { MATCHMAKING_FAIRNESS } from '@/config/matchmaking';
import { buildSessionSettingsSummary } from '@/modules/session/session-settings-export';
import { mergeAppSettings } from '@/types/app-data';

describe('session-settings-export', () => {
  it('builds a human-readable settings summary', () => {
    const settings = mergeAppSettings(undefined, 'Tuesday Host', {
      gameMode: 'dupr_open_play',
      courtFormat: 'doubles',
      matchMode: 'mixed_doubles',
      arrivalPenaltyEnabled: false,
      sessionStartTime: Date.parse('2026-06-26T18:00:00.000Z'),
      arrivalGraceMinutes: 15,
      lateMinutesWeight: 20,
      availableWaitWarnMinutes: 12,
      availableWaitCriticalMinutes: 18,
      courtCount: 4,
    });

    const summary = buildSessionSettingsSummary(settings);

    expect(summary.organizerName).toBe('Tuesday Host');
    expect(summary.gameMode).toBe('DUPR Open Play');
    expect(summary.gameModeId).toBe('dupr_open_play');
    expect(summary.courtFormat).toBe('Doubles');
    expect(summary.matchMode).toBe('Mix 1M+1F');
    expect(summary.penalizeLateArrivalsInFindMatch).toBe(false);
    expect(summary.sessionStartTime).toBe('2026-06-26T18:00:00.000Z');
    expect(summary.arrivalGraceMinutes).toBe(15);
    expect(summary.lateMinutesWeight).toBe(20);
    expect(summary.availableWaitWarnMinutes).toBe(12);
    expect(summary.availableWaitCriticalMinutes).toBe(18);
    expect(summary.autoRotationEnabled).toBeNull();
  });

  it('includes auto-rotation state for stack and ladder modes', () => {
    const settings = mergeAppSettings(undefined, 'Host', { gameMode: 'ladder_waterfall' });

    expect(
      buildSessionSettingsSummary(settings, {
        queue: [],
        activeMatches: [],
        completedMatches: [],
        rotationPaused: false,
      }).autoRotationEnabled
    ).toBe(true);

    expect(
      buildSessionSettingsSummary(settings, {
        queue: [],
        activeMatches: [],
        completedMatches: [],
      }).autoRotationEnabled
    ).toBe(false);
  });

  it('defaults arrival penalty to configured default when unset', () => {
    const settings = mergeAppSettings(undefined, 'Host');
    expect(buildSessionSettingsSummary(settings).penalizeLateArrivalsInFindMatch).toBe(
      MATCHMAKING_FAIRNESS.defaultArrivalPenaltyEnabled
    );
  });
});
