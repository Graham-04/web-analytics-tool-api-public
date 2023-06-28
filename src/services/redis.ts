import {RedisClientOptions, RedisClientType} from "@redis/client";
import {createClient} from "redis";
import logger from './logging';
import SQL from './sql';
import logging from "./logging";
import {hash} from "bcrypt";
import RedisSingleton from "./redisSingleton";

class Redis {
  async insertHash(hash: string, website_id: string): Promise<number> {
    const redisClient = await RedisSingleton.getClient();
    const exists = await redisClient.exists(`known_ids:${website_id}`);
    if (!exists) {
      console.log(`known_ids:${website_id} does not exist, creating...`)
    }
    const result = await redisClient.sAdd(`known_ids:${website_id}`, hash);
    return result;
  }

  /**
   * Retrieves the website ID for a given hostname
   *
   * @param {string} hostname - The hostname to retrieve the website ID for
   * @returns {Promise<string>} - A promise that resolves with the website ID associated with the hostname
   * @throws {Error} - If the given hostname does not have a website ID associated with it
   */
  async getWebsiteIdFromHostname(hostname: string) {
    const redisClient = await RedisSingleton.getClient();
    let result = await redisClient.hGet("website_ids", hostname);
    if (!result) {
      logger.error(`Possible cache miss for ${hostname}. Checking SQL for website ID`)
      result = await SQL.getWebsiteIdFromHostname(hostname);
      logger.info(`SQL result: ${result}`)
    }
    return result;
  }

  async cacheAllWebsiteIds() {
    const redisClient = await RedisSingleton.getClient();
    const websiteIds = await SQL.getAllWebsites();
    if (websiteIds) {
      for (const website of websiteIds) {
        logger.info(`[cacheAllWebsiteIds] Caching website id: ${website.hostname} ${website.id.slice(0, 10)}...`)
        const result = await redisClient.hSet('website_ids', website.hostname, website.id)
      }
    }
  }

  async getAllWebsiteIds() {
    const redisClient = await RedisSingleton.getClient();
    const result = await redisClient.hVals('website_ids');
    if (!result) {
      return ['']
    }
    return result
  }

  async cacheAllUserHashes() {
    const redisClient = await RedisSingleton.getClient();
    const websites = await SQL.getAllWebsites();
    for (let website of websites) {
      const setAlreadyExists = await redisClient.exists(`known_ids:${website.id}`)
      if (setAlreadyExists) {
        // if set already exists just refresh cache
        logger.info(`[cacheAllUserHashes] Set already exists for ${website.id.slice(0, 10)}... Skipping set creation. Refreshing cache`)
        // update cache
        const hashes = await SQL.getAllUserHashesByWebsiteId(website.id);
        // logger.info(`hashes: ${hashes}`)
        for (const hash of hashes) {
          // add hashes for existing set
          // logger.info(`[cacheAllUserHashes] Hash found for ${website.id} ${hash}`)
          await redisClient.sAdd(`known_ids:${website.id}`, hash);
        }
      } else {
        logger.info(`[cacheAllUserHashes] Set does not exist for ${website.id.slice(0, 10)}... Creating set and adding any found hashes...`);
        // await this.client.sAdd(`known_ids:${website.id}`, ''); // creating set in case 'hashes' does not contain any hashes
        const hashes = await SQL.getAllUserHashesByWebsiteId(website.id);
        // logger.info(`hashes: ${hashes}`)
        await redisClient.sAdd(`known_ids:${website.id}`, '')
        for (const hash of hashes) {
          // add hashes for newly created set
          // logger.info(`[cacheAllUserHashes] Hash found for ${website.id} ${hash}`)
          await redisClient.sAdd(`known_ids:${website.id}`, hash);
        }
      }
    }
  }
}

export default new Redis();
