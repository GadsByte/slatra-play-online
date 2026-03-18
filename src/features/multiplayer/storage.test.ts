import { beforeEach, describe, expect, it } from 'vitest';
import { loadStoredIdentity, saveStoredIdentity } from './storage';

describe('multiplayer storage identity', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('preserves an existing session token when saving and loading identity', () => {
    saveStoredIdentity({ id: 'player-1', sessionToken: 'session-1', displayName: 'Alice' });

    expect(loadStoredIdentity()).toEqual({
      id: 'player-1',
      sessionToken: 'session-1',
      displayName: 'Alice',
    });
  });

  it('migrates stored identities without a session token', () => {
    window.localStorage.setItem('slatra.multiplayer.identity', JSON.stringify({
      id: 'player-legacy',
      displayName: 'Legacy',
    }));

    const identity = loadStoredIdentity();

    expect(identity?.id).toBe('player-legacy');
    expect(identity?.displayName).toBe('Legacy');
    expect(identity?.sessionToken).toMatch(/^session-/);
    expect(JSON.parse(window.localStorage.getItem('slatra.multiplayer.identity') ?? '{}').sessionToken).toBe(identity?.sessionToken);
  });

  it('promotes legacy display-name storage into the shared identity record', () => {
    window.localStorage.setItem('slatraDisplayName', 'Legacy Name');

    const identity = loadStoredIdentity();

    expect(identity).toEqual({
      id: 'player-legacy',
      sessionToken: expect.stringMatching(/^session-/),
      displayName: 'Legacy Name',
    });
    expect(JSON.parse(window.localStorage.getItem('slatra.multiplayer.identity') ?? '{}')).toEqual(identity);
  });
});
