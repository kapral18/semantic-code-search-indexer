import express from 'express';
import crypto from 'crypto';
import { PubSub } from '@google-cloud/pubsub';

const app = express();
const port = process.env.PORT || 8080;

const pubsub = new PubSub();
const topicName = process.env.GCP_PUBSUB_TOPIC;
if (!topicName) {
  throw new Error('GCP_PUBSUB_TOPIC environment variable not set.');
}
const topic = pubsub.topic(topicName);

const githubWebhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
if (!githubWebhookSecret) {
  throw new Error('GITHUB_WEBHOOK_SECRET environment variable not set.');
}

app.use(express.json({
  verify: (req, _res, buf) => {
    const signature = req.headers['x-hub-signature-256'];
    if (signature) {
      const hmac = crypto.createHmac('sha256', githubWebhookSecret);
      const digest = `sha256=${hmac.update(buf).digest('hex')}`;
      if (!crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature as string))) {
        throw new Error('Invalid signature.');
      }
    }
  }
}));

app.post('/webhook/github', async (req, res) => {
  try {
    const event = req.headers['x-github-event'];
    if (event === 'push') {
      const { repository } = req.body;
      const message = {
        repository: {
          name: repository.name,
          full_name: repository.full_name,
          clone_url: repository.clone_url,
        },
      };

      await topic.publishMessage({ json: message });
      console.log(`Published message to Pub/Sub topic: ${topicName}`);
      res.status(202).send('Accepted');
    } else {
      res.status(200).send('Event received, but not a push event.');
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(port, () => {
  console.log(`Webhook server listening on port ${port}`);
});
