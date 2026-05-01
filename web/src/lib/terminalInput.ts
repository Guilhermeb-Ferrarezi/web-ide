export type TerminalInputState = {
  history: string[];
  historyIndex: number | null;
  draft: string;
  browsingDraft: string;
};

export type TerminalInputResult = {
  nextState: TerminalInputState;
  outbound: string | null;
};

export function createTerminalInputState(): TerminalInputState {
  return {
    history: [],
    historyIndex: null,
    draft: '',
    browsingDraft: '',
  };
}

function replaceCurrentLine(nextState: TerminalInputState, value: string): TerminalInputResult {
  return {
    nextState: {
      ...nextState,
      draft: value,
    },
    outbound: `\u0015${value}`,
  };
}

export function reduceTerminalInput(state: TerminalInputState, data: string): TerminalInputResult {
  if (data === '\r') {
    const command = state.draft.trim();
    return {
      nextState: {
        history: command ? [...state.history, command] : state.history,
        historyIndex: null,
        draft: '',
        browsingDraft: '',
      },
      outbound: data,
    };
  }

  if (data === '\u0003') {
    return {
      nextState: {
        ...state,
        historyIndex: null,
        draft: '',
        browsingDraft: '',
      },
      outbound: data,
    };
  }

  if (data === '\u007f') {
    return {
      nextState: {
        ...state,
        historyIndex: null,
        draft: state.draft.slice(0, -1),
      },
      outbound: data,
    };
  }

  if (data === '\u001b[A') {
    if (state.history.length === 0) {
      return { nextState: state, outbound: null };
    }

    const browsingDraft = state.historyIndex === null ? state.draft : state.browsingDraft;
    const nextIndex = state.historyIndex === null
      ? state.history.length - 1
      : Math.max(0, state.historyIndex - 1);
    const nextState = {
      ...state,
      historyIndex: nextIndex,
      browsingDraft,
    };
    return replaceCurrentLine(nextState, state.history[nextIndex] ?? '');
  }

  if (data === '\u001b[B') {
    if (state.historyIndex === null) {
      return { nextState: state, outbound: null };
    }

    if (state.historyIndex >= state.history.length - 1) {
      const nextState = {
        ...state,
        historyIndex: null,
      };
      return replaceCurrentLine(nextState, state.browsingDraft);
    }

    const nextIndex = state.historyIndex + 1;
    const nextState = {
      ...state,
      historyIndex: nextIndex,
    };
    return replaceCurrentLine(nextState, state.history[nextIndex] ?? '');
  }

  if (data.startsWith('\u001b')) {
    return {
      nextState: state,
      outbound: data,
    };
  }

  return {
    nextState: {
      ...state,
      historyIndex: null,
      draft: state.draft + data,
    },
    outbound: data,
  };
}
