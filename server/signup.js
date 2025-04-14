const express = require('express');
const router = express.Router();
const supabase = require('./supabaseClient');
const sendEmail = require('./utils/sendEmail');

const codeStore = new Map(); // Temp code storage (for verification codes)

// 📩 Route: Send 6-digit code to user's email
router.post('/signup', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).send("Email is required");

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  codeStore.set(email, code);

  await sendEmail(email, `Your CRM verification code is: ${code}`);
  res.send("📨 Code sent to your email.");
});

// ✅ Route: Verify code and register or confirm user
router.post('/verify', async (req, res) => {
  const { email, code, name = '', role = 'user' } = req.body;
  if (!email || !code) return res.status(400).send("Email and code are required");

  const validCode = codeStore.get(email);
  if (code !== validCode) return res.status(401).send("Invalid code");

  const { data: user, error } = await supabase
    .from('registered_users')
    .select('*')
    .eq('email', email)
    .single();

  if (user) {
    await sendEmail(email, `✅ You're already registered.\n\nYour CRM password is: ${user.password}`);
    return res.send("✅ You are verified. Proceed to login.");
  }

  const password = Math.random().toString(36).slice(-8);

  const { error: insertError } = await supabase
    .from('registered_users')
    .insert([{ email, password, name, role }]);

  if (insertError) {
    console.error('Insert failed:', insertError);
    return res.status(500).send("Error creating account.");
  }

  await sendEmail(email, `🎉 Welcome to CROC CRM!\n\nYour login password is: ${password}`);
  res.send("✅ Registration complete. Password sent to your email.");
});

// 🔁 Route: Forgot password / Reset password
router.post('/reset-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).send("Email is required");

  const { data: user, error } = await supabase
    .from('registered_users')
    .select('*')
    .eq('email', email)
    .single();

  if (!user || error) {
    return res.status(404).send("User not found");
  }

  const newPassword = Math.random().toString(36).slice(-8);

  const { error: updateError } = await supabase
    .from('registered_users')
    .update({ password: newPassword })
    .eq('email', email);

  if (updateError) {
    console.error("Password reset error:", updateError);
    return res.status(500).send("Failed to reset password");
  }

  await sendEmail(email, `🔁 Your password has been reset.\n\nNew password: ${newPassword}`);
  res.send("✅ A new password has been sent to your email.");
});

module.exports = router;
