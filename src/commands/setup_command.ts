import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * The main function for the `setup` command.
 *
 * This function is responsible for cloning a git repository into the `.repos`
 * directory. If the repository already exists, it will pull the latest
 * changes.
 *
 * @param repoUrl The URL of the git repository to clone.
 */
export async function setup(repoUrl: string) {
  const reposDir = path.join(process.cwd(), '.repos');

  if (!fs.existsSync(reposDir)) {
    fs.mkdirSync(reposDir);
  }

  const repoName = repoUrl.split('/').pop()?.replace('.git', '');
  if (!repoName) {
    console.error('Could not determine repository name from URL.');
    return;
  }

  const repoPath = path.join(reposDir, repoName);

  if (fs.existsSync(repoPath)) {
    console.log(`Repository ${repoName} already exists. Pulling latest changes...`);
    try {
      execSync(`git pull`, { cwd: repoPath, stdio: 'inherit' });
      console.log('Repository updated successfully.');
    } catch (error) {
      console.error(`Error pulling repository: ${error}`);
    }
    return;
  }

  console.log(`Cloning ${repoUrl} into ${repoPath}...`);
  try {
    execSync(`git clone ${repoUrl} ${repoPath}`, { stdio: 'inherit' });
    console.log('Repository cloned successfully.');
  } catch (error) {
    console.error(`Error cloning repository: ${error}`);
  }
}