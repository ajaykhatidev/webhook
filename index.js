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
const LEADGEN_FORM_ID = "2930627593993454"; // Fallback form ID
let forms = {}; // Dynamic forms object - will be populated by discovery

// WhatsApp Cloud API Configuration (No Business Verification Required)
const WHATSAPP_ACCESS_TOKEN = 'EAALpTDvTlugBPsTZCycZC2V6xCHACQOxMEWc4IaspsFYcUtcC3GZA7r5YPK1LUKJg2iEVVhSezJv9Gc9GII0xGqkUG7sU3uqhchQEbwDZAGknoyzzuhgE3fVcCOhMbgTGvZA7GYWanQYcYdmr34gG0UClPkqBN8ArcQTEivvtdDxZAmOiUWcnqNZAHCs1uKnwZDZD';
const WHATSAPP_PHONE_NUMBER_ID = '1099495012353656'; // This might work with Cloud API
const WHATSAPP_RECIPIENT_NUMBER = '7300733744'; // Your phone number for WhatsApp notifications
const WHATSAPP_ENABLED = true; // Set to false to disable WhatsApp notifications

// Alternative: WhatsApp Web API (using WhatsApp Web)
const WHATSAPP_WEB_ENABLED = true; // Enable WhatsApp Web integration
const WHATSAPP_WEB_SESSION_PATH = './whatsapp-session'; // Session storage path


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

// WhatsApp Business API Functions

// Alternative Method 1: WhatsApp Cloud API (Simpler, no business verification)
async function sendWhatsAppCloudAPI(leadData) {
  try {
    console.log('📱 Sending WhatsApp via Cloud API...');
    
    // Extract lead information
    const name = extractFieldValue(leadData.field_data, 'full_name') || 'Unknown';
    const email = extractFieldValue(leadData.field_data, 'email') || 'No email';
    const phone = extractFieldValue(leadData.field_data, 'phone_number') || 'No phone';
    const platform = leadData.platform || 'Unknown';
    const leadId = leadData.lead_id || 'Unknown';
    
    // Create notification message
    const message = `🎯 *NEW LEAD RECEIVED!*

📋 *Lead Details:*
• Name: ${name}
• Email: ${email}
• Phone: ${phone}
• Platform: ${platform}
• Lead ID: ${leadId}
• Time: ${new Date().toLocaleString()}

🚀 Lead has been automatically saved to your dashboard!`;

    // Try Cloud API endpoint
    const cloudApiUrl = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    
    const payload = {
      messaging_product: "whatsapp",
      to: WHATSAPP_RECIPIENT_NUMBER,
      type: "text",
      text: {
        body: message
      }
    };

    console.log('📱 Cloud API Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(cloudApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ WhatsApp Cloud API notification sent successfully:', result);
      return { success: true, method: 'cloud_api', result };
    } else {
      console.error('❌ WhatsApp Cloud API failed:', result);
      return { success: false, method: 'cloud_api', error: result };
    }

  } catch (error) {
    console.error('❌ Error sending WhatsApp Cloud API notification:', error.message);
    return { success: false, method: 'cloud_api', error: error.message };
  }
}

// Alternative Method 2: Simple HTTP Webhook (for testing)
async function sendWebhookNotification(leadData) {
  try {
    console.log('📱 Sending webhook notification...');
    
    const name = extractFieldValue(leadData.field_data, 'full_name') || 'Unknown';
    const email = extractFieldValue(leadData.field_data, 'email') || 'No email';
    const phone = extractFieldValue(leadData.field_data, 'phone_number') || 'No phone';
    
    const webhookData = {
      message: `🎯 NEW LEAD RECEIVED!\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nPlatform: ${leadData.platform}\nTime: ${new Date().toLocaleString()}`,
      lead_id: leadData.lead_id,
      timestamp: new Date().toISOString()
    };
    
    // You can send this to any webhook service like Zapier, IFTTT, etc.
    console.log('📱 Webhook data ready:', JSON.stringify(webhookData, null, 2));
    
    return { success: true, method: 'webhook', data: webhookData };
    
  } catch (error) {
    console.error('❌ Error sending webhook notification:', error.message);
    return { success: false, method: 'webhook', error: error.message };
  }
}

// Function to discover WhatsApp phone numbers
async function discoverWhatsAppPhoneNumbers() {
  try {
    console.log('🔍 Discovering WhatsApp phone numbers...');
    
    // Try to get phone numbers from the business account
    const response = await fetch(`https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/phone_numbers?access_token=${WHATSAPP_ACCESS_TOKEN}`);
    const data = await response.json();
    
    console.log('📱 WhatsApp Phone Numbers Response:', JSON.stringify(data, null, 2));
    
    if (data.error) {
      console.error('❌ Error discovering phone numbers:', data.error);
      
      // Try alternative endpoint
      console.log('🔄 Trying alternative endpoint...');
      const altResponse = await fetch(`https://graph.facebook.com/v18.0/me/phone_numbers?access_token=${WHATSAPP_ACCESS_TOKEN}`);
      const altData = await altResponse.json();
      
      console.log('📱 Alternative Phone Numbers Response:', JSON.stringify(altData, null, 2));
      return altData;
    }
    
    return data;
    
  } catch (error) {
    console.error('❌ Error discovering phone numbers:', error.message);
    return { error: error.message };
  }
}

async function sendWhatsAppNotification(leadData) {
  if (!WHATSAPP_ENABLED) {
    console.log('⚠️ WhatsApp notifications disabled');
    return;
  }

  console.log('📱 Attempting WhatsApp notification with multiple methods...');

  // Try Method 1: WhatsApp Cloud API (no business verification required)
  const cloudResult = await sendWhatsAppCloudAPI(leadData);
  if (cloudResult.success) {
    console.log('✅ WhatsApp Cloud API succeeded!');
    return cloudResult;
  }

  // Try Method 2: Webhook notification (always works)
  const webhookResult = await sendWebhookNotification(leadData);
  if (webhookResult.success) {
    console.log('✅ Webhook notification succeeded!');
    console.log('📱 You can use this webhook data with Zapier, IFTTT, or any webhook service');
    return webhookResult;
  }

  console.log('❌ All WhatsApp methods failed, but lead was still saved to database');
}

// Helper function to extract field values (same as frontend)
function extractFieldValue(fieldData, fieldName) {
  if (!fieldData || !Array.isArray(fieldData)) {
    return 'Unknown';
  }
  
  const fieldVariations = [
    fieldName,
    fieldName.toLowerCase(),
    fieldName.toUpperCase(),
    fieldName.replace('_', ' '),
    fieldName.replace('_', ''),
    fieldName.replace('_', '-'),
    fieldName === 'full_name' ? 'name' : null,
    fieldName === 'full_name' ? 'fullname' : null,
    fieldName === 'phone_number' ? 'phone' : null,
    fieldName === 'phone_number' ? 'mobile' : null,
    fieldName === 'phone_number' ? 'telephone' : null,
    fieldName === 'email' ? 'email_address' : null,
    fieldName === 'email' ? 'e_mail' : null,
  ].filter(Boolean);
  
  for (const variation of fieldVariations) {
    const field = fieldData.find(f => 
      f.name === variation || 
      f.name === variation.toLowerCase() ||
      f.name === variation.toUpperCase() ||
      f.name === variation.replace('_', ' ') ||
      f.name === variation.replace('_', '') ||
      f.name === variation.replace('_', '-')
    );
    
    if (field && field.values && Array.isArray(field.values) && field.values.length > 0) {
      return field.values.join(', ');
    }
  }
  
  return 'Unknown';
}


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

// Enhanced function to fetch leads from specific form
async function fetchLeadsFromForm(formId) {
  console.log(`🔄 Fetching leads from form: ${formId}`);
  
  if (!PAGE_ACCESS_TOKEN || PAGE_ACCESS_TOKEN === 'your_page_access_token_here') {
    console.error('❌ PAGE_ACCESS_TOKEN not set');
    return { newLeads: 0, existingLeads: 0 };
  }

  try {
    console.log(`📡 Making Graph API call to: https://graph.facebook.com/v23.0/${formId}/leads`);
    const response = await fetch(`https://graph.facebook.com/v23.0/${formId}/leads?access_token=${PAGE_ACCESS_TOKEN}`);
    const data = await response.json();
    
    console.log(`📊 Graph API Response for form ${formId}:`, JSON.stringify(data, null, 2));
    
    if (data.error) {
      console.error(`❌ Graph API Error for form ${formId}:`, data.error);
      return { newLeads: 0, existingLeads: 0 };
    }

    if (!data.data || !Array.isArray(data.data)) {
      console.log(`⚠️ No leads data received for form ${formId}`);
      return { newLeads: 0, existingLeads: 0 };
    }

    console.log(`📋 Found ${data.data.length} leads in form ${formId}`);
    
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
      console.log(`✅ New lead saved from form ${formId}: ${leadData.id} - ${leadData.field_data.find(f => f.name === 'full_name')?.values[0] || 'Unknown'}`);
      
      // Send WhatsApp notification for new lead
      await sendWhatsAppNotification(leadData);
    }

    return { newLeads: newLeadsCount, existingLeads: existingLeadsCount };
    
  } catch (error) {
    console.error(`❌ Error fetching form ${formId}:`, error.message);
    console.error('Full error:', error);
    return { newLeads: 0, existingLeads: 0 };
  }
}

// Function to discover all forms from Facebook
async function discoverAllForms() {
  try {
    console.log('🔍 Discovering all forms from Facebook...');
    
    const response = await fetch(`https://graph.facebook.com/v23.0/${PAGE_ID}/leadgen_forms?access_token=${PAGE_ACCESS_TOKEN}`);
    const data = await response.json();
    
    if (data.error) {
      console.error('❌ Error discovering forms:', data.error);
      return [];
    }
    
    // Populate forms object with discovered form IDs
    forms = {};
    data.data.forEach(form => {
      forms[form.id] = true;
      console.log(`✅ Discovered form: ${form.id} (${form.name})`);
    });
    
    console.log(`🎉 Discovered ${data.data.length} forms:`, Object.keys(forms));
    return data.data;
    
  } catch (error) {
    console.error('❌ Error discovering forms:', error.message);
    return [];
  }
}

// Helper function to get all active form IDs
function getActiveFormIds() {
  return Object.keys(forms).filter(formId => forms[formId] === true);
}

// Enhanced auto-fetch function with dynamic form discovery
async function fetchAllLeadsFromAllForms() {
  try {
    console.log('🔄 Auto-fetching leads from all forms...');
    
    // 1. FIRST: Discover all forms from Facebook
    await discoverAllForms();
    
    // 2. THEN: Get active form IDs
    const activeFormIds = getActiveFormIds();
    
    // Fallback to hardcoded form if no forms discovered
    if (activeFormIds.length === 0) {
      console.log('⚠️ No forms discovered, using fallback form');
      forms[LEADGEN_FORM_ID] = true;
      activeFormIds.push(LEADGEN_FORM_ID);
    }
    
    console.log(`📋 Found ${activeFormIds.length} active forms:`, activeFormIds);
    
    let totalNewLeads = 0;
    let totalExistingLeads = 0;
    
    // 3. FINALLY: Fetch leads from each discovered form
    for (const formId of activeFormIds) {
      console.log(`🔄 Fetching from form: ${formId}`);
      
      const result = await fetchLeadsFromForm(formId);
      totalNewLeads += result.newLeads || 0;
      totalExistingLeads += result.existingLeads || 0;
    }
    
    // Invalidate cache if new leads were added
    if (totalNewLeads > 0) {
      leadsCache = { data: null, timestamp: null, count: 0, lastModified: null };
      statsCache = { data: null, timestamp: null };
      console.log('🔄 Cache invalidated due to new leads');
    }
    
    console.log(`🎉 Auto-fetch complete: ${totalNewLeads} new leads, ${totalExistingLeads} existing leads from ${activeFormIds.length} forms`);
    
  } catch (error) {
    console.error('❌ Error auto-fetching all forms:', error.message);
    console.error('Full error:', error);
  }
}

// Legacy function for backward compatibility
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
      
      // Send WhatsApp notification for new lead
      await sendWhatsAppNotification(leadData);
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
    
    // Send WhatsApp notification for new lead
    await sendWhatsAppNotification(leadData);
    
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
      
      // Send WhatsApp notification for manual lead
      await sendWhatsAppNotification(savedLead);
      
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

// Auto-fetch leads every 10 minutes (600000 ms) - now supports multiple forms
setInterval(() => {
  console.log('⏰ Auto-fetch timer triggered');
  fetchAllLeadsFromAllForms(); // Use new multi-form function
}, 10 * 60 * 1000);

// API endpoint to manually trigger lead fetching (now supports multiple forms)
app.get('/api/fetch-leads', async (req, res) => {
  try {
    console.log('🔄 Manual lead fetch triggered via API');
    
    await fetchAllLeadsFromAllForms(); // Use new multi-form function
    res.json({
      success: true,
      message: 'Lead fetch completed successfully (all forms)',
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

// API endpoint to manually trigger single form lead fetching (legacy)
app.get('/api/fetch-leads/single', async (req, res) => {
  try {
    console.log('🔄 Manual single form lead fetch triggered via API');
    
    await fetchAllLeadsFromForm(); // Use legacy single form function
    res.json({
      success: true,
      message: 'Single form lead fetch completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error in manual single form lead fetch:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leads from single form',
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

// API to get all unique forms from database
app.get('/api/forms', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        error: 'Database not connected'
      });
    }

    const forms = await Lead.aggregate([
      {
        $group: {
          _id: '$form_id',
          lead_count: { $sum: 1 },
          campaigns: { $addToSet: '$ad_id' },
          latest_lead: { $max: '$created_at' },
          platforms: { $addToSet: '$platform' }
        }
      },
      { $sort: { lead_count: -1 } }
    ]);
    
    res.json({
      success: true,
      data: forms,
      count: forms.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching forms:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch forms',
      message: error.message 
    });
  }
});

// API to get campaigns data - now groups by actual form_id dynamically
app.get('/api/campaigns', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        error: 'Database not connected'
      });
    }

    // Group by form_id dynamically - handles multiple forms
    const campaigns = await Lead.aggregate([
      {
        $group: {
          _id: '$form_id',
          form_id: { $first: '$form_id' },
          ad_id: { $first: '$ad_id' },
          lead_count: { $sum: 1 },
          latest_lead: { $max: '$created_at' },
          platforms: { $addToSet: '$platform' },
          sources: { $addToSet: '$source' }
        }
      },
      { $sort: { lead_count: -1 } }
    ]);
    
    res.json({
      success: true,
      data: campaigns,
      count: campaigns.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching campaigns:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch campaigns',
      message: error.message 
    });
  }
});

// API to get leads by specific campaign - now filters by form_id properly
app.get('/api/campaigns/:campaignId/leads', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        error: 'Database not connected'
      });
    }

    const { campaignId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    // Filter by form_id - handles both null and actual form IDs
    const filter = campaignId === 'null' ? { form_id: null } : { form_id: campaignId };
    
    const leads = await Lead.find(filter)
      .select('lead_id ad_id form_id created_time field_data platform source business_manager_id page_id created_at updated_at')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const totalCount = await Lead.countDocuments(filter);
    
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    res.json({
      success: true,
      data: leads,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalCount: totalCount,
        limit: limit,
        hasNextPage: hasNextPage,
        hasPrevPage: hasPrevPage
      },
      campaignId: campaignId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching campaign leads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign leads',
      message: error.message
    });
  }
});

// API to manually discover and fetch from all forms
app.get('/api/discover-forms', async (req, res) => {
  try {
    console.log('🔍 Manually discovering all forms from Facebook...');
    
    if (!PAGE_ACCESS_TOKEN || PAGE_ACCESS_TOKEN === 'your_page_access_token_here') {
      return res.status(400).json({
        success: false,
        error: 'PAGE_ACCESS_TOKEN not configured'
      });
    }
    
    // Use our new discoverAllForms function
    const discoveredForms = await discoverAllForms();
    
    if (discoveredForms.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No forms discovered from Facebook'
      });
    }
    
    console.log(`📋 Found ${discoveredForms.length} forms from Facebook`);
    
    // Fetch leads from each discovered form
    let totalNewLeads = 0;
    let totalExistingLeads = 0;
    const formResults = [];
    
    for (const form of discoveredForms) {
      console.log(`🔄 Fetching leads from form: ${form.id}`);
      const result = await fetchLeadsFromForm(form.id);
      totalNewLeads += result.newLeads || 0;
      totalExistingLeads += result.existingLeads || 0;
      
      formResults.push({
        form_id: form.id,
        form_name: form.name,
        newLeads: result.newLeads || 0,
        existingLeads: result.existingLeads || 0
      });
    }
    
    // Invalidate cache if new leads were added
    if (totalNewLeads > 0) {
      leadsCache = { data: null, timestamp: null, count: 0, lastModified: null };
      statsCache = { data: null, timestamp: null };
      console.log('🔄 Cache invalidated due to new leads');
    }
    
    res.json({
      success: true,
      message: `Discovered ${discoveredForms.length} forms`,
      forms: discoveredForms,
      formResults: formResults,
      summary: {
        totalNewLeads: totalNewLeads,
        totalExistingLeads: totalExistingLeads,
        formsProcessed: discoveredForms.length
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error discovering forms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to discover forms',
      message: error.message
    });
  }
});

// API endpoint to test WhatsApp notifications (multiple methods)
app.post('/api/test-whatsapp', async (req, res) => {
  try {
    console.log('📱 Testing WhatsApp notification with multiple methods...');
    
    // Create a test lead data
    const testLeadData = {
      lead_id: 'TEST_' + Date.now(),
      field_data: [
        { name: 'full_name', values: ['Test Lead'] },
        { name: 'email', values: ['test@example.com'] },
        { name: 'phone_number', values: ['+1234567890'] }
      ],
      platform: 'manual',
      created_time: new Date()
    };
    
    const result = await sendWhatsAppNotification(testLeadData);
    
    res.json({
      success: true,
      message: 'WhatsApp test completed',
      result: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error testing WhatsApp:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send WhatsApp test notification',
      message: error.message
    });
  }
});

// API endpoint to test Cloud API specifically
app.post('/api/test-whatsapp-cloud', async (req, res) => {
  try {
    console.log('📱 Testing WhatsApp Cloud API...');
    
    const testLeadData = {
      lead_id: 'CLOUD_TEST_' + Date.now(),
      field_data: [
        { name: 'full_name', values: ['Cloud API Test'] },
        { name: 'email', values: ['cloud@test.com'] },
        { name: 'phone_number', values: ['+1234567890'] }
      ],
      platform: 'manual',
      created_time: new Date()
    };
    
    const result = await sendWhatsAppCloudAPI(testLeadData);
    
    res.json({
      success: result.success,
      message: result.success ? 'Cloud API test successful' : 'Cloud API test failed',
      result: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error testing Cloud API:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test Cloud API',
      message: error.message
    });
  }
});

// API endpoint to test webhook notification
app.post('/api/test-webhook', async (req, res) => {
  try {
    console.log('📱 Testing webhook notification...');
    
    const testLeadData = {
      lead_id: 'WEBHOOK_TEST_' + Date.now(),
      field_data: [
        { name: 'full_name', values: ['Webhook Test'] },
        { name: 'email', values: ['webhook@test.com'] },
        { name: 'phone_number', values: ['+1234567890'] }
      ],
      platform: 'manual',
      created_time: new Date()
    };
    
    const result = await sendWebhookNotification(testLeadData);
    
    res.json({
      success: result.success,
      message: result.success ? 'Webhook test successful' : 'Webhook test failed',
      result: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error testing webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test webhook',
      message: error.message
    });
  }
});

// API endpoint to create test lead with your phone number
app.post('/api/create-test-lead', async (req, res) => {
  try {
    console.log('📱 Creating test lead with your phone number...');
    
    const testLeadData = {
      lead_id: 'TEST_LEAD_' + Date.now(),
      field_data: [
        { name: 'full_name', values: ['Test User'] },
        { name: 'email', values: ['test@example.com'] },
        { name: 'phone_number', values: ['7300733744'] },
        { name: 'city', values: ['Test City'] }
      ],
      platform: 'manual',
      source: 'Test Lead Creation',
      created_time: new Date(),
      business_manager_id: BUSINESS_MANAGER_ID,
      page_id: PAGE_ID,
      raw_data: {
        name: 'Test User',
        email: 'test@example.com',
        phone: '7300733744',
        city: 'Test City'
      }
    };

    // Save to database
    const newLead = new Lead(testLeadData);
    const savedLead = await newLead.save();
    console.log('✅ Test lead saved to MongoDB:', savedLead._id);
    
    // Send WhatsApp notification
    const whatsappResult = await sendWhatsAppNotification(testLeadData);
    
    res.json({
      success: true,
      message: 'Test lead created and WhatsApp notification sent',
      lead: savedLead,
      whatsappResult: whatsappResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error creating test lead:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create test lead',
      message: error.message
    });
  }
});

// API endpoint to send WhatsApp message to your number
app.post('/api/send-whatsapp-to-me', async (req, res) => {
  try {
    console.log('📱 Sending WhatsApp message to your number: 7300733744');
    
    const { message } = req.body;
    const customMessage = message || `🎯 *TEST MESSAGE FROM YOUR LEAD SYSTEM*

📱 *Message Details:*
• Time: ${new Date().toLocaleString()}
• From: Lead Management System
• Status: System Test

🚀 This is a test message to verify WhatsApp integration!`;

    const testLeadData = {
      lead_id: 'CUSTOM_MESSAGE_' + Date.now(),
      field_data: [
        { name: 'full_name', values: ['Custom Message Test'] },
        { name: 'email', values: ['custom@test.com'] },
        { name: 'phone_number', values: ['7300733744'] }
      ],
      platform: 'manual',
      created_time: new Date()
    };

    // Override the message in the notification function
    const originalMessage = testLeadData.field_data;
    testLeadData.customMessage = customMessage;
    
    const result = await sendWhatsAppCloudAPI(testLeadData);
    
    res.json({
      success: result.success,
      message: result.success ? 'WhatsApp message sent successfully' : 'WhatsApp message failed',
      result: result,
      recipient: '7300733744',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send WhatsApp message',
      message: error.message
    });
  }
});

// API endpoint to discover WhatsApp phone numbers
app.get('/api/whatsapp-phone-numbers', async (req, res) => {
  try {
    console.log('📱 Discovering WhatsApp phone numbers via API...');
    
    const phoneNumbers = await discoverWhatsAppPhoneNumbers();
    
    res.json({
      success: true,
      data: phoneNumbers,
      message: 'WhatsApp phone numbers discovered',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error discovering phone numbers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to discover phone numbers',
      message: error.message
    });
  }
});

// API endpoint to configure WhatsApp settings
app.post('/api/whatsapp-config', async (req, res) => {
  try {
    const { phoneNumberId, recipientNumber, enabled } = req.body;
    
    // Update configuration (in production, you'd want to store this in a database)
    if (phoneNumberId) WHATSAPP_PHONE_NUMBER_ID = phoneNumberId;
    if (recipientNumber) WHATSAPP_RECIPIENT_NUMBER = recipientNumber;
    if (typeof enabled === 'boolean') WHATSAPP_ENABLED = enabled;
    
    console.log('📱 WhatsApp configuration updated:', {
      phoneNumberId: WHATSAPP_PHONE_NUMBER_ID,
      recipientNumber: WHATSAPP_RECIPIENT_NUMBER,
      enabled: WHATSAPP_ENABLED
    });
    
    res.json({
      success: true,
      message: 'WhatsApp configuration updated successfully',
      config: {
        phoneNumberId: WHATSAPP_PHONE_NUMBER_ID,
        recipientNumber: WHATSAPP_RECIPIENT_NUMBER,
        enabled: WHATSAPP_ENABLED
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error updating WhatsApp config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update WhatsApp configuration',
      message: error.message
    });
  }
});

// API to fix form_id issues - update all leads to use discovered form_id
app.post('/api/fix-form-ids', async (req, res) => {
  try {
    console.log('🔧 Fixing form_id issues...');
    
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        error: 'Database not connected'
      });
    }

    // First, discover all forms to get the active form IDs
    await discoverAllForms();
    const activeFormIds = getActiveFormIds();
    
    if (activeFormIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No forms discovered. Please discover forms first.'
      });
    }

    // Use the first discovered form ID as the main form ID
    const mainFormId = activeFormIds[0];
    console.log(`📋 Using main form ID: ${mainFormId}`);

    // Update all leads with null form_id to use the main form ID
    const updateResult = await Lead.updateMany(
      { form_id: null },
      { $set: { form_id: mainFormId } }
    );

    console.log(`✅ Updated ${updateResult.modifiedCount} leads with null form_id`);

    // Also update any leads that might have inconsistent form_ids
    const inconsistentUpdate = await Lead.updateMany(
      { form_id: { $ne: mainFormId, $ne: null } },
      { $set: { form_id: mainFormId } }
    );

    console.log(`✅ Updated ${inconsistentUpdate.modifiedCount} leads with inconsistent form_id`);

    // Invalidate cache
    leadsCache = { data: null, timestamp: null, count: 0, lastModified: null };
    statsCache = { data: null, timestamp: null };

    res.json({
      success: true,
      message: `Fixed form_id issues successfully`,
      summary: {
        mainFormId: mainFormId,
        nullFormIdUpdated: updateResult.modifiedCount,
        inconsistentFormIdUpdated: inconsistentUpdate.modifiedCount,
        totalUpdated: updateResult.modifiedCount + inconsistentUpdate.modifiedCount
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fixing form_id issues:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fix form_id issues',
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
  console.log(`  - Forms: http://localhost:${PORT}/api/forms (all forms from database)`);
  console.log(`  - Campaigns: http://localhost:${PORT}/api/campaigns (all campaigns)`);
  console.log(`  - Campaign leads: http://localhost:${PORT}/api/campaigns/:campaignId/leads`);
  console.log(`  - Fetch leads: http://localhost:${PORT}/api/fetch-leads (all forms)`);
  console.log(`  - Fetch single form: http://localhost:${PORT}/api/fetch-leads/single`);
  console.log(`  - Discover forms: http://localhost:${PORT}/api/discover-forms`);
  console.log(`  - Fix form IDs: POST http://localhost:${PORT}/api/fix-form-ids`);
  console.log(`  - Remove manual leads: DELETE http://localhost:${PORT}/api/leads/manual`);
  console.log(`  - Warm cache: http://localhost:${PORT}/api/cache/warm`);
  console.log(`  - Test WhatsApp: POST http://localhost:${PORT}/api/test-whatsapp`);
  console.log(`  - Test Cloud API: POST http://localhost:${PORT}/api/test-whatsapp-cloud`);
  console.log(`  - Test Webhook: POST http://localhost:${PORT}/api/test-webhook`);
  console.log(`  - Create Test Lead: POST http://localhost:${PORT}/api/create-test-lead`);
  console.log(`  - Send WhatsApp to Me: POST http://localhost:${PORT}/api/send-whatsapp-to-me`);
  console.log(`  - WhatsApp config: POST http://localhost:${PORT}/api/whatsapp-config`);
  console.log(`  - Discover phone numbers: GET http://localhost:${PORT}/api/whatsapp-phone-numbers`);
  
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
  console.log('\n📱 WhatsApp Integration:');
  console.log(`WhatsApp Token: ${WHATSAPP_ACCESS_TOKEN.substring(0, 20)}...`);
  console.log(`Phone Number ID: ${WHATSAPP_PHONE_NUMBER_ID}`);
  console.log(`Recipient Number: ${WHATSAPP_RECIPIENT_NUMBER}`);
  console.log(`Notifications Enabled: ${WHATSAPP_ENABLED}`);
  console.log('\n⏰ Auto-fetch configured: Every 10 minutes (multi-form support)');
  console.log('🔄 Manual fetch endpoints: /api/fetch-leads (all forms), /api/fetch-leads/single');
  console.log('🔍 Form discovery: /api/discover-forms');
  console.log('📊 Campaign analytics: /api/campaigns, /api/forms');
  console.log('📱 WhatsApp notifications: /api/test-whatsapp, /api/whatsapp-config');
  console.log('🚀 Latest deployment: Multi-form auto-fetch + WhatsApp notifications enabled');
  
  // Initial fetch after 5 seconds (multi-form)
  setTimeout(() => {
    console.log('\n🚀 Performing initial multi-form lead fetch...');
    fetchAllLeadsFromAllForms();
  }, 5000);
}); 