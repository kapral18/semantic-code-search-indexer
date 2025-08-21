import { setup } from '../commands/setup_command';
import { incrementalIndex } from '../commands/incremental_index_command';
import path from 'path';
import fs from 'fs';

interface PubSubMessage {
  message: {
    data: string;
  };
}

export async function processWebhook(pubSubMessage: PubSubMessage) {
  try {
    const payload = JSON.parse(Buffer.from(pubSubMessage.message.data, 'base64').toString());
    const { repository } = payload;

    if (!repository || !repository.clone_url) {
      console.error('Invalid payload:', payload);
      return;
    }

    console.log(`Processing repository: ${repository.full_name}`);

    const reposDir = path.join(process.cwd(), '.repos');
    if (!fs.existsSync(reposDir)) {
      fs.mkdirSync(reposDir, { recursive: true });
    }

    const repoPath = path.join(reposDir, repository.name);

    // Use setup command to clone or pull the repo
    await setup(repository.clone_url);

    // Run incremental index
    await incrementalIndex(repoPath, { logMode: true });

    console.log(`Finished processing repository: ${repository.full_name}`);
  } catch (error) {
    console.error('Error processing webhook:', error);
    throw error; // Rethrow to ensure the function execution is marked as failed
  }
}
