// server/login.js
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

router.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  const { data: user, error } = await supabase
    .from('registered_users')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !user) {
    return res.status(401).json({ error: 'User not found' });
  }

  // If you're using hashed passwords
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  // If not using hashed passwords yet:
  // if (password !== user.password) return res.status(401).json({ error: 'Invalid password' });

  const token = Buffer.from(`${email}:${Date.now()}`).toString('base64');

  res.json({ message: 'Login successful', token });
});

module.exports = router;
