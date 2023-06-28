import dotenv from "dotenv";
dotenv.config();
import express, { Request, Response } from "express";
import logger from "./services/logging";
import Redis from "./services/redis";
import SQL from "./services/sql";
import helmet from "helmet";
import { jwtCheck } from "./middleware/jwtCheck";
import { InvalidTokenError, UnauthorizedError } from "express-oauth2-jwt-bearer";
import { analyticsSchema } from "./schemas/analytics";
import { registerWebsite } from "./services/registerWebsite";
import { validateSchema } from "./middleware/validateSchema";
import { validationResult } from "express-validator";
import { registerWebsiteSchema } from "./schemas/registerWebsite";
import bodyParser = require("body-parser");
import Publisher from "./services/publish";
import { RequestBody } from "./interfaces/RequestBody";
const cors = require("cors");
import { overviewSchema } from "./schemas/overview";

async function main() {
  // ===== Testing =====
  // console.log(await SQL.verifyUserHasRole("SqC7UDVSs8F42qmqi8k7pJUT5extm3VF", "079fe89f-14a7-46f2-b33f-667d896b514f", "admin"));
  // console.log(await SQL.getOverview("079fe89f-14a7-46f2-b33f-667d896b514f", "SqC7UDVSs8F42qmqi8k7pJUT5extm3VF", '2023-05-22'));
  // console.log(await SQL.getHostnameFromWebsiteId("079fe89f-14a7-46f2-b33f-667d896b514f"));
  // console.log(await SQL.getAllWebsitesByUserId('SqC7UDVSs8F42qmqi8k7pJUT5extm3VF'));
  // console.log(await SQL.getAvgUserDuration('034deb15-dea4-42cb-8e22-d458f651a966', '2023-06-05 12:00'));
  // ===== END OF Testing =====

  // ===== Initialization Functions  =====
  await Redis.cacheAllWebsiteIds(); //todo: fix caching
  await Redis.cacheAllUserHashes();
  await SQL.generateTestHours('78e54607-9475-44e1-a7e7-a81eddaa0008', 200);
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: "http://localhost:5173",
    })
  );
  app.use(bodyParser.json());
  // =====  END OF Initialization Functions  =====

  // =====  PUBLIC ROUTES  =====
  app.get("/status", (req: Request, res: Response) => {
    res.sendStatus(200);
  });

  app.post("/analytics", analyticsSchema, validateSchema, async (req: Request, res: Response) => {
    logger.info(`incoming request analytics`);
    const ip_addr = req.ip;
    const country_code = "US"; // TODO: (PRODUCTION) change this to get country code from ip address
    const { referer, hostname, user_agent, page } = req.body as RequestBody;
    console.log(`referer is ${referer}`);
    console.log(req.body);

    // const user_hash = hash.createHash(hostname, user_agent, ip_addr);
    const website_id = await Redis.getWebsiteIdFromHostname(hostname);
    const result = Publisher.sendToQueue({ hostname: hostname, user_agent: user_agent, referer: referer, ip_addr: ip_addr, website_id: website_id as string, country_code: country_code, page: page });
    if (!result) return res.sendStatus(500);
    return res.sendStatus(200);
  });

  // =====  END OF PUBLIC ROUTES  =====

  // =====  PROTECTED ROUTES  =====
  app.use(jwtCheck);

  //@ts-ignore
  app.get("/overview/:hostname", overviewSchema, validateSchema, async (req, res) => {
    logger.info(`Getting overview for ${req.params.hostname} from ${req.query.start} to ${req.query.end}`);
    const websiteId = await Redis.getWebsiteIdFromHostname(req.params.hostname);
    const overview = await SQL.getOverview(websiteId as string, req.auth?.payload.sub, req.query.start, req.query.end);
    if (!overview) {
      logger.error("Could not get overview. Might not have permission");
      return res.sendStatus(401);
    }
    console.log(overview);
    return res.json(overview);
  });

  app.post("/register-website", registerWebsiteSchema, validateSchema, async (req: Request, res: Response) => {
    logger.info(`incoming request ${req.auth?.payload.sub}`);
    // logger.info(`incoming request ${req.body.hostname}`)
    const result = await registerWebsite(req);
    if (!result) {
      return res.sendStatus(500);
    }
    logger.info(`result ${result ? "success" : "failure"}`);
    return res.sendStatus(200);
  });

  app.get("/websites", async (req: Request, res: Response) => {
    logger.info(`incoming request ${req.auth?.payload.sub}`);
    const websites = await SQL.getAllWebsitesByUserId(req.auth?.payload.sub);
    if (websites.length === 0) {
      return res.sendStatus(204);
    }
    return res.json(websites);
  });

  // =====  END OF PROTECTED ROUTES  =====

  // =====  ERROR HANDLING  =====
  // DO NOT MOVE THIS MIDDLEWARE
  // @ts-ignore
  app.use((err, req, res, next) => {
    if (err instanceof InvalidTokenError) {
      logger.error(err);
      return res.sendStatus(401);
    } else if (err instanceof UnauthorizedError) {
      logger.error(err);
      return res.sendStatus(401);
    } else if (err instanceof SyntaxError) {
      logger.error(err);
      return res.sendStatus(400);
    } else {
      logger.error(err);
      return res.sendStatus(500);
    }
  });

  // =====  END OF ERROR HANDLING  =====

  // =====  START  =====
  app.listen(3000, () => {
    logger.info("Server listening on port 3000");
  });

  // =====  END OF START  =====
}

main();
