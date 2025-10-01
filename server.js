const express = require('express');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuration - Replace with your actual values
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'your_verify_token_here';
const APP_SECRET = process.env.APP_SECRET || 'your_app_secret_here';

// Basic route
app.get('/', (req, res) => {
  res.send('Facebook Webhook Server is running!');
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
        handlePageChange(change, entry);
      });
    });
  } else if (body.object === 'user') {
    // Handle User events
    body.entry.forEach(entry => {
      entry.changes.forEach(change => {
        handleUserChange(change, entry);
      });
    });
  } else if (body.object === 'instagram') {
    // Handle Instagram events
    body.entry.forEach(entry => {
      entry.changes.forEach(change => {
        handleInstagramChange(change, entry);
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
      break;
    case 'posts':
      console.log('New post published');
      break;
    case 'comments':
      console.log('New comment received');
      break;
    case 'messages':
      console.log('New message received');
      break;
    default:
      console.log(`Unhandled page field: ${change.field}`);
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
      break;
    case 'name':
      console.log('User name changed');
      break;
    case 'photos':
      console.log('User uploaded new photo');
      break;
    case 'feed':
      console.log('User posted something');
      break;
    default:
      console.log(`Unhandled user field: ${change.field}`);
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
      break;
    case 'comments':
      console.log('New Instagram comment');
      break;
    case 'mentions':
      console.log('Instagram mention received');
      break;
    default:
      console.log(`Unhandled Instagram field: ${change.field}`);
  }
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