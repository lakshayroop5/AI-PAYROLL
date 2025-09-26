# 🚀 AI Payroll Setup Instructions

## Current Issues & Quick Fixes

### 1. GitHub OAuth Setup (Required)

The application currently shows "your-github-client-id" because you need to create a GitHub OAuth App:

**Steps to fix:**

1. **Create GitHub OAuth App:**
   - Go to: https://github.com/settings/applications/new
   - Fill in:
     - **Application name**: `AI Payroll Local Dev`
     - **Homepage URL**: `http://localhost:3000`
     - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
   - Click "Register application"

2. **Copy credentials:**
   - Copy the **Client ID** and **Client Secret**

3. **Update environment file:**
   - Open `.env.local` in your project
   - Replace:
     ```env
     GITHUB_CLIENT_ID="your-github-client-id"
     GITHUB_CLIENT_SECRET="your-github-client-secret"
     ```
   - With your actual credentials:
     ```env
     GITHUB_CLIENT_ID="your_actual_client_id_here"
     GITHUB_CLIENT_SECRET="your_actual_client_secret_here"
     ```

4. **Restart the server:**
   ```bash
   # Stop the current server (Ctrl+C)
   # Then restart:
   npm run dev
   ```

### 2. CSS Styling Issues (Fixed)

I've updated the Tailwind configuration to resolve CSS compilation errors. The styling should now work properly after the server restart.

### 3. Complete Environment Setup

For full functionality, you'll also need:

#### Self Identity (for verification):
```env
SELF_APP_ID="your-self-app-id"
SELF_PRIVATE_KEY="your-self-private-key"
SELF_ENVIRONMENT="sandbox"
```

#### Hedera (for payments):
```env
HEDERA_NETWORK="testnet"
HEDERA_ACCOUNT_ID="0.0.xxxxx"
HEDERA_PRIVATE_KEY="your-hedera-private-key"
```

#### Lighthouse (for storage):
```env
LIGHTHOUSE_API_KEY="your-lighthouse-api-key"
```

## Testing the Application

1. **After setting up GitHub OAuth:**
   - Visit: http://localhost:3000
   - Click "Sign in with GitHub"
   - Authorize the application
   - You should be redirected to the dashboard

2. **Demo mode:**
   - If GitHub OAuth isn't configured, the app will show setup instructions
   - You can still explore the UI components

## Quick Start (Minimum Setup)

**For immediate testing, you only need GitHub OAuth:**

1. Set up GitHub OAuth (steps above)
2. Restart the server
3. Sign in and explore the dashboard

**For full functionality:**
- Complete all environment variables
- Set up Self, Hedera, and Lighthouse accounts
- Test end-to-end payroll flows

## Troubleshooting

**Still seeing 404 errors?**
- Make sure you restarted the server after updating `.env.local`
- Check that the GitHub callback URL is exactly: `http://localhost:3000/api/auth/callback/github`

**CSS not loading?**
- Clear browser cache
- Restart the development server
- Check console for any Tailwind compilation errors

**Need help?**
- Check the full README.md for detailed setup instructions
- All API endpoints are working (returning 401 when not authenticated)
- The database is initialized and ready