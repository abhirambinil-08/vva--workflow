#!/usr/bin/env node

import { initCommand } from './commands/init.js';
import { statusCommand } from './commands/status.js';
import { reportCommand } from './commands/report.js';
import { watchCommand } from './commands/watch.js';

const args = process.argv.slice(2);
const command = args[0]?.toLowerCase();

function printHelp() {
  console.log(`
VVA — Version & Workflow Automator [Node.js Orchestrator CLI v1.0.0]
Usage: vva <command> [options]

Commands:
  init                     Initialize .vva/ configuration and output directories
  status                   Inspect repository branch, active commit, and VVA status
  report [options]         Execute full pipeline: Git -> AI -> PDF/DOCX/PPTX
  watch                    Daemon mode: monitor Git commits and auto-generate reports
  help                     Show this help guide

Report Options:
  --commit <hash>          Specify target commit hash (default: HEAD)
  --format <pdf|docx|pptx|all> (default: all)
  --dry-run                Collect Git data only without invoking Python AI
`);
}

async function main() {
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    process.exit(0);
  }

  try {
    if (command === 'init') {
      const res = await initCommand();
      console.log(`\x1b[32m✓ VVA successfully initialized in ${res.root}\x1b[0m`);
      console.log(`  Created directory: .vva/`);
      console.log(`  Created config:    .vva/config.json`);
      console.log(`  Created output:    .vva/output/`);
      console.log(`\nRun 'vva status' to check environment or 'vva report' to generate documents.`);
      process.exit(0);
    }

    if (command === 'status') {
      const res = await statusCommand();
      if (!res.isGitRepo) {
        console.error(`\x1b[31mError: ${res.message}\x1b[0m`);
        process.exit(1);
      }

      console.log('\x1b[36m=== VVA Repository Status ===\x1b[0m');
      console.log(`Repository:      ${res.repositoryName} (${res.repositoryPath})`);
      console.log(`Current Branch:  ${res.branch}`);
      if (res.latestCommit) {
        console.log(`HEAD Commit:     ${res.latestCommit.shortHash} - "${res.latestCommit.message}"`);
        console.log(`Author:          ${res.latestCommit.author} <${res.latestCommit.email}>`);
        console.log(`Date:            ${res.latestCommit.date}`);
      } else {
        console.log(`HEAD Commit:     No commits found (empty repository)`);
      }
      console.log(`Working Tree:    ${res.uncommittedCount === 0 ? '\x1b[32mClean (0 uncommitted changes)\x1b[0m' : `\x1b[33m${res.uncommittedCount} uncommitted change(s)\x1b[0m`}`);
      console.log(`VVA Environment: ${res.isInitialized ? '\x1b[32mInitialized (.vva/)\x1b[0m' : '\x1b[33mNot initialized (run vva init)\x1b[0m'}`);
      console.log(`Python Runtime:  ${res.pythonReady ? `\x1b[32m${res.pythonBinary}\x1b[0m` : '\x1b[31mNot found\x1b[0m'}`);
      console.log('=============================');
      process.exit(0);
    }

    if (command === 'report') {
      const commitIndex = args.indexOf('--commit');
      const targetCommit = commitIndex !== -1 ? args[commitIndex + 1] : 'HEAD';

      const formatIndex = args.indexOf('--format');
      const format = formatIndex !== -1 ? args[formatIndex + 1] : 'all';

      const dryRun = args.includes('--dry-run');

      console.log(`\x1b[36m[Stage 1/4] Git Data Collector: Inspecting commit ${targetCommit}...\x1b[0m`);
      const res = await reportCommand({ commit: targetCommit, format, dryRun });

      if (res.dryRun) {
        console.log(`\x1b[32m✓ Dry-run completed. Saved project data to ${res.projectDataPath}\x1b[0m`);
        console.log(`  Analyzed commit: ${res.analyzedCommit.slice(0, 7)} (${res.changedFiles} files)`);
        process.exit(0);
      }

      console.log(`\x1b[32m✓ Pipeline Execution Succeeded!\x1b[0m`);
      console.log(`Repository:      ${res.repository}`);
      console.log(`Commit:          ${res.analyzedCommit.slice(0, 7)} ("${res.commitMessage}")`);
      console.log(`Feature Analyzed: "${res.aiTitle}"`);
      console.log(`Project Data:    ${res.projectDataPath}`);
      console.log(`AI Response:     ${res.aiOutputPath}`);
      console.log(`\n\x1b[32mGenerated Artifacts:\x1b[0m`);
      for (const f of res.generatedFiles) {
        console.log(`  → ${f.filename} (${(f.sizeBytes / 1024).toFixed(1)} KB) in ${f.path}`);
      }
      process.exit(0);
    }

    if (command === 'watch') {
      console.log('\x1b[36m[vva watch] Starting Git commit monitor daemon. Press Ctrl+C to exit.\x1b[0m');
      await watchCommand();
      // Keep process open
      return;
    }

    console.error(`\x1b[31mUnknown command: '${command}'. Type 'vva help' for usage.\x1b[0m`);
    process.exit(1);
  } catch (error) {
    console.error(`\x1b[31mError: ${error.message}\x1b[0m`);
    process.exit(1);
  }
}

main();
