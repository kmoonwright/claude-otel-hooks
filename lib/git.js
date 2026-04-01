import { execSync } from 'child_process';

export function gitBranch() {
  try { return execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['pipe','pipe','ignore'] }).toString().trim(); }
  catch { return 'unknown'; }
}
export function gitRepo() {
  try {
    const r = execSync('git remote get-url origin', { stdio: ['pipe','pipe','ignore'] }).toString().trim();
    return r.replace(/.*[:/]([^/]+\/[^/]+?)(\.git)?$/, '$1');
  } catch { return 'unknown'; }
}
