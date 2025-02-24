require("dotenv").config();
const crypto = require("crypto");

function extractDomain(email) {
    return email.includes("@") ? email.split("@")[1] : "gmail.com"; // Default fallback
}

function generateMessageId(fromEmail) {
    const domain = extractDomain(fromEmail);
    return `<${crypto.randomUUID()}@${domain}>`;
}

function getEmailHeaders(previousMessageId = null) {
    const fromEmail = process.env.EMAIL_USER  // Load sender email from .env
    const messageId = generateMessageId(fromEmail);

    return {
        "Message-ID": messageId,
        "References": previousMessageId ? previousMessageId : messageId,
        "In-Reply-To": previousMessageId ? previousMessageId : messageId
    };
}

module.exports = getEmailHeaders;
