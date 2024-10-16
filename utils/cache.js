const redis = require("redis");
const logger = require("./logger");

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => logger.error(`Redis error: ${err}`));

const connectRedis = async () => {
  try {
    await redisClient.connect();
    logger.info("Redis connected");
  } catch (err) {
    logger.error(`Redis connection failed: ${err}`);
  }
};

module.exports = { redisClient, connectRedis };
