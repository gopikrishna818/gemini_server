const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

// Create reusable transporter using SMTP settings
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST, // e.g., smtp.gmail.com
  port: process.env.SMTP_PORT, // usually 587
  secure: false, // use TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Sends alert email when a key hits rate limit.
 * @param {number} keyNumber - The Gemini API key index that triggered the alert
 */
async function sendAlert(keyNumber) {
  const mailOptions = {
    from: `"Gemini Server Alerts" <${process.env.SMTP_USER}>`,
    to: process.env.NOTIFY_EMAIL,
    subject: `🚨 Gemini API Key #${keyNumber} Rate Limited`,
    text: `Heads up!\n\nGemini API key #${keyNumber} has hit a rate limit. The server has switched to the next key.\n\nNo action is required unless multiple keys begin to fail.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Alert email sent for key #${keyNumber}`);
  } catch (error) {
    console.error("❌ Failed to send alert email:", error.message);
  }
}

module.exports = { sendAlert };
