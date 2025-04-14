const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendEmail(to, message) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: "CRM Access",
    text: message
  });
}

module.exports = sendEmail;
