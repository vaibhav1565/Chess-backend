const express = require("express");
const authRouter = express.Router();

const { validateSignUpData } = require("../utils/validation");
const User = require("../models/user");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require('uuid');

authRouter.post("/signup", async (req, res) => {
  try {
    //Validate the data
    validateSignUpData(req);

    const { password } = req.body;

    // Encrypt the password
    const passwordHash = await bcrypt.hash(password, 10);

    const u = { ...req.body, password: passwordHash };
    const user = new User(u);

    await user.save();
    // console.log(u);
    res.send("User Added successfully!");
  } catch (e) {
    res.status(400).send("ERROR : " + e.message);
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("Invalid credentials");
    }
    const isPasswordValid = await user.validatePassword(password);

    if (isPasswordValid) {
      const token = await user.getJWT();

      res.cookie("token", token, {
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      res.send("Login successful");
    } else {
      throw new Error("Invalid credentials");
    }
  } catch (e) {
    res.status(400).send("ERROR : " + e.message);
  }
});

authRouter.post("/logout", async (req, res) => {
  res.cookie("token", null, {
    expires: new Date(Date.now()),
  });
  res.send("Logout successful");
});

authRouter.post("/guest_login", async (req, res) => {
  try {
    const guestUser = new User({
      username: `guest_${uuidv4().slice(0, 8)}`,
      email: `${uuidv4()}@guest.com`,
      password: await bcrypt.hash(uuidv4(), 10),
    });

    await guestUser.save();

    const token = await guestUser.getJWT();

    res.cookie("token", token, {
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    res.send("Guest login successful");
    // res.send({ message: "Guest login successful", user: guestUser });
  } catch (e) {
    res.status(400).send("ERROR : " + e.message);
  }
});

module.exports = authRouter;