const express = require("express");
const playRouter = express.Router();

const { userAuth } = require("../middlewares/auth");

playRouter.get("/play/:withUserId", userAuth, (req,res)=> {
    
})