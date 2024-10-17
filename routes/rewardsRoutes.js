const express = require("express");
const {
  getUserRewards,
  claimRewards,
  updateWagerRequirement,
} = require("../controllers/rewardsController");
const { authenticateJWT } = require("../middlewares/authMiddleware");

const router = express.Router();

// Get User Rewards
router.get("/", authenticateJWT, getUserRewards);

// Claim Rewards
router.post("/claim", authenticateJWT, claimRewards);

// Update Wager Requirement (Example Route)
router.put("/wager", authenticateJWT, updateWagerRequirement);

module.exports = router;
