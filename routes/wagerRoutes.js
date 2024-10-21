const express = require("express");
const router = express.Router();
const wagerController = require("../controllers/wagerController");
const { authenticateJWT } = require("../middlewares/authMiddleware");
const { checkRole } = require("../middlewares/roleMiddleware");

// @route GET /wagers/user
// @desc Get all wagers for the authenticated user
// @access Private
router.get("/user", authenticateJWT, wagerController.getUserWagers);

// @route POST /wagers
// @desc Create a new wager
// @access Private
router.post("/", authenticateJWT, wagerController.createWager);

// @route GET /wagers
// @desc Get all wagers (Admin access)
// @access Admin
router.get(
  "/",
  authenticateJWT,
  checkRole("admin"),
  wagerController.getAllWagers
);

module.exports = router;
