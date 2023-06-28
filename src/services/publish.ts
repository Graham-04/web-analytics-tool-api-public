import amqp from "amqplib";
import { AnalyticsMessage } from "../interfaces/AnalyticsMessage";

let queue: string;
let connection: any;
let channel: any;

async function connect() {
  queue = "all_requests";
  connection = await amqp.connect("amqp://localhost:5672");
  channel = await connection.createChannel();
  channel.assertQueue(queue);
  // console.log("Connected to rMQ");
}

connect();

class Publisher {
  private connection!: amqp.Connection;
  private channel!: amqp.Channel;
  private queue!: string;

  sendToQueue(message: AnalyticsMessage): boolean {
    const result = channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));
    if (!result) {
      // throw new Error(`Cannot send message to queue: ${this.queue}`);
      console.log("cant send");
    }
    return result;
  }

  async clearQueue(): Promise<{ messageCount: number }> {
    const result = await channel.purgeQueue(queue);
    console.log("RESULT: ", result);
    return result;
  }
}

export default new Publisher();
