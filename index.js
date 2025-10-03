require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const CryptoJS = require('crypto-js');
const fs = require('fs');
const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = 3000;
const VERIFY_TOKEN = 'test_webhook_token_123';
const APP_SECRET = 'test_app_secret_456';
const PAGE_ACCESS_TOKEN = 'your_page_access_token_here';
const PAGE_ID = '773204715868903';
const LEADS_FILE = 'leads.json';

// MongoDB configuration
const MONGODB_URI = 'mongodb+srv://luckykhati459_db_user:ajayKhati@cluster0.4hqlabd.mongodb.net/';
const DB_NAME = 'webhook_leads';
const COLLECTION_NAME = 'leads';

let db = null;
let client = null;

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    db = null;
  }
}

// Middleware
app.use(bodyParser.json());
 // Serve static files (for frontend)

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Load leads from file or initialize empty array (fallback)
let leads = [];
if (fs.existsSync(LEADS_FILE)) {
  try {
    leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
  } catch (error) {
    console.error('Error loading leads file:', error);
    leads = [];
  }
}

// Basic route
app.get('/', (req, res) => {
  res.send('Facebook Webhook Server is running!');
});

// Webhook verification (GET /webhook)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('Webhook verification request:', { mode, token, challenge });

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified successfully!');
    res.status(200).send(challenge);
  } else {
    console.log('Webhook verification failed');
    res.sendStatus(403);
  }
});

// Receive lead notifications (POST /webhook)
app.post('/webhook', (req, res) => {
  const body = req.body;
  const signature = req.headers['x-hub-signature-256'];

  console.log('Received webhook event:', JSON.stringify(body, null, 2));

  // Verify signature
  if (signature && APP_SECRET) {
    const elements = signature.split('=');
    const method = elements[0];
    const signatureHash = elements[1];
    const expectedHash = CryptoJS.HmacSHA256(JSON.stringify(body), APP_SECRET).toString(CryptoJS.enc.Hex);

    if (method !== 'sha256' || signatureHash !== expectedHash) {
      console.error('Invalid signature');
      return res.sendStatus(401);
    }
  }

  // Process lead event
  if (body.object === 'page') {
    body.entry.forEach(entry => {
      entry.changes.forEach(change => {
        if (change.field === 'leadgen') {
          const leadgenId = change.value.leadgen_id;
          console.log(`New lead received: ${leadgenId}`);
          fetchLeadDetails(leadgenId);
        }
      });
    });
  }

  res.status(200).send('EVENT_RECEIVED');
});

// Fetch full lead details from Graph API and save to MongoDB
async function fetchLeadDetails(leadgenId) {
  if (!PAGE_ACCESS_TOKEN || PAGE_ACCESS_TOKEN === 'your_page_access_token_here') {
    console.error('PAGE_ACCESS_TOKEN not set, cannot fetch lead details');
    return;
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v23.0/${leadgenId}?access_token=${PAGE_ACCESS_TOKEN}`);
    const leadData = await response.json();
    if (leadData.error) {
      throw new Error(leadData.error.message);
    }

    // Save to MongoDB if available
    if (db) {
      try {
        const leadDocument = {
          lead_id: leadData.id,
          ad_id: leadData.ad_id,
          form_id: leadData.form_id,
          created_time: new Date(leadData.created_time),
          field_data: leadData.field_data,
          platform: 'facebook',
          source: 'leadgen_webhook',
          raw_data: leadData,
          created_at: new Date()
        };

        const result = await db.collection(COLLECTION_NAME).insertOne(leadDocument);
        console.log('Lead saved to MongoDB:', result.insertedId);
      } catch (mongoError) {
        console.error('MongoDB insert error:', mongoError);
        // Fallback to local file storage
        saveToLocalFile(leadData);
      }
    } else {
      console.log('MongoDB not connected, saving to local file');
      saveToLocalFile(leadData);
    }

  } catch (error) {
    console.error('Error fetching lead:', error);
  }
}

// Fallback function to save leads locally
function saveToLocalFile(leadData) {
  leads.unshift(leadData);  // Add to beginning for newest first
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
  console.log('Lead saved to local file:', leadData);
}

// API endpoint to get all leads (from MongoDB or local file)
app.get('/api/leads', async (req, res) => {
  try {
    let leadsData = [];

    if (db) {
      try {
        const cursor = db.collection(COLLECTION_NAME).find({}).sort({ created_at: -1 });
        leadsData = await cursor.toArray();
      } catch (mongoError) {
        console.error('MongoDB fetch error:', mongoError);
        // Fallback to local data
        leadsData = leads;
      }
    } else {
      leadsData = leads;
    }

    res.json({
      success: true,
      data: leadsData,
      count: leadsData.length,
      source: db ? 'mongodb' : 'local'
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leads'
    });
  }
});

// API endpoint to add a lead manually (for testing)
app.post('/api/leads', async (req, res) => {
  try {
    const { name, email, phone, source, message } = req.body;
    
    const newLead = {
      id: Date.now(),
      name: name || 'Unknown',
      email: email || '',
      phone: phone || '',
      source: source || 'Manual Entry',
      status: 'New',
      message: message || '',
      created_time: new Date().toISOString(),
      field_data: [
        { name: 'full_name', values: [name || 'Unknown'] },
        { name: 'email', values: [email || ''] },
        { name: 'phone_number', values: [phone || ''] }
      ]
    };

    // Save to MongoDB if available
    if (db) {
      try {
        const leadDocument = {
          lead_id: newLead.id.toString(),
          ad_id: null,
          form_id: null,
          created_time: new Date(newLead.created_time),
          field_data: newLead.field_data,
          platform: 'manual',
          source: newLead.source,
          raw_data: newLead,
          created_at: new Date()
        };

        const result = await db.collection(COLLECTION_NAME).insertOne(leadDocument);
        console.log('Manual lead saved to MongoDB:', result.insertedId);
      } catch (mongoError) {
        console.error('MongoDB insert error:', mongoError);
        // Fallback to local storage
        leads.unshift(newLead);
        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
      }
    } else {
      leads.unshift(newLead);
      fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
    }
    
    res.json({
      success: true,
      data: newLead
    });
  } catch (error) {
    console.error('Error adding lead:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add lead'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error processing request:', err);
  res.status(500).send('Internal Server Error');
});

// Start server
app.listen(PORT, async () => {
  console.log(`Facebook Webhook Server is running at http://localhost:${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhook`);
  console.log(`API endpoint: http://localhost:${PORT}/api/leads`);
  console.log(`Frontend: http://localhost:${PORT}/`);
  
  // Connect to MongoDB
  await connectToMongoDB();
  
  console.log('MongoDB connection configured with password: ajayKhati');
});