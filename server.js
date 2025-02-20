const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const fs = require('fs');
const app = express();
require('dotenv').config();
const cors = require('cors');
app.use(cors());
const { createClient } = require("@supabase/supabase-js");
const PORT = process.env.PORT || 5000;

app.use(bodyParser.json({ limit: '120mb' }));
app.use(bodyParser.urlencoded({ limit: '120mb', extended: true }));
app.use(express.static('public'));  // Serve static files from 'public' directory
const path = require('path');

app.use(express.static(path.join(__dirname,'Frontend')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Frontend', 'index.html'));
});



const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);


// Load emails from the JSON file
function getEmailConfig() {
    const rawData = fs.readFileSync('lender-emails.json', 'utf8');
    const emailData = JSON.parse(rawData);

    const emailConfig = {};

    emailData.emails.forEach(entry => {
        if (entry.business_name && entry.email) {
            const emails = entry.email.split(',').map(email => email.trim()); 
            emailConfig[entry.business_name] = {
                to: emails[0],  // First email as primary recipient
                cc: emails.slice(1)  // Remaining emails as CC
            };
        }
    });

    return emailConfig;
}

module.exports = getEmailConfig;


// Set up Nodemailer transporter using Gmail SMTP server
let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,   // email address
        pass: process.env.EMAIL_PASS       // App password
    }
});

// Function to insert submission data into Supabase
async function saveToSupabase(businessName, lenderNames, docLinks) {
    try {
        // Ensure lenderNames is an array
        if (!Array.isArray(lenderNames)) {
            lenderNames = typeof lenderNames === 'string' ? [lenderNames] : [];
        }

        // Ensure docLinks is an array
        if (!Array.isArray(docLinks)) {
            docLinks = typeof docLinks === 'string' ? [docLinks] : [];
        }
        const { data, error } = await supabase
            .from('Live submissions')
            .insert([
                {
                    business_name: businessName,
                    lender_names: lenderNames.join(', '),
                    docs: docLinks.join(', ') // Storing file links in comma-separated format
                }
            ]);

        if (error) {
            console.error('Error inserting into Supabase:', error);
            return { success: false, error };
        }
        console.log('Saved to Supabase:', data);
        return { success: true, data };
    } catch (err) {
        console.error('Unexpected error saving to Supabase:', err);
        return { success: false, error: err };
    }
}

const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

// Endpoint to handle submissions
app.post('/send-email', upload.array('attachments', 5), async (req, res) => {
    try {
        const { businessName, enteredData, selectedOptions } = req.body;
        const emailConfig = getEmailConfig();
        let selectedLenders = Array.isArray(selectedOptions) ? selectedOptions : [selectedOptions];


        // Process uploaded files
        let fileLinks = req.files.map(file => {
            return `https://ejdqjzzvhksrjjazqhug.supabase.co/storage/v1/object/public/Pdf%20docs/Apps%20and%20statements/${file.filename}`; // Modify this with your Supabase storage bucket
        });

        // Store submission in Supabase
        const saveResult = await saveToSupabase(businessName, selectedOptions, fileLinks);
        if (!saveResult.success) {
            return res.status(500).json({ message: 'Error saving submission', error: saveResult.error });
        }

        // Send emails
        const sendEmailPromises = selectedOptions.map(optionKey => {
            const option = emailConfig[optionKey];
            if (!option) return Promise.resolve();

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: [option.to, 'maheedharrao.ls140@gmail.com'],
                cc: option.cc,
                subject: `Croc Submissions - Client Name - ${businessName}`,
                text: `${enteredData}\n\nAttached files:\n${fileLinks.join('\n')}`,
                attachments: req.files.map(file => ({
                    filename: file.originalname,
                    path: file.path
                }))
            };

            return transporter.sendMail(mailOptions);
        });

        await Promise.all(sendEmailPromises);
        res.json({ message: 'Submission successful!' });

    } catch (error) {
        console.error('Error handling submission:', error);
        res.status(500).json({ message: 'Submission failed', error });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
