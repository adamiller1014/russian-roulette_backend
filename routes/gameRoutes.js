const express = require('express');
const router = express.Router();
const GameController = require('../controllers/gameController');
const Player = require('../models/Player');
const { authenticateJWT } = require('../middlewares/authMiddleware');

// Route to play the game
router.post('/play', authenticateJWT, async (req, res) => {
  try {
    const { betAmount } = req.body;
    const userId = req.user.id; // Assuming your auth middleware adds user to req

    const gameResult = await GameController.playGame(userId, betAmount);
    res.json(gameResult);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Route to get player statistics
router.get('/stats', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const player = await Player.findOne({ username: userId })
      .select('-_id totalBaseWins totalBonusWins totalBaseWinAmount totalBonusWinAmount totalBetAmount bonusesTriggered bonusRetriggersCount');
    
    res.json(player);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
