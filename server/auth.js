// server/auth.js
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verifyGoogleToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).send("No auth token provided");

  const token = authHeader.replace("Bearer ", "");
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    // ✅ Set user info in request context
    req.user = {
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      sub: payload.sub,
    };

    next();
  } catch (err) {
    console.error("❌ Invalid Google token", err.message);
    return res.status(403).send("Invalid or expired token");
  }
}

module.exports = verifyGoogleToken;
