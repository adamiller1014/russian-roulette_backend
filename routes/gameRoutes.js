const { Router } = require("express");
const { playGame } = require("../controllers/gameController");
const { authenticateJWT } = require("../middlewares/authMiddleware");

const router = Router();

router.post("/", authenticateJWT, playGame);

module.exports = router;
