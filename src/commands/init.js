import fs from 'node:fs/promises';
import path from 'node:path';
import { isGitRepo, getRepoRoot } from '../core/git.js';
import { getPythonBinary } from '../core/python.js';

export async function initCommand(cwd = process.cwd()) {
  const isRepo = await isGitRepo(cwd);
  if (!isRepo) {
    throw new Error(`Cannot initialize VVA: directory '${cwd}' is not a Git repository. Run 'git init' first.`);
  }

  const root = await getRepoRoot(cwd);
  const vvaDir = path.join(root, '.vva');
  const logsDir = path.join(vvaDir, 'logs');
  const outputDir = path.join(vvaDir, 'output');
  const configFile = path.join(vvaDir, 'config.json');

  await fs.mkdir(vvaDir, { recursive: true });
  await fs.mkdir(logsDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });

  const pythonBin = await getPythonBinary();

  const defaultConfig = {
    vvaVersion: '1.0.0',
    initializedAt: new Date().toISOString(),
    defaultFormat: 'all',
    outputDir: '.vva/output',
    pythonBinary: pythonBin,
    aiProvider: 'nvidia',
    aiModel: 'meta/llama-3.1-70b-instruct',
    maxDiffSizeBytes: 1048576,
    team: {
      orchestrator: 'Abhiram Binil (Person 1)',
      aiEngine: 'Vishnu G Pillai (Person 2)',
      documentEngine: 'Vinay Bisht (Person 3)'
    }
  };

  await fs.writeFile(configFile, JSON.stringify(defaultConfig, null, 2), 'utf8');

  // Also ensure .gitignore ignores .vva logs and heavy artifacts if preferred
  return {
    success: true,
    root,
    vvaDir,
    config: defaultConfig
  };
}
