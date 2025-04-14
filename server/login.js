const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

router.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data: user, error } = await supabase
      .from('registered_users')
      .select('email, password') // assuming plain text for now
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.password !== password) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    const token = Buffer.from(`${email}:${Date.now()}`).toString('base64');
    return res.json({ message: 'Login successful', token });

  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
