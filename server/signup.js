// server/signup.js
const express = require('express');
const router = express.Router();
const supabase = require('./supabaseClient');
const sendEmail = require('./utils/sendEmail');

const codeStore = new Map(); // email → 6-digit code (use Redis/DB in prod)

// 📩 Route to send a code
router.post('/signup', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).send("Email is required");

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  codeStore.set(email, code);

  await sendEmail(email, `Your CRM verification code is: ${code}`);
  res.send("Code sent to your email.");
});

// ✅ Route to verify code + check authorization
router.post('/verify', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).send("Email and code are required");

  const validCode = codeStore.get(email);
  if (code !== validCode) return res.status(401).send("Invalid code");

  const { data: user } = await supabase
    .from('registered_users')
    .select('email')
    .eq('email', email)
    .single();

  if (user) {
    await sendEmail(email, `✅ You are verified. Your CRM password: hellocrm123`);
    return res.send("✅ You are verified. Proceed to login.");
  } else {
    return res.send("✅ Registration was successful. Please wait for CRM access.");
  }
});

module.exports = router;
