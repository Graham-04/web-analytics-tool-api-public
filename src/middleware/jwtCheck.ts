import dotenv from "dotenv";
dotenv.config();
import { auth } from "express-oauth2-jwt-bearer";

export const jwtCheck = auth({
    audience: process.env.AUDIENCE,
    issuerBaseURL: process.env.ISSUER_BASE_URL,
    tokenSigningAlg: "RS256",
});