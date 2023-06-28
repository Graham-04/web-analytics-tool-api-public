const { param, query } = require("express-validator");

export const overviewSchema = [
  param("hostname")
    .isString()
    .isLength({ max: 150 })
    .matches(/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/),
  query("start").isString().notEmpty().isLength({ max: 20 }),
  query("end").isString().notEmpty().isLength({ max: 20 })
];