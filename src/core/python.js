import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs/promises';

const execFileAsync = promisify(execFile);

/**
 * Discovers the active Python binary (python3 or python).
 */
export async function getPythonBinary() {
  try {
    await execFileAsync('python3', ['--version']);
    return 'python3';
  } catch {
    try {
      await execFileAsync('python', ['--version']);
      return 'python';
    } catch {
      throw new Error('Python 3 is required but neither "python3" nor "python" was found in PATH.');
    }
  }
}

/**
 * Invokes a Python script with structured JSON arguments via IPC.
 * @param {string} scriptRelativePath Relative path from repo root (e.g., 'ai/ai_engine.py')
 * @param {string[]} args Array of command-line arguments
 * @param {string} cwd Working directory
 */
export async function invokePythonModule(scriptRelativePath, args = [], cwd = process.cwd()) {
  const pythonBin = await getPythonBinary();
  const scriptPath = path.resolve(cwd, scriptRelativePath);

  try {
    await fs.access(scriptPath);
  } catch {
    throw new Error(`Python module not found at: ${scriptPath}`);
  }

  try {
    const { stdout, stderr } = await execFileAsync(pythonBin, [scriptPath, ...args], {
      cwd,
      maxBuffer: 20 * 1024 * 1024,
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    if (stderr && stderr.trim().length > 0) {
      // Log warning if non-fatal
    }

    return stdout.trim();
  } catch (error) {
    throw new Error(`Python execution failed for ${scriptRelativePath}: ${error.stderr || error.message}`);
  }
}
