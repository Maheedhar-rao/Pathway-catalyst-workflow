// server/server.js
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const verifyGoogleToken = require('./auth');
const requireRegisteredUser = require('./authz');
const signupRoutes = require('./signup');
const sendEmail = require('./utils/sendEmail');

const emailConfigData = fs.readFileSync('lender-emails.json', 'utf8');
const lenderEmailMap = (() => {
  try {
    const parsed = JSON.parse(emailConfigData);
    const map = {};
    parsed.emails.forEach(entry => {
      if (entry.business_name && entry.email) {
        const emails = entry.email.split(',').map(e => e.trim());
        map[entry.business_name] = {
          to: emails[0],
          cc: emails.slice(1)
        };
      }
    });
    return map;
  } catch (err) {
    console.error('Error parsing lender-emails.json:', err);
    return {};
  }
})();

app.use(cors());
app.use(bodyParser.json({ limit: '120mb' }));
app.use(bodyParser.urlencoded({ limit: '120mb', extended: true }));
app.use(express.static(path.join(__dirname, 'Frontend')));

app.use('/api', signupRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend', 'index.html'));
});
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend', 'login.html'));
});

app.get('/api/me', verifyGoogleToken, requireRegisteredUser, (req, res) => {
  res.json({ email: req.user.email, role: req.user.role });
});

app.get('/api/dashboard-data', verifyGoogleToken, requireRegisteredUser, async (req, res) => {
  const { data, error } = await supabase
    .from('Live submissions')
    .select('*')
    .eq('user_email', req.user.email)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ message: 'Error loading submissions', error });
  res.json(data);
});
app.get('/api/config', (req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID
  });
});


const upload = multer({ dest: 'uploads/' });

app.post('/send-email', verifyGoogleToken, requireRegisteredUser, upload.array('attachments', 25), async (req, res) => {
  try {
    const { businessName, enteredData, selectedOptions } = req.body;
    const userEmail = req.user.email;
    const selectedLenders = Array.isArray(selectedOptions) ? selectedOptions : [selectedOptions];

    let uploadedFiles = [];
    for (let file of req.files) {
      const filePath = `submissions/${Date.now()}_${file.originalname}`;
      const { data, error } = await supabase
        .storage
        .from('Pdf docs/Apps and statements')
        .upload(filePath, fs.readFileSync(file.path), {
          contentType: file.mimetype,
          upsert: true
        });

      if (error) return res.status(500).json({ message: 'Upload failed', error });

      const fileUrl = supabase.storage.from('Pdf docs/Apps and statements').getPublicUrl(filePath);
      uploadedFiles.push({ name: file.originalname, path: fileUrl.publicURL });
    }

    const fileLinks = uploadedFiles.map(f => f.path);

    const { data: submissionData, error: insertError } = await supabase
      .from('Live submissions')
      .insert([{
        user_email: userEmail,
        business_name: businessName,
        lender_names: selectedLenders.join(', '),
        lenders_sent_to: selectedLenders,
        docs: fileLinks.join(', '),
        message: enteredData,
        status: 'pending',
        reply_progress: `0/${selectedLenders.length}`
      }])
      .select()
      .single();

    if (insertError) return res.status(500).json({ message: 'Error saving to DB', error: insertError });

    const sendEmailPromises = selectedLenders.map(key => {
      const config = lenderEmailMap[key];
      if (!config) return;

      return sendEmail(config.to, {
        cc: config.cc,
        subject: `Croc Submissions - Client Name - ${businessName}`,
        text: `${enteredData}\n\nStips Attached:\n${uploadedFiles.map(f => f.name).join('\n')}`,
        attachments: req.files.map(file => ({
          filename: file.originalname,
          content: fs.readFileSync(file.path),
          contentType: file.mimetype
        }))
      });
    });

    await Promise.all(sendEmailPromises);
    res.json({ message: "Submission successful!" });
  } catch (err) {
    console.error("Error in submission flow:", err);
    res.status(500).json({ message: 'Unexpected error', error: err });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
