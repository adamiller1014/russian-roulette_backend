const express = require("express");
const router = express.Router();
const affiliateController = require("../controllers/affiliateController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

// @route GET /affiliates/user
// @desc Get all commissions for the authenticated user
// @access Private
router.get("/user", authMiddleware, affiliateController.getUserCommissions);

// @route POST /affiliates
// @desc Create a new affiliate commission
// @access Private
router.post("/", authMiddleware, affiliateController.createCommission);

// @route GET /affiliates
// @desc Get all affiliate commissions (Admin only)
// @access Admin
router.get(
  "/",
  authMiddleware,
  roleMiddleware("admin"),
  affiliateController.getAllCommissions
);

module.exports = router;
