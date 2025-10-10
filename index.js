const express = require('express');
const bodyParser = require('body-parser');
const CryptoJS = require('crypto-js');
const fetch = require('node-fetch');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = 'test_webhook_token_123';
 
const APP_SECRET = 'a063aebddeed769471415e07859e0702'; 

const APP_ID = '819463583930088';
const PAGE_ACCESS_TOKEN = 'EAALpTDvTlugBPm1HZAzt9ii0hBg3lmQ13AZBbQDe9xkYYl0xHggjAei8CZCVFKc3OOecPmk2NWkaUMKqfvmhdrj2gU2ZCKgwvdRJbDSZA8ZAmQnB4CvMKbgJwOooi9ssvTKPRvhMJJkmEeJjk7wdZC45dTMZBSDTS183aPqPocxCRoVWZBQMOCmXTHkjuaAhTNUyDxKq8m4f2';
const PAGE_ID = '849032321617972';
const BUSINESS_MANAGER_ID = "3742628306040446";
const LEADGEN_FORM_ID = "2930627593993454"; // Hardcoded leadgen form ID


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
  
  console.log('=== WEBHOOK RECEIVED ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(body, null, 2));
  console.log('Signature:', signature);

  // Verify signature
  if (signature && APP_SECRET) {
    const elements = signature.split('=');
    const method = elements[0];
    const signatureHash = elements[1];
    const expectedHash = CryptoJS.HmacSHA256(JSON.stringify(body), APP_SECRET).toString(CryptoJS.enc.Hex);

    if (method !== 'sha256' || signatureHash !== expectedHash) {
      console.error('❌ Invalid signature');
      console.error('Expected:', expectedHash);
      console.error('Received:', signatureHash);
      return res.sendStatus(401);
    } else {
      console.log('✅ Signature verified successfully');
    }
  } else {
    console.log('⚠️ No signature verification (APP_SECRET not set)');
  }

  // Process lead event
  if (body.object === 'page') {
    console.log('📄 Processing page object');
    body.entry.forEach((entry, entryIndex) => {
      console.log(`📝 Processing entry ${entryIndex}:`, entry.id);
      entry.changes.forEach((change, changeIndex) => {
        console.log(`🔄 Processing change ${changeIndex}:`, change.field);
        if (change.field === 'leadgen') {
          const leadgenId = change.value.leadgen_id;
          console.log(`🎯 NEW LEAD DETECTED: ${leadgenId}`);
          console.log('Lead details:', JSON.stringify(change.value, null, 2));
          
          
          fetchLeadDetails(leadgenId).catch(err => {
            console.error(`❌ Error processing lead ${leadgenId}:`, err);
          });
        }
      });
    });
  } else {
    console.log('❓ Unknown object type:', body.object);
  }

  console.log('=== WEBHOOK PROCESSING COMPLETE ===');
  res.status(200).send('EVENT_RECEIVED');
});

// Automatically fetch all leads from the hardcoded leadgen form
async function fetchAllLeadsFromForm() {
  console.log(`🔄 Auto-fetching all leads from form: ${LEADGEN_FORM_ID}`);
  
  if (!PAGE_ACCESS_TOKEN || PAGE_ACCESS_TOKEN === 'your_page_access_token_here') {
    console.error('❌ PAGE_ACCESS_TOKEN not set, cannot fetch leads');
    return;
  }

  try {
    console.log(`📡 Making Graph API call to: https://graph.facebook.com/v23.0/${LEADGEN_FORM_ID}/leads`);
    const response = await fetch(`https://graph.facebook.com/v23.0/${LEADGEN_FORM_ID}/leads?access_token=${PAGE_ACCESS_TOKEN}`);
    const data = await response.json();
    
    console.log('📊 Graph API Response:', JSON.stringify(data, null, 2));
    
    if (data.error) {
      console.error('❌ Graph API Error:', data.error);
      throw new Error(`Graph API error: ${data.error.message}`);
    }

    if (!data.data || !Array.isArray(data.data)) {
      console.log('⚠️ No leads data received');
      return;
    }

    console.log(`📋 Found ${data.data.length} leads in form`);
    
    let newLeadsCount = 0;
    let existingLeadsCount = 0;

    // Process each lead
    for (const leadData of data.data) {
      // Check if lead already exists
      const existingLead = await Lead.findOne({ lead_id: leadData.id });
      if (existingLead) {
        existingLeadsCount++;
        console.log(`⚠️ Lead ${leadData.id} already exists, skipping`);
        continue;
      }

      // Create new lead using Mongoose
      const newLead = new Lead({
        lead_id: leadData.id,
        ad_id: leadData.ad_id,
        form_id: leadData.form_id,
        created_time: new Date(leadData.created_time),
        field_data: leadData.field_data,
        platform: 'facebook',
        source: 'leadgen_form',
        business_manager_id: BUSINESS_MANAGER_ID,
        page_id: PAGE_ID,
        raw_data: leadData
      });

      const savedLead = await newLead.save();
      newLeadsCount++;
      console.log(`✅ New lead saved: ${leadData.id} - ${leadData.field_data.find(f => f.name === 'full_name')?.values[0] || 'Unknown'}`);
    }

    // Invalidate cache if new leads were added
    if (newLeadsCount > 0) {
      leadsCache = { data: null, timestamp: null, count: 0, lastModified: null };
      statsCache = { data: null, timestamp: null };
      console.log('🔄 Cache invalidated due to new leads');
    }

    console.log(`🎉 Auto-fetch complete: ${newLeadsCount} new leads, ${existingLeadsCount} existing leads`);


  } catch (error) {
    console.error('❌ Error auto-fetching leads:', error.message);
    console.error('Full error:', error);
  }
}

// Fetch full lead details from Graph API and save to MongoDB using Mongoose
async function fetchLeadDetails(leadgenId) {
  console.log(`🔍 Fetching lead details for ID: ${leadgenId}`);
  
  if (!PAGE_ACCESS_TOKEN || PAGE_ACCESS_TOKEN === 'your_page_access_token_here') {
    console.error('❌ PAGE_ACCESS_TOKEN not set, cannot fetch lead details');
    return;
  }

  try {
    console.log(`📡 Making Graph API call to: https://graph.facebook.com/v23.0/${leadgenId}`);
    const response = await fetch(`https://graph.facebook.com/v23.0/${leadgenId}?access_token=${PAGE_ACCESS_TOKEN}`);
    const leadData = await response.json();
    
    console.log('📊 Graph API Response:', JSON.stringify(leadData, null, 2));
    
    if (leadData.error) {
      console.error('❌ Graph API Error:', leadData.error);
      throw new Error(`Graph API error: ${leadData.error.message}`);
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
    
    // Invalidate cache when new lead is added
    leadsCache = { data: null, timestamp: null, count: 0, lastModified: null };
    statsCache = { data: null, timestamp: null };
    console.log('🔄 Cache invalidated due to new lead');

  } catch (error) {
    console.error('❌ Error fetching/saving lead:', error.message);
    console.error('Full error:', error);
  }
}


// In-memory cache for leads data
let leadsCache = {
  data: null,
  timestamp: null,
  count: 0,
  lastModified: null
};

// Cache duration: 30 seconds
const CACHE_DURATION = 30 * 1000;

// API endpoint to get all leads (from MongoDB using Mongoose) with caching and pagination
app.get('/api/leads', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        error: 'Database not connected'
      });
    }

    // Parse query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50; // Default 50 leads per page
    const platform = req.query.platform; // Filter by platform
    const skip = (page - 1) * limit;

    // Check if we have valid cached data
    const now = Date.now();
    const isCacheValid = leadsCache.timestamp && (now - leadsCache.timestamp) < CACHE_DURATION;

    let leadsData, totalCount;

    if (isCacheValid && !platform && page === 1 && limit === 50) {
      // Use cached data for default pagination
      console.log('📦 Using cached leads data');
      leadsData = leadsCache.data.slice(0, limit);
      totalCount = leadsCache.count;
    } else {
      // Build query filter
      const filter = platform ? { platform } : {};
      
      // Fetch leads with pagination
      const query = Lead.find(filter)
        .select('lead_id ad_id form_id created_time field_data platform source business_manager_id page_id created_at updated_at')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(); // Use lean() for better performance

      leadsData = await query;
      totalCount = await Lead.countDocuments(filter);

      // Update cache only for default query (no filters, first page)
      if (!platform && page === 1 && limit === 50) {
        leadsCache = {
          data: leadsData,
          timestamp: now,
          count: totalCount,
          lastModified: leadsData.length > 0 ? leadsData[0].created_at : new Date()
        };
        console.log('💾 Updated leads cache');
      }
    }
    
    console.log(`📊 Fetched ${leadsData.length} leads from MongoDB (page ${page}, limit ${limit})`);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Add timestamp for frontend caching
    const timestamp = new Date().toISOString();
    
    res.json({
      success: true,
      data: leadsData,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalCount: totalCount,
        limit: limit,
        hasNextPage: hasNextPage,
        hasPrevPage: hasPrevPage
      },
      source: 'mongodb',
      timestamp: timestamp,
      lastModified: leadsData.length > 0 ? leadsData[0].created_at : timestamp,
      cached: isCacheValid && !platform && page === 1 && limit === 50
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
    // Check if this is a Facebook lead (has lead_id, form_id, etc.)
    if (req.body.lead_id && req.body.form_id) {
      // This is a Facebook lead - save it as-is
      const newLead = new Lead(req.body);
      const savedLead = await newLead.save();
      console.log('✅ Facebook lead saved to MongoDB:', savedLead._id);
      
      res.json({
        success: true,
        message: 'Facebook lead saved successfully',
        data: savedLead
      });
    } else {
      // This is a manual lead entry
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
      
      // Invalidate cache when manual lead is added
      leadsCache = { data: null, timestamp: null, count: 0, lastModified: null };
      statsCache = { data: null, timestamp: null };
      console.log('🔄 Cache invalidated due to manual lead');
      
      res.json({
        success: true,
        message: 'Manual lead saved successfully',
        data: savedLead
      });
    }
  } catch (error) {
    console.error('Error adding lead:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add lead'
    });
  }
});

// Cache for statistics
let statsCache = {
  data: null,
  timestamp: null
};

// API endpoint to get lead statistics with caching
app.get('/api/stats', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        error: 'Database not connected'
      });
    }

    // Check if we have valid cached stats
    const now = Date.now();
    const isCacheValid = statsCache.timestamp && (now - statsCache.timestamp) < CACHE_DURATION;

    if (isCacheValid) {
      console.log('📦 Using cached stats data');
      return res.json({
        success: true,
        data: statsCache.data,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }

    // Fetch fresh stats data
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

    const statsData = {
      total: totalLeads,
      today: todayLeads,
      byPlatform: stats,
      lastUpdated: new Date()
    };

    // Update cache
    statsCache = {
      data: statsData,
      timestamp: now
    };

    res.json({
      success: true,
      data: statsData,
      cached: false,
      timestamp: new Date().toISOString()
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

// Auto-fetch leads every 10 minutes (600000 ms) - reduced frequency for better performance
setInterval(() => {
  console.log('⏰ Auto-fetch timer triggered');
  fetchAllLeadsFromForm();
}, 10 * 60 * 1000);

// API endpoint to manually trigger lead fetching
app.get('/api/fetch-leads', async (req, res) => {
  try {
    console.log('🔄 Manual lead fetch triggered via API');
    
    
    await fetchAllLeadsFromForm();
    res.json({
      success: true,
      message: 'Lead fetch completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error in manual lead fetch:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leads',
      message: error.message
    });
  }
});

// API endpoint to warm up cache
app.get('/api/cache/warm', async (req, res) => {
  try {
    console.log('🔥 Warming up cache...');
    
    // Warm up leads cache
    const leadsData = await Lead.find({})
      .select('lead_id ad_id form_id created_time field_data platform source business_manager_id page_id created_at updated_at')
      .sort({ created_at: -1 })
      .limit(50)
      .lean();
    
    const totalCount = await Lead.countDocuments();
    
    leadsCache = {
      data: leadsData,
      timestamp: Date.now(),
      count: totalCount,
      lastModified: leadsData.length > 0 ? leadsData[0].created_at : new Date()
    };
    
    // Warm up stats cache
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

    statsCache = {
      data: {
        total: totalLeads,
        today: todayLeads,
        byPlatform: stats,
        lastUpdated: new Date()
      },
      timestamp: Date.now()
    };
    
    console.log('✅ Cache warmed up successfully');
    
    res.json({
      success: true,
      message: 'Cache warmed up successfully',
      leadsCached: leadsData.length,
      totalLeads: totalCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error warming up cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to warm up cache',
      message: error.message
    });
  }
});

// API endpoint to remove manual leads
app.delete('/api/leads/manual', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        error: 'Database not connected'
      });
    }

    console.log('🗑️ Removing all manual leads from database...');
    
    const result = await Lead.deleteMany({ platform: 'manual' });
    
    console.log(`✅ Removed ${result.deletedCount} manual leads`);
    
    // Invalidate cache after removing leads
    leadsCache = { data: null, timestamp: null, count: 0, lastModified: null };
    statsCache = { data: null, timestamp: null };
    console.log('🔄 Cache invalidated due to lead removal');
    
    res.json({
      success: true,
      message: `Successfully removed ${result.deletedCount} manual leads`,
      deletedCount: result.deletedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error removing manual leads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove manual leads',
      message: error.message
    });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`Facebook Webhook Server is running at http://localhost:${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhook`);
  console.log(`API endpoints:`);
  console.log(`  - Leads: http://localhost:${PORT}/api/leads (with pagination & caching)`);
  console.log(`  - Stats: http://localhost:${PORT}/api/stats (cached)`);
  console.log(`  - Fetch leads: http://localhost:${PORT}/api/fetch-leads`);
  console.log(`  - Remove manual leads: DELETE http://localhost:${PORT}/api/leads/manual`);
  console.log(`  - Warm cache: http://localhost:${PORT}/api/cache/warm`);
  
  // Connect to MongoDB using Mongoose
  await connectToMongoDB();
  
  console.log('\n🔧 Facebook App configured:');
  console.log(`App ID: ${APP_ID}`);
  console.log(`App Secret: ${APP_SECRET.substring(0, 8)}...`);
  console.log(`Page ID: ${PAGE_ID}`);
  console.log(`Leadgen Form ID: ${LEADGEN_FORM_ID}`);
  console.log(`Business Manager ID: ${BUSINESS_MANAGER_ID}`);
  console.log(`Page Access Token: ${PAGE_ACCESS_TOKEN.substring(0, 20)}...`);
  console.log('MongoDB connection configured with Mongoose');
  console.log('\n⏰ Auto-fetch configured: Every 10 minutes (optimized for performance)');
  console.log('🔄 Manual fetch endpoint: /api/fetch-leads');
  console.log('🚀 Latest deployment: Auto-fetch enabled');
  
  // Initial fetch after 5 seconds
  setTimeout(() => {
    console.log('\n🚀 Performing initial lead fetch...');
    fetchAllLeadsFromForm();
  }, 5000);
}); 