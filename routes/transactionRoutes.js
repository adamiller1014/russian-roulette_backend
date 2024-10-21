const express = require("express");
const {
  getUserTransactions,
  createTransaction,
  getAllTransactions,
} = require("../controllers/TransactionController");
const { authenticateJWT } = require("../middlewares/authMiddleware");
const { roleMiddleware } = require("../middlewares/roleMiddleware"); // For admin access

const router = express.Router();

// Get User Transactions
router.get("/", authenticateJWT, getUserTransactions);

// Create a New Transaction
router.post("/", authenticateJWT, createTransaction);

// Get All Transactions (Admin Access Only)
router.get(
  "/all",
  authenticateJWT,
  roleMiddleware(["ADMIN"]),
  getAllTransactions
);

module.exports = router;
