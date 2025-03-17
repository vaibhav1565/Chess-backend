const validator = require("validator");

const validateData = (data) => {
  const {username, email, password} = data; 
  if (!password) {
    throw new Error("Password is required");
  }
  if (password.length < 8 || password.length > 100) {
    throw new Error("Password must be of 8-100 characters");
  }
  if (!email) {
    throw new Error("Email is required");
  }
  if (!validator.isEmail) {
    throw new Error(`${email} is not a valid email address`);
  }
  if (!username) {
    throw new Error("Username is required");
  }
  if (username.length < 5 || username.length > 15) {
    throw new Error("Username must be of 5-15 characters");
  }
};

module.exports = {
  validateData,
};