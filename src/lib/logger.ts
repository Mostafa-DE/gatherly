import { createConsola } from "consola"

const defaultLevel = process.env.NODE_ENV === "production" ? 2 : 3

export const logger = createConsola({
  level: process.env.LOG_LEVEL ? Number(process.env.LOG_LEVEL) : defaultLevel,
})
