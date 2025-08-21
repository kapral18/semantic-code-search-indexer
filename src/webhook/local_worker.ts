import { PubSub } from '@google-cloud/pubsub';
import { processWebhook } from './worker';

async function main() {
  const topicName = process.env.GCP_PUBSUB_TOPIC || 'github-pushes';
  const subscriptionName = 'local-worker-subscription';

  // PUBSUB_EMULATOR_HOST must be set
  if (!process.env.PUBSUB_EMULATOR_HOST) {
    console.error('PUBSUB_EMULATOR_HOST environment variable not set.');
    console.error('Run `$(gcloud beta emulators pubsub env-init)` first.');
    process.exit(1);
  }

  const pubsub = new PubSub();
  const topic = pubsub.topic(topicName);

  // Create the topic if it doesn't exist
  const [topicExists] = await topic.exists();
  if (!topicExists) {
    await topic.create();
    console.log(`Topic ${topicName} created.`);
  } else {
    console.log(`Topic ${topicName} already exists.`);
  }

  // Create a subscription if it doesn't exist
  const subscription = topic.subscription(subscriptionName);
  const [subExists] = await subscription.exists();
  if (!subExists) {
    await subscription.create();
    console.log(`Subscription ${subscriptionName} created.`);
  } else {
    console.log(`Subscription ${subscriptionName} already exists.`);
  }

  console.log(`Listening for messages on ${subscriptionName}...`);

  subscription.on('message', async message => {
    console.log('Received message:');
    try {
      // The worker expects a PubSubMessage object, so we construct it
      await processWebhook({
        message: {
          data: message.data.toString('base64'),
        },
      });
      message.ack();
      console.log('Message processed and acknowledged.');
    } catch (error) {
      console.error('Error processing message:', error);
      // Nack the message so it can be redelivered for another attempt
      message.nack();
    }
  });

  subscription.on('error', error => {
    console.error('Received error:', error);
    process.exit(1);
  });
}

main().catch(console.error);
