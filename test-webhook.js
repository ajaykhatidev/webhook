// Test script for webhook functionality
const crypto = require('crypto');

// Test credentials
const WEBHOOK_URL = 'https://webhook-100u.onrender.com/webhook';
const API_URL = 'https://webhook-100u.onrender.com/api/leads';
const VERIFY_TOKEN = 'test_webhook_token_123';
const APP_SECRET = 'test_app_secret_456';

console.log('🧪 Webhook Testing Script');
console.log('========================\n');

// Test 1: Basic server connectivity
async function testServerConnectivity() {
  console.log('1. Testing server connectivity...');
  try {
    const response = await fetch('https://webhook-100u.onrender.com/');
    if (response.ok) {
      const text = await response.text();
      console.log('✅ Server is running:', text);
      return true;
    } else {
      console.log('❌ Server returned status:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Server connection failed:', error.message);
    return false;
  }
}

// Test 2: Webhook verification
async function testWebhookVerification() {
  console.log('\n2. Testing webhook verification...');
  try {
    const challenge = 'test_challenge_123';
    const url = `${WEBHOOK_URL}?hub.mode=subscribe&hub.challenge=${challenge}&hub.verify_token=${VERIFY_TOKEN}`;
    
    const response = await fetch(url);
    if (response.ok) {
      const text = await response.text();
      if (text === challenge) {
        console.log('✅ Webhook verification successful');
        return true;
      } else {
        console.log('❌ Webhook verification failed - wrong challenge returned');
        return false;
      }
    } else {
      console.log('❌ Webhook verification failed - status:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Webhook verification error:', error.message);
    return false;
  }
}

// Test 3: API endpoint
async function testAPIEndpoint() {
  console.log('\n3. Testing API endpoint...');
  try {
    const response = await fetch(API_URL);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API endpoint working:', data);
      return true;
    } else {
      console.log('❌ API endpoint failed - status:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ API endpoint error:', error.message);
    return false;
  }
}

// Test 4: Add test lead
async function testAddLead() {
  console.log('\n4. Testing add lead...');
  try {
    const testLead = {
      name: 'Test User',
      email: 'test@example.com',
      phone: '+1234567890',
      source: 'Manual Test',
      message: 'This is a test lead from script'
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testLead)
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Lead added successfully:', data);
      return true;
    } else {
      console.log('❌ Add lead failed - status:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Add lead error:', error.message);
    return false;
  }
}

// Test 5: Simulate webhook event
async function testWebhookEvent() {
  console.log('\n5. Testing webhook event simulation...');
  try {
    const webhookEvent = {
      object: 'page',
      entry: [{
        id: 'test_page_id',
        time: Math.floor(Date.now() / 1000),
        changes: [{
          field: 'messages',
          value: {
            from: {
              name: 'Test User',
              id: 'test_user_id'
            },
            message: {
              text: 'Hello, this is a test message'
            },
            timestamp: Math.floor(Date.now() / 1000)
          }
        }]
      }]
    };

    // Create signature
    const signature = 'sha256=' + crypto
      .createHmac('sha256', APP_SECRET)
      .update(JSON.stringify(webhookEvent))
      .digest('hex');

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature
      },
      body: JSON.stringify(webhookEvent)
    });

    if (response.ok) {
      const text = await response.text();
      console.log('✅ Webhook event processed:', text);
      return true;
    } else {
      console.log('❌ Webhook event failed - status:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Webhook event error:', error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  const results = [];
  
  results.push(await testServerConnectivity());
  results.push(await testWebhookVerification());
  results.push(await testAPIEndpoint());
  results.push(await testAddLead());
  results.push(await testWebhookEvent());

  console.log('\n📊 Test Results Summary');
  console.log('=======================');
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`Passed: ${passed}/${total}`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Your webhook is ready for Meta Ads.');
  } else {
    console.log('⚠️  Some tests failed. Check the issues above.');
    console.log('\nNext steps:');
    console.log('1. Update your server deployment on Render');
    console.log('2. Check environment variables');
    console.log('3. Verify webhook configuration in Meta Developer Console');
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testServerConnectivity,
  testWebhookVerification,
  testAPIEndpoint,
  testAddLead,
  testWebhookEvent,
  runAllTests
};
