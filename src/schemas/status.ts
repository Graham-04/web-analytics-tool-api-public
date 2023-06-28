const { body } = require('express-validator');

export const statusSchema = [
  body('database').isString().withMessage('Database must be a string'),
  body('redis').isString().withMessage('Redis must be a string'),
  body('rabbitMQ').isString().withMessage('RabbitMQ must be a string')
];