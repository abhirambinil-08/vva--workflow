import fs from 'node:fs/promises';
import path from 'node:path';
import { isGitRepo, getRepoRoot, getCurrentBranch, execGit, getCommitDetails } from '../core/git.js';
import { getPythonBinary } from '../core/python.js';

export async function statusCommand(cwd = process.cwd()) {
  const isRepo = await isGitRepo(cwd);
  if (!isRepo) {
    return {
      isGitRepo: false,
      message: `Directory '${cwd}' is not inside a Git repository.`
    };
  }

  const root = await getRepoRoot(cwd);
  const branch = await getCurrentBranch(root);
  const configFile = path.join(root, '.vva', 'config.json');

  let isInitialized = false;
  let config = null;
  try {
    const raw = await fs.readFile(configFile, 'utf8');
    config = JSON.parse(raw);
    isInitialized = true;
  } catch {
    isInitialized = false;
  }

  let latestCommit = null;
  try {
    const headHash = await execGit(['rev-parse', 'HEAD'], root);
    latestCommit = await getCommitDetails(headHash, root);
  } catch {
    latestCommit = null; // Repo might have 0 commits
  }

  let uncommittedCount = 0;
  try {
    const statusRaw = await execGit(['status', '--porcelain'], root);
    uncommittedCount = statusRaw ? statusRaw.split('\n').filter(Boolean).length : 0;
  } catch {
    //
  }

  let pythonReady = false;
  let pythonBin = null;
  try {
    pythonBin = await getPythonBinary();
    pythonReady = true;
  } catch {
    pythonReady = false;
  }

  return {
    isGitRepo: true,
    repositoryName: path.basename(root),
    repositoryPath: root,
    branch,
    isInitialized,
    config,
    latestCommit,
    uncommittedCount,
    pythonReady,
    pythonBinary: pythonBin
  };
}
