const express = require("express");
const profileRouter = express.Router();

const { userAuth } = require("../middlewares/auth");
const { fieldFilter } = require("../utils/validation");

profileRouter.get("/profile/view", userAuth, async (req, res) => {
  try {
    const user = req.user;

    res.json({
      data: fieldFilter(user)
    });
  } catch (e) {
    res.status(400).send({error: e.message});
  }
});


module.exports = profileRouter;
