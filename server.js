require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: '25mb' }));
app.use(cors({ limit: '25mb', extended: true })); // Enable CORS for frontend requests

// Initialize Supabase Client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Predefined email mappings for buttons (Modify as needed)
const buttonEmails = {
    1: "govadamaheedhar@gmail.com",
    2: "tech@pathwaycatalyst.com",
    3: "gmaheedhar7@gmail.com",
};

// Configure email transporter (Using Gmail)
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// API endpoint to handle form submission
app.post("/send-email", async (req, res) => {
    const { businessName, lenderName, dealid, buttonData, docs } = req.body;
    let successCount = 0;
    let failureCount = 0;

    try {
        for (const [button, message] of Object.entries(buttonData)) {
            if (buttonEmails[button]) {
                try {
                    // Send email
                    await transporter.sendMail({
                        from: process.env.EMAIL_USER,
                        to: buttonEmails[button],
                        subject: `New Submission from ${businessName}`,
                        text: `Business: ${businessName}\nLender: ${lenderName}\nDeal ID: ${dealid}\nButton ${button} selected.\nMessage: ${message}`,
                    });

                    // Store submission in Supabase
                    await supabase.from("live_submissions").insert([
                        {
                            business_name: businessName,
                            lender_name: lenderName,
                            dealid: dealid,
                            button_number: parseInt(button),
                            message: message,
                            docs: JSON.stringify(docs), // Store PDF links as JSON
                            created_at: new Date(),
                        },
                    ]);

                    successCount++;
                } catch (emailError) {
                    console.error(`Failed to send email for Button ${button}:`, emailError);
                    failureCount++;
                }
            }
        }

        res.status(200).json({
            message: `Emails sent: ${successCount}, Failed: ${failureCount}`,
        });
    } catch (error) {
        console.error("Server error:", error);
        res.status(500).json({ message: "Server error", error });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
