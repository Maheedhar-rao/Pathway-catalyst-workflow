// server/authz.js
const supabase = require('./supabaseClient');

async function requireRegisteredUser(req, res, next) {
  const email = req.user?.email;
  if (!email) return res.status(401).send("Unauthorized");

  const { data, error } = await supabase
    .from('registered_users')
    .select('role')
    .eq('email', email)
    .single();

  if (error || !data) {
    return res.status(403).send("Access denied. You are not a registered CRM user.");
  }

  req.user.role = data.role; 
  next();
}

module.exports = requireRegisteredUser;
