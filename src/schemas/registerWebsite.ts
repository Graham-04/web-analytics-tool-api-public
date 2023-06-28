const { body } = require('express-validator');

export const registerWebsiteSchema = [
    body('hostname').isString()
        .isLength({ max: 150 })
        .matches(/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/)

];