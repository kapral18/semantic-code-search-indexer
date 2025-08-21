import { PubSub } from '@google-cloud/pubsub';
import { processWebhook } from './worker';

async function main() {
  const topicName = process.env.GCP_PUBSUB_TOPIC;
  const subscriptionName = process.env.GCP_PUBSUB_SUBSCRIPTION;

  if (!topicName || !subscriptionName) {
    console.error('GCP_PUBSUB_TOPIC and GCP_PUBSUB_SUBSCRIPTION environment variables must be set.');
    process.exit(1);
  }

  const pubsub = new PubSub();
  const topic = pubsub.topic(topicName);

  // Create the topic if it doesn't exist
  const [topicExists] = await topic.exists();
  if (!topicExists) {
    await topic.create();
    console.log(`Topic ${topicName} created.`);
  }

  // Create a subscription if it doesn't exist
  const subscription = topic.subscription(subscriptionName);
  const [subExists] = await subscription.exists();
  if (!subExists) {
    await subscription.create();
    console.log(`Subscription ${subscriptionName} created.`);
  } else {
    console.log(`Listening for messages on ${subscriptionName}...`);
  }

  subscription.on('message', async message => {
    console.log(`Received message ${message.id}:`);
    try {
      await processWebhook({
        message: {
          data: message.data.toString('base64'),
        },
      });
      message.ack();
      console.log(`Acknowledged message ${message.id}.`);
    } catch (error) {
      console.error(`Error processing message ${message.id}:`, error);
      message.nack();
      console.log(`Nacknowledged message ${message.id}.`);
    }
  });

  subscription.on('error', error => {
    console.error('Received error:', error);
    process.exit(1);
  });
}

main().catch(console.error);
