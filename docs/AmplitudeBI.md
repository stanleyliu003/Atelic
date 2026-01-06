# Amplitude Integration Plan - Simplified

## Overview

This document outlines a simplified integration plan to sync existing data from your backend to Amplitude for business intelligence and analytics. **No frontend event tracking** will be implemented - only backend data synchronization.

## Goals

1. Send UserProfiles data from DynamoDB to Amplitude as user properties
2. Integrate Apple App Store Connect analytics into Amplitude
3. Keep Amplitude API key secure in `.env` file (not committed to git)

## Important: Backend-Only Implementation

**✅ What we're doing:**
- Lambda function sends user data via HTTP API
- Uses Node.js built-in `https` module (no SDK installation)
- Zero changes to React Native app code
- No frontend dependencies needed

**❌ What we're NOT doing:**
- NOT installing Amplitude React Native SDK
- NOT tracking events in the app
- NOT using `npm install @amplitude/analytics-react-native`
- NOT modifying any frontend code

This is a **pure backend data sync** - your app doesn't need to know Amplitude exists.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     AWS Backend (Existing)                       │
│                                                                  │
│  ┌──────────────────┐         ┌──────────────────┐             │
│  │  DynamoDB        │         │  S3 Bucket       │             │
│  │  UserProfiles    │────────▶│  atelic-analytics│             │
│  │  - dev           │         │  (CSV exports)   │             │
│  └──────────────────┘         └──────────────────┘             │
│           │                                                      │
│           │                                                      │
│           ▼                                                      │
│  ┌──────────────────────────────────────────────┐              │
│  │  Lambda: syncUserProfilesToAmplitude         │              │
│  │  - Scans DynamoDB UserProfiles table         │              │
│  │  - Maps to Amplitude user properties         │              │
│  │  - Sends via Amplitude HTTP API (batch)      │              │
│  └──────────────────────────────────────────────┘              │
│           │                                                      │
└───────────┼──────────────────────────────────────────────────────┘
            │
            │ HTTPS POST
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Amplitude Platform                          │
│                                                                  │
│  ┌──────────────────┐         ┌──────────────────┐             │
│  │  User Properties │         │  App Store       │             │
│  │  (from DynamoDB) │         │  Analytics       │             │
│  │                  │         │  (auto-synced)   │             │
│  └──────────────────┘         └──────────────────┘             │
│                                                                  │
│  ┌───────────────────────────────────────────────┐             │
│  │           Analytics Dashboards                │             │
│  │  - User demographics                          │             │
│  │  - Trip creation metrics                      │             │
│  │  - Attribution analysis (AppsFlyer)           │             │
│  │  - App Store performance                      │             │
│  └───────────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Mapping

### UserProfiles DynamoDB → Amplitude User Properties

Your existing DynamoDB table has 17 analytics fields that will be synced to Amplitude:

| DynamoDB Field | Amplitude User Property | Type | Description |
|----------------|------------------------|------|-------------|
| `username` | `user_id` | String | Primary identifier |
| `email` | `email` | String | User email |
| `fullName` | `name` | String | Full name |
| `age` | `age` | Number | User age |
| `gender` | `gender` | String | Gender |
| `appVersion` | `app_version` | String | Current app version |
| `ownedTripsCount` | `owned_trips_count` | Number | Total trips owned |
| `totalActivitiesOwned` | `total_activities` | Number | Total activities across all trips |
| `avgActivitiesPerTrip` | `avg_activities_per_trip` | Number | Average activities per trip |
| `avgCollaboratorsPerTrip` | `avg_collaborators_per_trip` | Number | Average collaborators per trip |
| `avgTripDuration` | `avg_trip_duration` | Number | Average trip duration (days) |
| `totalTripDuration` | `total_trip_duration` | Number | Sum of all trip durations |
| `totalTripsCompleted` | `trips_completed` | Number | Completed trips |
| `totalTripsInProgress` | `trips_in_progress` | Number | In-progress trips |
| `totalTripsUpcoming` | `trips_upcoming` | Number | Upcoming trips |
| `followersCount` | `followers_count` | Number | Social followers |
| `followingCount` | `following_count` | Number | Social following |
| `accountCreatedAt` | `account_created_at` | Timestamp | Account creation date |
| `lastActiveAt` | `last_active_at` | Timestamp | Last activity timestamp |
| `attributionSource` | `attribution_source` | String | AppsFlyer source (organic, facebook, etc.) |
| `attributionCampaign` | `attribution_campaign` | String | Campaign name |
| `attributionCampaignId` | `attribution_campaign_id` | String | Campaign ID |
| `attributionInstallDate` | `attribution_install_date` | Timestamp | Install timestamp |
| `attributionDeviceId` | `attribution_device_id` | String | AppsFlyer device ID |
| `attributionStatus` | `attribution_status` | String | linking/linked/organic/pending |

**Total: 26 user properties per user**

---

## Implementation Steps

### Step 1: Secure API Key Setup ✅ COMPLETED

**Action:** Add Amplitude API key to `.env` file

**File:** `.env`
```env
# Amplitude Configuration
AMPLITUDE_API_KEY=3279109aad9e03ba305c1621058551b1
```

**Security:**
- `.env` is already in `.gitignore` (not committed to git)
- API key will be passed as environment variable to Lambda function
- GitGuardian will not detect it in committed code

---

### Step 2: Create Lambda Function for Data Sync

**Function Name:** `syncUserProfilesToAmplitude`

**Purpose:**
- Scan all users from UserProfiles DynamoDB table
- Transform to Amplitude Identify API format
- Send in batches of 100 users to Amplitude HTTP API

**File Structure:**
```
amplify/backend/function/syncUserProfilesToAmplitude/
├── src/
│   ├── index.js          (main handler)
│   ├── package.json      (dependencies)
│   └── event.json        (test event)
├── syncUserProfilesToAmplitude-cloudformation-template.json
└── parameters.json
```

**Dependencies:**
```json
{
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.423.0",
    "@aws-sdk/util-dynamodb": "^3.423.0"
  }
}
```

**Key Logic:**
1. Scan DynamoDB `UserProfiles-{env}` table (handles pagination)
2. Map each user to Amplitude Identify format:
   ```javascript
   {
     "user_id": "username",
     "user_properties": {
       "email": "user@example.com",
       "age": 28,
       "owned_trips_count": 5,
       // ... all 26 properties
     }
   }
   ```
3. Batch send to Amplitude HTTP API endpoint: `https://api2.amplitude.com/batch`
4. Return summary: `{ users_synced: 150, batches_sent: 2 }`

**Environment Variables:**
- `AMPLITUDE_API_KEY` - From `.env` file (passed via Amplify)
- `STORAGE_USERPROFILESSTORAGE_NAME` - Auto-injected by Amplify
- `REGION` - Auto-injected by Amplify

**Execution Time:** ~30-60 seconds for 100-500 users

---

### Step 3: Configure Lambda Environment Variables

**Method 1: Via Amplify CLI (Recommended)**

During `amplify add function`, configure:
- Environment variables to include `AMPLITUDE_API_KEY`
- Read from `.env` file at build time
- Amplify automatically injects DynamoDB table name and region

**Method 2: Manual AWS Console**

If needed, add environment variable in Lambda console:
```
AMPLITUDE_API_KEY = 3279109aad9e03ba305c1621058551b1
```

---

### Step 4: Set Up Automated Daily Sync

**Option A: EventBridge Scheduled Rule (Recommended)**

Create a scheduled rule to run Lambda daily at 2 AM UTC:

```bash
# Create EventBridge rule
aws events put-rule \
  --name amplitude-daily-user-sync \
  --schedule-expression "cron(0 2 * * ? *)" \
  --description "Daily sync of UserProfiles to Amplitude"

# Add Lambda as target
aws events put-targets \
  --rule amplitude-daily-user-sync \
  --targets "Id"="1","Arn"="arn:aws:lambda:us-east-1:ACCOUNT_ID:function:syncUserProfilesToAmplitude-dev"

# Grant EventBridge permission to invoke Lambda
aws lambda add-permission \
  --function-name syncUserProfilesToAmplitude-dev \
  --statement-id AllowEventBridgeInvoke \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:us-east-1:ACCOUNT_ID:rule/amplitude-daily-user-sync
```

**Option B: Manual Trigger**

Run on-demand via AWS Console or CLI:
```bash
aws lambda invoke \
  --function-name syncUserProfilesToAmplitude-dev \
  --region us-east-1 \
  response.json
```

---

### Step 5: Apple App Store Connect Integration

**Purpose:** Import App Store analytics directly into Amplitude

**Setup Steps:**

1. **Generate App Store Connect API Key**
   - Go to [App Store Connect](https://appstoreconnect.apple.com/)
   - Navigate to: **Users and Access** → **Keys** → **App Store Connect API**
   - Click **Generate API Key**
   - Select role: **App Manager** or **Developer**
   - Download the `.p8` private key file (only downloadable once!)
   - Note down:
     - **Key ID** (e.g., `ABC123XYZ`)
     - **Issuer ID** (e.g., `12345678-abcd-1234-abcd-123456789012`)

2. **Configure in Amplitude Dashboard**
   - Log in to [Amplitude](https://analytics.amplitude.com/)
   - Navigate to: **Data** → **Sources**
   - Click **Add Source** → Select **App Store Connect**
   - Enter credentials:
     - **Key ID:** From step 1
     - **Issuer ID:** From step 1
     - **Private Key:** Paste contents of `.p8` file
   - Select your app: **Atelic (id6748835773)**
   - Enable metrics to sync:
     - ✅ App Units (downloads)
     - ✅ App Sessions
     - ✅ Active Devices
     - ✅ Crashes
     - ✅ Installations
     - ✅ Opt-in Rate (ATT permission)
   - Click **Save & Sync**

3. **Data Sync Schedule**
   - Amplitude automatically syncs App Store data **daily**
   - Historical data: 90 days back from setup date
   - Metrics appear in Amplitude within 24 hours

**Available Metrics:**

| Metric | Description | Use Case |
|--------|-------------|----------|
| App Units | Total downloads | Track acquisition growth |
| Active Devices | DAU/MAU | Engagement metrics |
| Sessions | App opens | Usage frequency |
| Crashes | Crash count & rate | Stability monitoring |
| Installations | New installs | Compare with AppsFlyer attribution |
| Opt-in Rate | ATT permission acceptance | Attribution quality |

---

## Amplitude Dashboard Setup

### Pre-Built Charts (Automatically Available)

Once data syncs, you can create charts for:

**User Demographics:**
- Age distribution (histogram)
- Gender breakdown (pie chart)
- App version distribution (bar chart)

**Trip Metrics:**
- Average trips per user (metric)
- Power users segment (owned_trips_count >= 3)
- Trip completion rate (completed / total trips)

**Attribution Analysis:**
- Organic vs. Paid breakdown (attribution_source)
- Campaign performance (attribution_campaign)
- Attribution source → Trip creation correlation

**Engagement Segmentation:**
```sql
-- Example Amplitude cohort definitions

Power Users:
  owned_trips_count >= 3

Active Users:
  owned_trips_count >= 1 AND owned_trips_count <= 2

New Users:
  owned_trips_count = 0

High Collaborators:
  avg_collaborators_per_trip >= 2
```

**App Store Metrics:**
- Daily downloads (from App Store Connect)
- Crash rate trend
- ATT opt-in rate over time
- Session frequency

---

## Testing Plan

### Test 1: Manual Lambda Invocation

**Objective:** Verify Lambda can read DynamoDB and send to Amplitude

**Steps:**
1. Deploy Lambda function via Amplify
2. Invoke manually:
   ```bash
   aws lambda invoke \
     --function-name syncUserProfilesToAmplitude-dev \
     --region us-east-1 \
     --log-type Tail \
     --query 'LogResult' \
     --output text \
     response.json | base64 -d
   ```
3. Check response:
   ```json
   {
     "statusCode": 200,
     "body": {
       "message": "Sync completed successfully",
       "users_synced": 150,
       "batches_sent": 2,
       "environment": "dev"
     }
   }
   ```

**Expected CloudWatch Logs:**
```
[Amplitude Sync] Starting user data sync...
[Amplitude Sync] Scanned 150 users from DynamoDB
[Amplitude Sync] Sending batch 1/2 (100 users)
[Amplitude Sync] Batch 1 response: {"code":200,"events_ingested":100}
[Amplitude Sync] Sending batch 2/2 (50 users)
[Amplitude Sync] Batch 2 response: {"code":200,"events_ingested":50}
[Amplitude Sync] Sync completed: 150 users synced
```

---

### Test 2: Verify Data in Amplitude

**Objective:** Confirm user properties appear in Amplitude dashboard

**Steps:**
1. Log in to Amplitude dashboard
2. Navigate to: **Users** → **User Look-Up**
3. Search for a test user (by username or email)
4. Verify user properties display correctly:
   - ✅ Email, name, age, gender
   - ✅ Trip metrics (owned_trips_count, avg_activities_per_trip, etc.)
   - ✅ Attribution data (attribution_source, attribution_campaign)
   - ✅ Timestamps (account_created_at, last_active_at)

**Create Test Chart:**
1. Go to **Analytics** → **Charts**
2. Create bar chart: **Owned Trips Distribution**
   - Metric: Count of users
   - Group by: `owned_trips_count`
3. Verify data matches your DynamoDB table

---

### Test 3: App Store Connect Integration

**Objective:** Verify App Store metrics sync to Amplitude

**Steps:**
1. Wait 24 hours after configuring App Store Connect
2. Navigate to: **Data** → **Sources** → **App Store Connect**
3. Verify status shows: **✅ Syncing**
4. Check metrics:
   - Go to **Analytics** → **Charts**
   - Create chart: **Daily Downloads**
   - Metric: App Units
   - Group by: Date
5. Compare with App Store Connect dashboard to verify accuracy

---

## Monitoring & Maintenance

### CloudWatch Logs

**Log Group:** `/aws/lambda/syncUserProfilesToAmplitude-dev`

**Key Metrics to Monitor:**
- Execution duration (should be < 60 seconds for 500 users)
- Error count (should be 0)
- Amplitude API response codes (200 = success)

**Set Up CloudWatch Alarm:**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name amplitude-sync-errors \
  --alarm-description "Alert when Amplitude sync fails" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 86400 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=syncUserProfilesToAmplitude-dev \
  --evaluation-periods 1
```

---

### Amplitude API Rate Limits

**HTTP Batch API Limits:**
- Max 100 events per batch
- Max 20 MB per request
- Rate limit: 1000 requests/second (very generous)

**Your Usage:**
- ~150-500 users total
- 2-5 batches per sync
- 1 sync per day
- **Well within limits** ✅

---

### Data Freshness

**Sync Schedule:**
- **DynamoDB → Amplitude:** Daily at 2 AM UTC (EventBridge rule)
- **App Store → Amplitude:** Daily automatic sync by Amplitude

**Data Lag:**
- User properties: Updated once per day
- App Store metrics: 24-48 hour delay (Apple's data availability)

**Manual Refresh:**
To sync immediately after major updates:
```bash
aws lambda invoke \
  --function-name syncUserProfilesToAmplitude-dev \
  response.json
```

---

## Cost Analysis

### AWS Costs

| Resource | Usage | Cost |
|----------|-------|------|
| Lambda Execution | 1 run/day × 60 sec × 30 days | ~$0.10/month |
| EventBridge Rule | 1 rule × 30 triggers | $0 (free tier) |
| DynamoDB Scans | 1 full scan/day | ~$0.05/month |
| **Total AWS** | | **~$0.15/month** |

### Amplitude Costs

**Free Tier (Scholarship Plan):**
- ✅ Unlimited user properties
- ✅ 10M events/month (we won't send events, only user properties)
- ✅ App Store integration included
- ✅ Unlimited dashboards and charts

**Your Usage:**
- 0 events (no event tracking)
- Only user property updates (doesn't count toward event limit)
- **Cost: $0/month** ✅

**Total Monthly Cost: ~$0.15 (AWS only)**

---

## Security Considerations

### API Key Protection ✅

**Current Status:**
- ✅ API key stored in `.env` file (gitignored)
- ✅ Not committed to git repository
- ✅ Passed to Lambda via environment variables
- ✅ GitGuardian will not detect

**Best Practice:**
- For production, consider using AWS Secrets Manager:
  ```bash
  aws secretsmanager create-secret \
    --name amplitude-api-key \
    --secret-string "3279109aad9e03ba305c1621058551b1"
  ```
- Lambda reads from Secrets Manager instead of env vars

---

### Data Privacy Compliance

**User Data Sent to Amplitude:**
- Email, name, age, gender
- Trip metrics (anonymous activity counts)
- Attribution data (campaign sources)
- Timestamps

**GDPR/CCPA Considerations:**
- Users should be informed in Privacy Policy
- Provide opt-out mechanism if required
- Amplitude is GDPR compliant (data processing agreement available)

**PII Protection:**
- Amplitude automatically hashes IP addresses
- User deletion API available:
  ```bash
  curl -X POST https://amplitude.com/api/2/deletions/users \
    -u "AMPLITUDE_API_KEY:" \
    -d "user_ids=username123"
  ```

---

## Success Metrics

After implementation, you'll be able to answer:

**User Insights:**
- ✅ What's the demographic breakdown of our users? (age, gender)
- ✅ How many trips does an average user create?
- ✅ What's the distribution of power users (3+ trips)?
- ✅ What's our user retention based on trip activity?

**Attribution Analysis:**
- ✅ What % of users come from paid vs. organic channels?
- ✅ Which campaigns drive the most engaged users?
- ✅ Do paid users create more trips than organic users?
- ✅ What's the ROI of each marketing campaign?

**App Performance:**
- ✅ What's our app version adoption rate?
- ✅ How many daily/monthly active users do we have?
- ✅ What's our crash rate trend over time?
- ✅ What's the ATT opt-in rate impact on attribution?

**Product Metrics:**
- ✅ How collaborative are our users? (avg collaborators per trip)
- ✅ What's the average trip complexity? (activities, duration)
- ✅ Are users completing their trips?

---

## Timeline

| Phase | Task | Estimated Time |
|-------|------|----------------|
| **Phase 1** | ✅ Add API key to `.env` | 5 min (DONE) |
| **Phase 2** | Create Lambda function code | 1 hour |
| **Phase 3** | Deploy via Amplify CLI | 30 min |
| **Phase 4** | Test Lambda & verify data in Amplitude | 30 min |
| **Phase 5** | Set up EventBridge scheduled rule | 15 min |
| **Phase 6** | Configure App Store Connect | 20 min |
| **Phase 7** | Create initial Amplitude dashboards | 1 hour |
| **Phase 8** | Documentation & handoff | 30 min |

**Total Implementation Time: ~4 hours**

---

## Next Steps

1. **Review this plan** - Confirm this simplified approach meets your needs
2. **Create Lambda function** - Build `syncUserProfilesToAmplitude`
3. **Deploy & test** - Verify data appears in Amplitude
4. **Set up App Store integration** - Connect Apple analytics
5. **Build dashboards** - Create charts for key metrics

---

## Support Resources

**Amplitude Documentation:**
- [HTTP API (Batch)](https://www.docs.developers.amplitude.com/analytics/apis/batch-event-upload-api/)
- [Identify API](https://www.docs.developers.amplitude.com/analytics/apis/identify-api/)
- [App Store Connect Integration](https://www.docs.developers.amplitude.com/data/sources/app-store-connect/)

**Your Amplitude Dashboard:**
- URL: https://analytics.amplitude.com/
- API Key: `3279109aad9e03ba305c1621058551b1`

**Existing Infrastructure:**
- S3 Bucket: `atelic-analytics`
- DynamoDB Table: `UserProfiles-dev`
- Existing Export Lambda: `exportUserDataAnalytics-dev`

---

**Last Updated:** January 6, 2026
**Status:** ✅ Phase 1 Complete (API key secured)
**Next:** Create Lambda function for DynamoDB → Amplitude sync
AMPLITUDE_API_KEY=3279109aad9e03ba305c1621058551b1
