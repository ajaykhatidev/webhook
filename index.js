require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

// Configuration - Replace with your actual values
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'test_webhook_token_123';
const APP_SECRET = process.env.APP_SECRET || 'test_app_secret_456';

// Basic route
app.get('/', (req, res) => {
  res.send('Facebook Webhook Server is running!');
});

// In-memory storage for leads (in production, use a database)
let leads = [];

// API endpoint to get leads
app.get('/api/leads', (req, res) => {
  try {
    res.json({
      success: true,
      data: leads,
      count: leads.length
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
app.post('/api/leads', (req, res) => {
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
      createdAt: new Date().toISOString()
    };
    
    leads.unshift(newLead); // Add to beginning of array
    
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

// Facebook Webhook Verification Endpoint
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('Webhook verification request:', { mode, token, challenge });

  // Check if verification token matches
  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
    console.log('Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.log('Webhook verification failed');
    res.status(403).send('Forbidden');
  }
});

// Facebook Webhook Event Handler
app.post('/webhook', (req, res) => {
  const body = req.body;
  
  console.log('Received webhook event:', JSON.stringify(body, null, 2));

  // Verify webhook signature (optional but recommended for production)
  const signature = req.headers['x-hub-signature-256'];
  if (signature && !verifyWebhookSignature(body, signature)) {
    console.log('Invalid webhook signature');
    return res.status(403).send('Invalid signature');
  }

  // Process different types of webhook events
  if (body.object === 'page') {
    // Handle Page events
    body.entry.forEach(entry => {
      entry.changes.forEach(change => {
        const lead = handlePageChange(change, entry);
        if (lead) {
          leads.unshift(lead); // Add new lead to the beginning
          console.log('New lead added:', lead);
        }
      });
    });
  } else if (body.object === 'user') {
    // Handle User events
    body.entry.forEach(entry => {
      entry.changes.forEach(change => {
        const lead = handleUserChange(change, entry);
        if (lead) {
          leads.unshift(lead);
          console.log('New lead added:', lead);
        }
      });
    });
  } else if (body.object === 'instagram') {
    // Handle Instagram events
    body.entry.forEach(entry => {
      entry.changes.forEach(change => {
        const lead = handleInstagramChange(change, entry);
        if (lead) {
          leads.unshift(lead);
          console.log('New lead added:', lead);
        }
      });
    });
  }

  res.status(200).send('OK');
});

// Webhook signature verification function
function verifyWebhookSignature(body, signature) {
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', APP_SECRET)
    .update(JSON.stringify(body))
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Event handlers for different object types
function handlePageChange(change, entry) {
  console.log('Page change detected:', {
    field: change.field,
    value: change.value,
    pageId: entry.id,
    time: entry.time
  });

  // Handle specific page field changes
  switch (change.field) {
    case 'feed':
      console.log('New post or comment on page feed');
      return createLeadFromPageChange(change, entry, 'Page Feed');
    case 'posts':
      console.log('New post published');
      return createLeadFromPageChange(change, entry, 'Page Post');
    case 'comments':
      console.log('New comment received');
      return createLeadFromPageChange(change, entry, 'Page Comment');
    case 'messages':
      console.log('New message received');
      return createLeadFromPageChange(change, entry, 'Page Message');
    default:
      console.log(`Unhandled page field: ${change.field}`);
      return null;
  }
}

function handleUserChange(change, entry) {
  console.log('User change detected:', {
    field: change.field,
    value: change.value,
    userId: entry.uid,
    time: entry.time
  });

  // Handle specific user field changes
  switch (change.field) {
    case 'email':
      console.log('User email changed');
      return createLeadFromUserChange(change, entry, 'User Email');
    case 'name':
      console.log('User name changed');
      return createLeadFromUserChange(change, entry, 'User Name');
    case 'photos':
      console.log('User uploaded new photo');
      return createLeadFromUserChange(change, entry, 'User Photo');
    case 'feed':
      console.log('User posted something');
      return createLeadFromUserChange(change, entry, 'User Feed');
    default:
      console.log(`Unhandled user field: ${change.field}`);
      return null;
  }
}

function handleInstagramChange(change, entry) {
  console.log('Instagram change detected:', {
    field: change.field,
    value: change.value,
    instagramId: entry.id,
    time: entry.time
  });

  // Handle specific Instagram field changes
  switch (change.field) {
    case 'media':
      console.log('New Instagram media posted');
      return createLeadFromInstagramChange(change, entry, 'Instagram Media');
    case 'comments':
      console.log('New Instagram comment');
      return createLeadFromInstagramChange(change, entry, 'Instagram Comment');
    case 'mentions':
      console.log('Instagram mention received');
      return createLeadFromInstagramChange(change, entry, 'Instagram Mention');
    default:
      console.log(`Unhandled Instagram field: ${change.field}`);
      return null;
  }
}

// Helper functions to create lead objects from webhook events
function createLeadFromPageChange(change, entry, source) {
  const value = change.value;
  return {
    id: Date.now() + Math.random(),
    name: value.from?.name || 'Unknown User',
    email: value.email || '',
    phone: value.phone || '',
    source: source,
    status: 'New',
    message: value.message || value.text || 'Page interaction',
    createdAt: new Date().toISOString(),
    metadata: {
      pageId: entry.id,
      field: change.field,
      rawData: value
    }
  };
}

function createLeadFromUserChange(change, entry, source) {
  const value = change.value;
  return {
    id: Date.now() + Math.random(),
    name: value.name || 'Unknown User',
    email: value.email || '',
    phone: value.phone || '',
    source: source,
    status: 'New',
    message: `User ${change.field} updated`,
    createdAt: new Date().toISOString(),
    metadata: {
      userId: entry.uid,
      field: change.field,
      rawData: value
    }
  };
}

function createLeadFromInstagramChange(change, entry, source) {
  const value = change.value;
  return {
    id: Date.now() + Math.random(),
    name: value.from?.username || 'Unknown User',
    email: value.email || '',
    phone: value.phone || '',
    source: source,
    status: 'New',
    message: value.text || value.caption || 'Instagram interaction',
    createdAt: new Date().toISOString(),
    metadata: {
      instagramId: entry.id,
      field: change.field,
      rawData: value
    }
  };
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error processing webhook:', err);
  res.status(500).send('Internal Server Error');
});

app.listen(port, () => {
  console.log(`Facebook Webhook Server is running at http://localhost:${port}`);
  console.log(`Webhook endpoint: http://localhost:${port}/webhook`);
  console.log('Make sure to set WEBHOOK_VERIFY_TOKEN and APP_SECRET environment variables');
});