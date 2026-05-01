import { describe, expect, it } from 'bun:test';
import { createTerminalInputState, reduceTerminalInput } from './terminalInput';

describe('reduceTerminalInput', () => {
  it('stores non-empty commands in history on enter', () => {
    let state = createTerminalInputState();
    state = reduceTerminalInput(state, 'p').nextState;
    state = reduceTerminalInput(state, 'w').nextState;
    state = reduceTerminalInput(state, 'd').nextState;

    const result = reduceTerminalInput(state, '\r');

    expect(result.outbound).toBe('\r');
    expect(result.nextState.history).toEqual(['pwd']);
    expect(result.nextState.draft).toBe('');
  });

  it('recalls the previous command with arrow up', () => {
    const state = {
      history: ['pwd', 'ls'],
      historyIndex: null,
      draft: '',
      browsingDraft: '',
    };

    const result = reduceTerminalInput(state, '\u001b[A');

    expect(result.outbound).toBe('\u0015ls');
    expect(result.nextState.historyIndex).toBe(1);
    expect(result.nextState.draft).toBe('ls');
  });

  it('restores the in-progress draft with arrow down', () => {
    const state = {
      history: ['pwd', 'ls'],
      historyIndex: 1,
      draft: 'ls',
      browsingDraft: 'bun',
    };

    const result = reduceTerminalInput(state, '\u001b[B');

    expect(result.outbound).toBe('\u0015bun');
    expect(result.nextState.historyIndex).toBeNull();
    expect(result.nextState.draft).toBe('bun');
  });

  it('ignores arrow up when there is no history', () => {
    const result = reduceTerminalInput(createTerminalInputState(), '\u001b[A');

    expect(result.outbound).toBeNull();
    expect(result.nextState).toEqual(createTerminalInputState());
  });
});
