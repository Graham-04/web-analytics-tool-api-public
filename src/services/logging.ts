import { pino } from "pino";

const logger = pino({
    base: null,
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            colorizeObjects: true,
        }
    }
});


export default logger;