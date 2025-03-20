const validator = require("validator");

const validateData = (data) => {
  const {username, email, password} = data;

  if (!password || password.length < 8 || password.length > 100) {
    throw new Error("Password must be of 8-100 characters");
  }
  if (!email || !validator.isEmail) {
    throw new Error(`${email} is not a valid email address`);
  }
  if (!username || username.length < 5 || username.length > 10) {
    throw new Error("Username must be of 5-10 characters");
  }
};

function fieldFilter(user) {
  const USER_SAFE_DATA = ["_id", "username"];

  user = user.toObject();

  const filteredUser = {};

  USER_SAFE_DATA.forEach((field) => {
    filteredUser[field] = user[field];
  });
  return filteredUser;
}

module.exports = {
  validateData, fieldFilter
};