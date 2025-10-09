const express = require('express');
const bodyParser = require('body-parser');
const CryptoJS = require('crypto-js');
const fetch = require('node-fetch');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = 3000;
const VERIFY_TOKEN = 'test_webhook_token_123';
 
const APP_SECRET = 'a063aebddeed769471415e07859e0702'; 

const APP_ID = '819463583930088';
const PAGE_ACCESS_TOKEN = 'EAAQTylq8ZCdsBPnQEJFVGsNpTuK1uRaEDxVq4VEidZAPtWkGSbCXS9Rbt2qtYB3oUKbkyFZCEVf1bAZBM0HaegX3mZC0tw45rKDpBgT5DEsZA62ggm4zeZBMMsDWq16XRE1BoUaCCF1ff8JViRIwKH8U95WR0APXTZBGwJqOGNefzzsGLRZBHxx1WBrcYoD5jpBGZA0KrylyizGlyZAZC5ZB6IaQQjZCSvipBAZC5r7s9mVnVxjzu0ZD';
const PAGE_ID = '849032321617972';
const BUSINESS_MANAGER_ID = "3742628306040446";

// MongoDB configuration
const MONGODB_URI = 'mongodb+srv://luckykhati459_db_user:ajayKhati@cluster0.4hqlabd.mongodb.net/webhook_leads';

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
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
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
    });
    console.log('✅ Connected to MongoDB with Mongoose');
    
    // Test the connection
    const leadCount = await Lead.countDocuments();
    console.log(`📊 Current leads in database: ${leadCount}`);
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    mongoose.connection.close();
  }
}

// Middleware
app.use(bodyParser.json());

// CORS configuration using cors package
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'Cache-Control', 'Pragma'],
  credentials: true,
  maxAge: 86400 // 24 hours
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

// Fetch full lead details from Graph API and save to MongoDB using Mongoose
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

    // Check if lead already exists
    const existingLead = await Lead.findOne({ lead_id: leadData.id });
    if (existingLead) {
      console.log(`Lead ${leadData.id} already exists, skipping duplicate`);
      return;
    }

    // Create new lead using Mongoose
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
    console.error('Error fetching/saving lead:', error);
  }
}


// API endpoint to get all leads (from MongoDB using Mongoose)
app.get('/api/leads', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        error: 'Database not connected'
      });
    }

    // Use Mongoose to fetch leads with optimized query
    const leadsData = await Lead.find({})
      .select('lead_id ad_id form_id created_time field_data platform source business_manager_id page_id created_at updated_at')
      .sort({ created_at: -1 })
      .lean(); // Use lean() for better performance
    
    console.log(`📊 Fetched ${leadsData.length} leads from MongoDB`);

    // Add timestamp for frontend caching
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
    console.error('Error fetching leads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leads'
    });
  }
});

// API endpoint to add a lead manually (for testing) using Mongoose
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
    console.error('Error adding lead:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add lead'
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
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error processing request:', err);
  res.status(500).send('Internal Server Error');
});

// Add graceful shutdown handling
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
  
  // Connect to MongoDB using Mongoose
  await connectToMongoDB();
  
  console.log('Facebook App configured:');
  console.log(`App ID: ${APP_ID}`);
  console.log(`App Secret: ${APP_SECRET.substring(0, 8)}...`);
  console.log(`Page ID: ${PAGE_ID}`);
  console.log(`Business Manager ID: ${BUSINESS_MANAGER_ID}`);
  console.log('MongoDB connection configured with Mongoose');
  console.log('Server optimized for better performance and reduced refreshes');
}); 