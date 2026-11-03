import { useCallback, useEffect, useState } from 'react';
import type { DemoState } from './types';
import type { Backend, CommandResult } from './backend/types';
import type { Command } from './logic';

export interface AppStore {
  backend: Backend;
  state: DemoState;
  /** `quiet`: the caller shows the result itself, so skip the page-wide alert. */
  dispatch: (cmd: Command, opts?: { quiet?: boolean }) => Promise<CommandResult>;
  /** The last failed action or load, for the page-wide alert. */
  problem: string | null;
  clearProblem: () => void;
}

/** Keeps the screens in sync with whichever backend is in use. Returns null until the first load. */
export function useAppStore(backend: Backend): AppStore | null {
  const [state, setState] = useState<DemoState | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => backend.subscribe(setState, setProblem), [backend]);

  const dispatch = useCallback(
    async (cmd: Command, opts?: { quiet?: boolean }) => {
      const result = await backend.dispatch(cmd);
      if (!result.ok && result.message && !opts?.quiet) setProblem(result.message);
      return result;
    },
    [backend]
  );
  const clearProblem = useCallback(() => setProblem(null), []);

  return state ? { backend, state, dispatch, problem, clearProblem } : null;
}
