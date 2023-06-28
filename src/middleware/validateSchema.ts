import { validationResult } from 'express-validator';
import { Request, Response, NextFunction } from "express";


export const validateSchema = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log(errors);
        return res.sendStatus(400);
    }

    next();
}
