const express = require("express");
// const bcrypt = require("bcrypt");
const profileRouter = express.Router();

const { userAuth } = require("../middlewares/auth");
// const { validateEditProfileData, validatePassword } = require("../utils/validation");

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

// profileRouter.patch("/profile/edit", userAuth, async (req, res) => {
//   try {
//     if (!validateEditProfileData(req)) {
//       throw new Error("Invalid Edit Request");
//     }

//     const loggedInUser = req.user;

//     Object.keys(req.body).forEach((key) => (loggedInUser[key] = req.body[key]));

//     await loggedInUser.save();

//     res.json({
//       message: `${loggedInUser.firstName}, your profile has been updated successfully`,
//       data: filterFields(loggedInUser),
//     });
//   } catch (e) {
//     res.status(400).send("ERROR : " + e.message);
//   }
// });

// profileRouter.patch("/profile/password", userAuth, async (req, res) => {
//   try {
//     const { password } = req.body;
//     validatePassword(password);
//     const loggedInUser = req.user;

//     const isPasswordSame = await loggedInUser.validatePassword(password);
//     if (isPasswordSame) {
//       throw new Error("Cannot keep the same password as previous");
//     }

//     // Encrypt the password
//     const passwordHash = await bcrypt.hash(password, 10);

//     loggedInUser.password = passwordHash;
//     await loggedInUser.save();

//     res.json({ data: "Password updated successfully" })
//   }
//   catch (e) {
//     res.status(401).send("ERROR: " + e);
//   }
// })

module.exports = profileRouter;
