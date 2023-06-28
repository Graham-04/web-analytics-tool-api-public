import bcrypt from "bcrypt";
import logger from "./logging";

export const hashPassword = async (password: string) => {
  const hash = await bcrypt.hash(password, 12);
  return hash;
};

export const comparePassword = async (password: string, hash: string) => {
  logger.info(`Comparing password: ${password} to hash: ${hash}`);
  const result = await bcrypt.compare(password, hash);
  return result;
}
