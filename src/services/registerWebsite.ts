import logger from "./logging";
import SQL from './sql';

export const registerWebsite = async (req: any) => {
    const {hostname} = req.body;
    const userId = req.auth?.payload.sub
    logger.info(`Registering website "${hostname}" for user "${userId}"`)
    const result = await SQL.registerWebsite(hostname, userId);
    return result;
};