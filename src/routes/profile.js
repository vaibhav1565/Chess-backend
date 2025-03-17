const express = require("express");
const profileRouter = express.Router();

const { userAuth } = require("../middlewares/auth");

profileRouter.get("/profile/view", userAuth, async (req, res) => {
  try {
    const user = req.user;

    res.json({
      message: "Profile data",
      data: user
    });
  } catch (e) {
    res.status(400).send("ERROR : " + e.message);
  }
});


module.exports = profileRouter;
