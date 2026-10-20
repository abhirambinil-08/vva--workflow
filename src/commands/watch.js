import { getRepoRoot, execGit } from '../core/git.js';
import { reportCommand } from './report.js';

/**
 * Watcher daemon that monitors Git HEAD ref updates.
 */
export async function watchCommand(options = {}, cwd = process.cwd(), onCommitDetected) {
  const root = await getRepoRoot(cwd);
  let lastKnownCommit = null;

  try {
    lastKnownCommit = await execGit(['rev-parse', 'HEAD'], root);
  } catch {
    //
  }

  const pollIntervalMs = options.intervalMs || 4000;
  let isRunning = true;

  const intervalId = setInterval(async () => {
    if (!isRunning) return;
    try {
      const currentCommit = await execGit(['rev-parse', 'HEAD'], root);
      if (currentCommit && currentCommit !== lastKnownCommit) {
        lastKnownCommit = currentCommit;
        if (onCommitDetected) {
          onCommitDetected(currentCommit);
        } else {
          console.log(`[vva watch] New commit detected: ${currentCommit.slice(0, 7)}. Generating reports...`);
          await reportCommand({ commit: currentCommit, format: options.format || 'all' }, root);
        }
      }
    } catch {
      //
    }
  }, pollIntervalMs);

  return {
    stop: () => {
      isRunning = false;
      clearInterval(intervalId);
    }
  };
}
