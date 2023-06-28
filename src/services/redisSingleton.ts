import { createClient, RedisClientType } from "redis";
import logger from "./logging";

class RedisSingleton {
  private static client: RedisClientType;

  private constructor() {}

  public static async getClient(): Promise<RedisClientType> {
    if (!this.client) {
      this.client = createClient({
        url: "redis://localhost:6379",
      });

      this.client.on("connect", () => logger.info("[redisSingleton.ts] Connected to Redis"));
      this.client.on("error", (err: Error) => console.log("[redisSingleton.ts] Redis Client Error", err));

      await this.client.connect();
    }

    return this.client;
  }
}

export default RedisSingleton;
