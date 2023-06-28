const { Pool } = require("pg");
import logger from "./logging";

let sqlPool = new Pool({
  host: "localhost",
  user: "postgres",
  database: "webanalytics",
  port: 5432,
  max: 2000,
  idleTimeoutMillis: 10000,
});
logger.info("[sqlConnPool.ts] Connected to Postgres");

export default sqlPool;
