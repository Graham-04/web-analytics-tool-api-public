const { body } = require('express-validator');

export const signUpSchema = [
    body('email').isEmail().withMessage('Invalid email address').isLength({ max: 320 }).withMessage('Email must be at most 320 characters long'),
    body('password').isString().withMessage('Password must be a string')
];
