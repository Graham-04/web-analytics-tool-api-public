const { body } = require("express-validator");

export const analyticsSchema = [
  body("hostname")
    .isString()
    .isLength({ max: 200 })
    .matches(/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/)
    .withMessage("Hostname must be a string of maximum 200 characters and match the pattern"),

  body("referer")
    .optional()
    .isString()
    .isLength({ max: 150 })
    .matches(/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/)
    .withMessage("Referer must be a string of maximum 150 characters and match the pattern"),

  body("page")
    .isString()
    .isLength({ max: 500 })
    .withMessage("Page must be a string of maximum 500 characters")
    .matches(/^\/[a-zA-Z0-9]+(?:\/[a-zA-Z0-9]+)*\/?$/),

  body("user_agent").isString().isLength({ max: 200 }).withMessage("User agent must be a string of maximum 200 characters"),
];
