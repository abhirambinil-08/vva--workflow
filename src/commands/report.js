import fs from 'node:fs/promises';
import path from 'node:path';
import { getRepoRoot } from '../core/git.js';
import { collectGitData } from '../core/collector.js';
import { invokePythonModule } from '../core/python.js';

export async function reportCommand(options = {}, cwd = process.cwd()) {
  const root = await getRepoRoot(cwd);
  const vvaDir = path.join(root, '.vva');
  const outputDir = path.join(vvaDir, 'output');
  const configFile = path.join(vvaDir, 'config.json');

  // 1. Ensure .vva is initialized
  let config = {};
  try {
    const rawConfig = await fs.readFile(configFile, 'utf8');
    config = JSON.parse(rawConfig);
  } catch {
    // Auto-create directory structure if running in uninitialized repo
    await fs.mkdir(outputDir, { recursive: true });
    config = { defaultFormat: 'all', maxDiffSizeBytes: 1048576 };
  }

  const targetCommit = options.commit || 'HEAD';
  const format = options.format || config.defaultFormat || 'all';

  // 2. Stage 1/4: Git Data Collection
  const projectData = await collectGitData(targetCommit, root, {
    maxDiffSizeBytes: config.maxDiffSizeBytes
  });

  const projectDataPath = path.join(outputDir, 'project-data.json');
  await fs.writeFile(projectDataPath, JSON.stringify(projectData, null, 2), 'utf8');

  if (options.dryRun) {
    return {
      dryRun: true,
      projectDataPath,
      analyzedCommit: projectData.analyzedCommit,
      changedFiles: projectData.changedFiles.length
    };
  }

  // 3. Stage 2/4: Invoke Python AI Engine
  const aiOutputPath = path.join(outputDir, 'ai-response.json');
  await invokePythonModule(
    'ai/ai_engine.py',
    ['--input', projectDataPath, '--output', aiOutputPath],
    root
  );

  // Validate that ai-response.json was created and is valid JSON
  let aiData;
  try {
    const rawAi = await fs.readFile(aiOutputPath, 'utf8');
    aiData = JSON.parse(rawAi);
    if (!aiData.title || !aiData.summary || !Array.isArray(aiData.technicalChanges)) {
      throw new Error('AI response JSON is missing required fields.');
    }
  } catch (err) {
    throw new Error(`AI Engine verification failed: ${err.message}`);
  }

  // 4. Stage 3/4: Invoke Python Document Generation Engine
  const docResultRaw = await invokePythonModule(
    'document_engine/document_engine.py',
    [
      '--ai-input', aiOutputPath,
      '--project-input', projectDataPath,
      '--output-dir', outputDir,
      '--format', format
    ],
    root
  );

  let docResults = [];
  try {
    docResults = JSON.parse(docResultRaw);
  } catch {
    // If output contained non-JSON debug logs, check disk files
  }

  // 5. Verify generated files on disk
  const shortHash = projectData.analyzedCommit.slice(0, 7);
  const repoName = projectData.repository;
  const expectedFiles = [];

  if (format === 'pdf' || format === 'all') {
    expectedFiles.push(path.join(outputDir, `${repoName}_${shortHash}_report.pdf`));
  }
  if (format === 'docx' || format === 'all') {
    expectedFiles.push(path.join(outputDir, `${repoName}_${shortHash}_synopsis.docx`));
  }
  if (format === 'pptx' || format === 'all') {
    expectedFiles.push(path.join(outputDir, `${repoName}_${shortHash}_presentation.pptx`));
  }

  const verifiedFiles = [];
  for (const f of expectedFiles) {
    try {
      const stat = await fs.stat(f);
      verifiedFiles.push({
        path: f,
        filename: path.basename(f),
        sizeBytes: stat.size
      });
    } catch {
      // File was not generated
    }
  }

  return {
    success: true,
    repository: projectData.repository,
    analyzedCommit: projectData.analyzedCommit,
    commitMessage: projectData.commitMessage,
    projectDataPath,
    aiOutputPath,
    aiTitle: aiData.title,
    generatedFiles: verifiedFiles
  };
}
