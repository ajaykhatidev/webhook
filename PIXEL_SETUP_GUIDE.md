# 🎯 Facebook Pixel Integration Setup Guide

## 📋 **What We've Implemented:**

✅ **Frontend Pixel Tracking:**
- Page view tracking
- Lead event tracking
- Dashboard interaction tracking
- Custom event tracking

✅ **Backend Pixel Tracking:**
- Webhook lead event tracking
- Auto-fetch lead tracking
- Manual fetch tracking
- Server-side event tracking

## 🔧 **Setup Steps:**

### **Step 1: Get Your Facebook Pixel ID**

1. **Go to Facebook Ads Manager**
2. **Navigate to Events Manager**
3. **Click "Connect Data Sources"**
4. **Select "Web"**
5. **Choose "Facebook Pixel"**
6. **Copy your Pixel ID** (looks like: `1234567890123456`)

### **Step 2: Get Your Pixel Access Token**

1. **Go to Facebook Developer Console**
2. **Select your app** (ID: 819463583930088)
3. **Go to "Tools" → "Graph API Explorer"**
4. **Select your app**
5. **Generate a User Access Token** with these permissions:
   - `ads_management`
   - `business_management`
   - `pages_read_engagement`
6. **Exchange for Page Access Token** (you already have this)
7. **For Pixel events, you need a System User Token:**
   - Go to Business Manager
   - Go to Business Settings
   - Go to System Users
   - Create a new system user
   - Generate a token with `ads_management` permission

### **Step 3: Update Your Configuration**

**In `frontend/my-project-name/index.html`:**
```html
<!-- Replace YOUR_PIXEL_ID with your actual Pixel ID -->
fbq('init', '1234567890123456'); // Your actual Pixel ID
```

**In `webhook-testing/index.js`:**
```javascript
// Replace these with your actual values
const PIXEL_ID = '1234567890123456'; // Your actual Pixel ID
const PIXEL_ACCESS_TOKEN = 'your_actual_pixel_access_token'; // Your actual token
```

## 🎯 **Pixel Events We're Tracking:**

### **Frontend Events:**
- `PageView` - When dashboard loads
- `Lead` - When Facebook leads are displayed
- `CompleteRegistration` - When leads are processed
- `DashboardView` - Custom event for dashboard views
- `LeadsProcessed` - Custom event for lead processing
- `DashboardRefresh` - When refresh button is clicked
- `LeadInteraction` - When user interacts with leads

### **Backend Events:**
- `Lead` - When webhook receives new lead
- `CompleteRegistration` - When auto-fetch finds new leads
- `CustomEvent` - For manual fetch triggers

## 🚀 **Testing Your Pixel Integration:**

### **1. Check Browser Console:**
Open your frontend and check browser console for:
```
🎯 Tracking Page View
🎯 Tracking Dashboard View: [leads data]
🎯 Tracking Lead Event: [lead data]
```

### **2. Check Server Logs:**
Check your webhook server logs for:
```
🎯 Tracking Pixel Event: Lead [event data]
✅ Pixel event tracked: Lead [response]
```

### **3. Facebook Events Manager:**
1. Go to Events Manager
2. Select your Pixel
3. Check "Test Events" tab
4. You should see events coming through

## 🔍 **Troubleshooting:**

### **If Pixel Events Don't Show:**
1. **Check Pixel ID** - Make sure it's correct
2. **Check Access Token** - Make sure it has proper permissions
3. **Check Browser Console** - Look for JavaScript errors
4. **Check Server Logs** - Look for Pixel tracking errors

### **Common Issues:**
- **Pixel ID not configured** - Events will be skipped
- **Access Token expired** - Server-side events will fail
- **Ad blockers** - May block Pixel events
- **iOS 14.5+** - May limit tracking

## 📊 **What You'll See in Facebook:**

### **Events Manager:**
- Real-time event tracking
- Conversion attribution
- Audience insights
- Custom event data

### **Ads Manager:**
- Better ad optimization
- Conversion tracking
- Audience building
- Retargeting capabilities

## 🎯 **Your System is Now Zoho-like:**

✅ **Lead Capture** - Webhook + Auto-fetch
✅ **Real-time Processing** - Instant notifications
✅ **Pixel Analytics** - Complete tracking
✅ **Ad Optimization** - Facebook learns patterns
✅ **Retargeting** - Remarket to visitors
✅ **Professional CRM** - Dashboard with insights

## 🚀 **Next Steps:**

1. **Get your Pixel ID and Access Token**
2. **Update the configuration files**
3. **Deploy to Render**
4. **Test the integration**
5. **Monitor events in Facebook**

Your system is now a complete, professional CRM with Facebook Pixel integration - just like Zoho! 🎯
