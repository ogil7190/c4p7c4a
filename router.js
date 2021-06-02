const express = require("express");

function getRouter(global) {
  const router = express.Router();

  router.get("/test", (req, res) => {
    res.json({
      success: true,
    });
  });

  router.get("/secret", (req, res) => {
    const captcha = req.query.c;
    const refresh = req.query.r;

    console.log(captcha, refresh);

    if (refresh) {
      global.refresh = true;
      return res.json({
        success: true,
        mssg: "refreshing the flow, wait for the screenshot",
      });
    }

    if (captcha) {
      global.captcha = captcha;
      return res.json({
        success: true,
        mssg: "trying your input",
      });
    }
  });

  return router;
}

module.exports = {
  getRouter,
};
