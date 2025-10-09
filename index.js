const express = require('express');
const bodyParser = require('body-parser');
const CryptoJS = require('crypto-js');
const fetch = require('node-fetch');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = 3000;
const VERIFY_TOKEN = 'test_webhook_token_123';
const APP_SECRET = 'c970c6f5601d12734e6cb11932d391a5';
const APP_ID = '1147659733499355';
const PAGE_ACCESS_TOKEN = 'EAAQTylq8ZCdsBPnQEJFVGsNpTuK1uRaEDxVq4VEidZAPtWkGSbCXS9Rbt2qtYB3oUKbkyFZCEVf1bAZBM0HaegX3mZC0tw45rKDpBgT5DEsZA62ggm4zeZBMMsDWq16XRE1BoUaCCF1ff8JViRIwKH8U95WR0APXTZBGwJqOGNefzzsGLRZBHxx1WBrcYoD5jpBGZA0KrylyizGlyZAZC5ZB6IaQQjZCSvipBAZC5r7s9mVnVxjzu0ZD';
const PAGE_ID = '849032321617972';
const BUSINESS_MANAGER_ID = '3742628306040446';
const MONGODB_URI = 'mongodb+srv://luckykhati459_db_user:ajayKhati@cluster0.4hqlabd.mongodb.net/webhook_leads';
const GRAPH_API_VERSION = 'v23.0';

// Mongoose Schema for Lead
const leadSchema = new mongoose.Schema({
  lead_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  ad_id: {
    type: String,
    default: null
  },
  form_id: {
    type: String,
    default: null
  },
  created_time: {
    type: Date,
    required: true
  },
  field_data: [{
    name: String,
    values: [String]
  }],
  platform: {
    type: String,
    enum: ['facebook', 'instagram', 'manual'],
    default: 'facebook'
  },
  source: {
    type: String,
    default: 'leadgen_webhook'
  },
  business_manager_id: {
    type: String,
    default: BUSINESS_MANAGER_ID
  },
  page_id: {
    type: String,
    default: PAGE_ID
  },
  raw_data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Add indexes for better performance
leadSchema.index({ created_at: -1 });
leadSchema.index({ platform: 1 });
leadSchema.index({ lead_id: 1 });

// Create Lead model
const Lead = mongoose.model('Lead', leadSchema);

// Connect to MongoDB using Mongoose
async function connectToMongoDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
      retryWrites: true,
      retryReads: true
    });
    console.log('✅ Connected to MongoDB with Mongoose');

    // Test the connection
    const leadCount = await Lead.countDocuments();
    console.log(`📊 Current leads in database: ${leadCount}`);

    // Handle connection events
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected, attempting to reconnect...');
      connectToMongoDB();
    });

    mongoose.connection.on('error', (error) => {
      console.error('MongoDB connection error:', error);
    });

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    setTimeout(connectToMongoDB, 5000); // Retry after 5 seconds
  }
}

// Middleware
app.use(bodyParser.json());

// CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  credentials: true,
  maxAge: 86400
}));

// Add caching headers for API endpoints
app.use('/api', (req, res, next) => {
  res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  next();
});

// Basic route
app.get('/', (req, res) => {
  res.send('Facebook Webhook Server is running with Mongoose!');
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
app.post('/webhook', async (req, res) => {
  const body = req.body;
  const signature = req.headers['x-hub-signature-256'];

  console.log('Received webhook event:', JSON.stringify(body, null, 2));

  // Verify signature
  if (!signature) {
    console.error('No signature provided in webhook request');
    return res.status(401).send('Missing signature');
  }

  const [method, signatureHash] = signature.split('=');
  if (method !== 'sha256') {
    console.error('Invalid signature method:', method);
    return res.status(401).send('Invalid signature method');
  }

  const expectedHash = CryptoJS.HmacSHA256(JSON.stringify(body), APP_SECRET).toString(CryptoJS.enc.Hex);
  if (signatureHash !== expectedHash) {
    console.error('Invalid signature hash');
    return res.status(401).send('Invalid signature');
  }

  // Process leads asynchronously
  if (body.object === 'page') {
    body.entry.forEach(entry => {
      entry.changes.forEach(change => {
        if (change.field === 'leadgen') {
          const leadgenId = change.value.leadgen_id;
          console.log(`New lead received: ${leadgenId}`);
          fetchLeadDetails(leadgenId).catch(err => {
            console.error(`Error processing lead ${leadgenId}:`, err);
          });
        }
      });
    });
  }

  // Respond immediately to avoid webhook timeout
  res.status(200).send('EVENT_RECEIVED');
});

// Fetch full lead details from Graph API and save to MongoDB
async function fetchLeadDetails(leadgenId) {
  if (!PAGE_ACCESS_TOKEN) {
    console.error('PAGE_ACCESS_TOKEN not set, cannot fetch lead details');
    return;
  }

  try {
    const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${leadgenId}?access_token=${PAGE_ACCESS_TOKEN}`);
    const leadData = await response.json();

    if (leadData.error) {
      throw new Error(`Graph API error: ${leadData.error.message}`);
    }

    // Check if lead already exists
    const existingLead = await Lead.findOne({ lead_id: leadData.id });
    if (existingLead) {
      console.log(`Lead ${leadData.id} already exists, skipping duplicate`);
      return;
    }

    // Create new lead
    const newLead = new Lead({
      lead_id: leadData.id,
      ad_id: leadData.ad_id,
      form_id: leadData.form_id,
      created_time: new Date(leadData.created_time),
      field_data: leadData.field_data,
      platform: 'facebook',
      source: 'leadgen_webhook',
      business_manager_id: BUSINESS_MANAGER_ID,
      page_id: PAGE_ID,
      raw_data: leadData
    });

    const savedLead = await newLead.save();
    console.log('✅ Lead saved to MongoDB with Mongoose:', savedLead._id);

  } catch (error) {
    if (error.code === 11000) {
      console.log(`Duplicate lead detected for leadgen_id ${leadgenId}`);
    } else {
      console.error('Error fetching/saving lead:', error.message);
    }
  }
}

// API endpoint to get all leads
app.get('/api/leads', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        error: 'Database not connected'
      });
    }

    const leadsData = await Lead.find({})
      .select('lead_id ad_id form_id created_time field_data platform source business_manager_id page_id created_at updated_at')
      .sort({ created_at: -1 })
      .lean();

    console.log(`📊 Fetched ${leadsData.length} leads from MongoDB`);

    const timestamp = new Date().toISOString();
    res.json({
      success: true,
      data: leadsData,
      count: leadsData.length,
      source: 'mongodb',
      timestamp: timestamp,
      lastModified: leadsData.length > 0 ? leadsData[0].created_at : timestamp
    });
  } catch (error) {
    console.error('Error fetching leads:', error.message);
    res.status(500).json({
      success: false,
      error: `Failed to fetch leads: ${error.message}`
    });
  }
});

// API endpoint to add a lead manually (for testing)
app.post('/api/leads', async (req, res) => {
  try {
    const { name, email, phone, source, message } = req.body;

    const newLead = new Lead({
      lead_id: Date.now().toString(),
      ad_id: null,
      form_id: null,
      created_time: new Date(),
      field_data: [
        { name: 'full_name', values: [name || 'Unknown'] },
        { name: 'email', values: [email || ''] },
        { name: 'phone_number', values: [phone || ''] }
      ],
      platform: 'manual',
      source: source || 'Manual Entry',
      business_manager_id: BUSINESS_MANAGER_ID,
      page_id: PAGE_ID,
      raw_data: {
        name: name || 'Unknown',
        email: email || '',
        phone: phone || '',
        message: message || ''
      }
    });

    const savedLead = await newLead.save();
    console.log('✅ Manual lead saved to MongoDB with Mongoose:', savedLead._id);

    res.json({
      success: true,
      data: savedLead
    });
  } catch (error) {
    console.error('Error adding lead:', error.message);
    res.status(500).json({
      success: false,
      error: `Failed to add lead: ${error.message}`
    });
  }
});

// API endpoint to get lead statistics
app.get('/api/stats', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        error: 'Database not connected'
      });
    }

    const stats = await Lead.aggregate([
      {
        $group: {
          _id: '$platform',
          count: { $sum: 1 },
          latest: { $max: '$created_at' }
        }
      }
    ]);

    const totalLeads = await Lead.countDocuments();
    const todayLeads = await Lead.countDocuments({
      created_at: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0))
      }
    });

    res.json({
      success: true,
      data: {
        total: totalLeads,
        today: todayLeads,
        byPlatform: stats,
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error.message);
    res.status(500).json({
      success: false,
      error: `Failed to fetch statistics: ${error.message}`
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error processing request:', err.message);
  res.status(500).json({
    success: false,
    error: `Internal Server Error: ${err.message}`
  });
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await mongoose.connection.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await mongoose.connection.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});

// Start server
app.listen(PORT, async () => {
  console.log(`Facebook Webhook Server is running at http://localhost:${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhook`);
  console.log(`API endpoint: http://localhost:${PORT}/api/leads`);
  console.log(`Stats endpoint: http://localhost:${PORT}/api/stats`);
  console.log(`Frontend: http://localhost:${PORT}/`);
  
  console.log('Facebook App configured:');
  console.log(`App ID: ${APP_ID}`);
  console.log(`App Secret: ${APP_SECRET.substring(0, 8)}...`);
  console.log(`Page ID: ${PAGE_ID}`);
  console.log(`Business Manager ID: ${BUSINESS_MANAGER_ID}`);
  console.log('MongoDB connection configured with Mongoose');
  
  // Connect to MongoDB
  await connectToMongoDB();
});