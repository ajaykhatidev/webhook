# MongoDB Webhook Setup Guide

## 🎯 **What's Updated**

Your webhook now uses MongoDB instead of Supabase! Everything is hardcoded for easy setup.

### **New Features:**
- ✅ **MongoDB Integration**: Leads saved to MongoDB Atlas
- ✅ **React Frontend**: Moved to `frontend/my-project-name/`
- ✅ **Hardcoded Values**: No environment variables needed
- ✅ **Fallback System**: If MongoDB fails, saves to local file

## 🔧 **MongoDB Configuration**

### **Connection String:**
```
mongodb+srv://luckykhati459_db_user:<db_password>@cluster0.4hqlabd.mongodb.net/
```

**Replace `<db_password>` with your actual MongoDB password!**

### **Database Structure:**
- **Database**: `webhook_leads`
- **Collection**: `leads`

### **Document Schema:**
```javascript
{
  lead_id: "123456789",           // Facebook lead ID
  ad_id: "987654321",             // Facebook ad ID
  form_id: "555666777",           // Facebook form ID
  created_time: Date,              // When lead was created
  field_data: [                   // Lead form fields
    { name: "full_name", values: ["John Doe"] },
    { name: "email", values: ["john@example.com"] },
    { name: "phone_number", values: ["+1234567890"] }
  ],
  platform: "facebook",           // Platform source
  source: "leadgen_webhook",      // Source type
  raw_data: { /* full Facebook lead object */ },
  created_at: Date                // When saved to MongoDB
}
```

## 🚀 **How to Run**

### **1. Update MongoDB Password:**
In `webhook-testing/index.js`, line 18:
```javascript
const MONGODB_URI = 'mongodb+srv://luckykhati459_db_user:YOUR_ACTUAL_PASSWORD@cluster0.4hqlabd.mongodb.net/';
```

### **2. Start Webhook Server:**
```bash
cd webhook-testing
npm start
```

### **3. Start React Frontend:**
```bash
cd frontend/my-project-name
npm run dev
```

## 🌐 **URLs**

### **Webhook Server:**
- **Server**: `http://localhost:3000/`
- **Webhook**: `http://localhost:3000/webhook`
- **API**: `http://localhost:3000/api/leads`

### **React Frontend:**
- **Dashboard**: `http://localhost:5173/` (or 5174)

## 🔑 **Hardcoded Values**

All values are hardcoded in `index.js`:

```javascript
const PORT = 3000;
const VERIFY_TOKEN = 'test_webhook_token_123';
const APP_SECRET = 'test_app_secret_456';
const PAGE_ACCESS_TOKEN = 'your_page_access_token_here';
const PAGE_ID = '773204715868903';
```

## 📱 **Meta Ads Configuration**

Use these credentials in Facebook Developer Console:

```
Callback URL: https://webhook-100u.onrender.com/webhook
Verify Token: test_webhook_token_123
App Secret: test_app_secret_456
```

**Subscribe to:** `leadgen` field

## 🧪 **Testing**

### **1. Test Webhook Verification:**
```
http://localhost:3000/webhook?hub.mode=subscribe&hub.challenge=test_challenge&hub.verify_token=test_webhook_token_123
```

### **2. Test API Endpoint:**
```
http://localhost:3000/api/leads
```

### **3. Test Frontend:**
Visit `http://localhost:5173/` to see the React dashboard

## 📊 **Frontend Features**

The React dashboard includes:
- **Real-time Updates**: Polls every 10 seconds
- **Statistics**: Total leads, today's leads, Facebook leads
- **Lead Display**: Shows all lead data in a table
- **Data Source Indicator**: Shows if data comes from MongoDB or local file
- **Responsive Design**: Works on mobile and desktop

## 🔄 **Deployment**

### **For Production (Render):**

1. **Update MongoDB URI** with your actual password
2. **Update PAGE_ACCESS_TOKEN** with your real Facebook token
3. **Deploy to Render** with the updated code

### **Environment Variables for Render:**
```
MONGODB_URI=mongodb+srv://luckykhati459_db_user:YOUR_PASSWORD@cluster0.4hqlabd.mongodb.net/
PAGE_ACCESS_TOKEN=your_real_facebook_token
```

## 🛠️ **Troubleshooting**

### **Common Issues:**

1. **MongoDB Connection Failed:**
   - Check if password is correct in MONGODB_URI
   - Verify MongoDB Atlas cluster is running
   - Check network access settings

2. **Frontend Not Loading:**
   - Make sure webhook server is running on port 3000
   - Check browser console for CORS errors
   - Verify API endpoint is accessible

3. **No Leads Appearing:**
   - Check MongoDB connection logs
   - Verify Facebook webhook configuration
   - Test with manual lead creation

### **Debug Commands:**
```bash
# Check server status
curl http://localhost:3000/

# Test API
curl http://localhost:3000/api/leads

# Check MongoDB connection
# Look for "✅ Connected to MongoDB" in server logs
```

## 🎉 **Ready to Go!**

Your webhook is now fully integrated with MongoDB and has a beautiful React frontend!

**Next Steps:**
1. Replace `<db_password>` with your MongoDB password
2. Start both servers (webhook + React)
3. Configure Meta Ads webhook
4. Test with Facebook Lead Ads

The system will automatically save all Facebook leads to MongoDB and display them in the React dashboard!
