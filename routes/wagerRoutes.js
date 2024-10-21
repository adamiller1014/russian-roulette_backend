const express = require("express");
const router = express.Router();
const wagerController = require("../controllers/wagerController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

// @route GET /wagers/user
// @desc Get all wagers for the authenticated user
// @access Private
router.get("/user", authMiddleware, wagerController.getUserWagers);

// @route POST /wagers
// @desc Create a new wager
// @access Private
router.post("/", authMiddleware, wagerController.createWager);

// @route GET /wagers
// @desc Get all wagers (Admin access)
// @access Admin
router.get(
  "/",
  authMiddleware,
  roleMiddleware("admin"),
  wagerController.getAllWagers
);

module.exports = router;
