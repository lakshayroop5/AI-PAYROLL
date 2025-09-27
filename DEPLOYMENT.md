# 🚀 AI Payroll System - Production Deployment Guide

## 📋 Pre-Deployment Checklist

### **✅ Required Services & Accounts**

1. **Database**
   - [ ] PostgreSQL database (recommended for production)
   - [ ] Connection string configured
   - [ ] SSL enabled for security

2. **Hedera Hashgraph**
   - [ ] Mainnet account created
   - [ ] Treasury account for receiving payments
   - [ ] HBAR balance for transaction fees
   - [ ] Private keys securely stored

3. **SendGrid Email**
   - [ ] SendGrid account created
   - [ ] API key generated
   - [ ] Domain verification completed
   - [ ] From email configured

4. **GitHub OAuth**
   - [ ] GitHub App created
   - [ ] Client ID and secret obtained
   - [ ] Callback URLs configured

5. **Self Network**
   - [ ] Self app registered
   - [ ] App ID and secret obtained

## 🔧 Environment Configuration

### **Production Environment Variables**

```bash
# Application
NODE_ENV=production
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-production-secret-32-chars-min

# Database (PostgreSQL recommended)
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_TOKEN=your_personal_access_token

# Self Network
SELF_APP_ID=your_self_app_id
SELF_APP_SECRET=your_self_app_secret

# Hedera Mainnet
HEDERA_NETWORK=mainnet
HEDERA_OPERATOR_ACCOUNT_ID=0.0.YOUR_ACCOUNT
HEDERA_OPERATOR_PRIVATE_KEY=302e020100300506032b657004220420...
HEDERA_TREASURY_ACCOUNT_ID=0.0.TREASURY_ACCOUNT

# Email Service
SENDGRID_API_KEY=SG.your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com

# Optional Integrations (Enable for full functionality)
LIGHTHOUSE_API_KEY=your_lighthouse_api_key
GRAPH_API_KEY=your_graph_api_key
FETCHAI_API_KEY=your_fetchai_api_key
GITHUB_SUBGRAPH_URL=https://api.thegraph.com/subgraphs/name/your-subgraph

# Security
CORS_ORIGIN=https://yourdomain.com
LOG_LEVEL=info
```

## 🏗️ Deployment Steps

### **Step 1: Prepare Application**

```bash
# Clone repository
git clone https://github.com/your-org/ai-payroll.git
cd ai-payroll

# Install dependencies
npm ci --production

# Build application
npm run build

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy
```

### **Step 2: Deploy to Platform**

#### **Option A: Vercel (Recommended)**

```bash
# Install Vercel CLI
npm i -g vercel

# Configure environment variables in Vercel dashboard
# Deploy
vercel --prod

# Set up custom domain
vercel domains add yourdomain.com
```

#### **Option B: Docker**

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t ai-payroll .
docker run -p 3000:3000 --env-file .env.production ai-payroll
```

#### **Option C: Traditional VPS**

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start npm --name "ai-payroll" -- start

# Configure auto-restart
pm2 startup
pm2 save
```

### **Step 3: Database Setup**

```bash
# For PostgreSQL
sudo -u postgres psql
CREATE DATABASE ai_payroll_prod;
CREATE USER ai_payroll_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE ai_payroll_prod TO ai_payroll_user;

# Run migrations
DATABASE_URL=postgresql://ai_payroll_user:secure_password@localhost:5432/ai_payroll_prod npx prisma migrate deploy
```

### **Step 4: SSL/Security Configuration**

```bash
# For Nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/certificate.pem;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🚀 Post-Deployment Setup

### **1. Initialize System**

```bash
# Health check
curl https://yourdomain.com/api/integrations/status

# Initialize integrations
curl -X POST https://yourdomain.com/api/integrations/status \
  -H "Content-Type: application/json" \
  -d '{"action": "initialize"}'
```

### **2. Verify Integrations**

```bash
# Check scheduler status
curl https://yourdomain.com/api/integrations/scheduler

# Initialize scheduler
curl -X POST https://yourdomain.com/api/integrations/scheduler \
  -H "Content-Type: application/json" \
  -d '{"action": "initialize"}'
```

### **3. Test Core Functionality**

1. **Authentication**: Login with GitHub
2. **Repository Addition**: Add a test repository
3. **Agent Initialization**: Initialize monitoring agent
4. **Analytics**: Check analytics dashboard
5. **Email**: Verify email delivery
6. **Payments**: Test payment processing (small amount)

## 📊 Monitoring & Maintenance

### **Health Monitoring**

```bash
# System health endpoint
GET /api/integrations/status
```

**Response:**
```json
{
  "health": {
    "overall": "healthy",
    "integrations": [
      {"service": "Database", "status": "healthy"},
      {"service": "Hedera", "status": "healthy"},
      {"service": "Email", "status": "healthy"}
    ]
  },
  "scheduler": {
    "initialized": true,
    "activeJobs": 7
  }
}
```

### **Log Monitoring**

```bash
# PM2 logs
pm2 logs ai-payroll

# Docker logs
docker logs ai-payroll-container

# System logs
tail -f /var/log/ai-payroll/error.log
```

### **Database Maintenance**

```sql
-- Monitor database size
SELECT pg_size_pretty(pg_database_size('ai_payroll_prod'));

-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Vacuum and analyze
VACUUM ANALYZE;
```

## 🔒 Security Best Practices

### **API Keys & Secrets**
- [ ] Use environment variables only
- [ ] Rotate keys regularly (quarterly)
- [ ] Never commit secrets to code
- [ ] Use secret management service

### **Database Security**
- [ ] Enable SSL connections
- [ ] Use strong passwords
- [ ] Regular backups
- [ ] Monitor for unauthorized access

### **Application Security**
- [ ] HTTPS only
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Security headers set

### **Hedera Security**
- [ ] Private keys encrypted at rest
- [ ] Multi-signature for large amounts
- [ ] Regular key rotation
- [ ] Transaction monitoring

## 🚨 Disaster Recovery

### **Backup Strategy**

```bash
# Database backup (daily)
pg_dump ai_payroll_prod > backup_$(date +%Y%m%d).sql

# IPFS/Lighthouse verification
curl -X POST /api/integrations/scheduler \
  -d '{"action": "execute_now", "jobId": "cid_verification"}'
```

### **Recovery Procedures**

1. **Database Recovery**:
   ```bash
   psql ai_payroll_prod < backup_20240101.sql
   ```

2. **Service Recovery**:
   ```bash
   pm2 restart ai-payroll
   pm2 reset ai-payroll  # Reset error counts
   ```

3. **Integration Recovery**:
   ```bash
   # Re-initialize all integrations
   curl -X POST /api/integrations/status -d '{"action": "initialize"}'
   ```

## 📈 Scaling Considerations

### **Horizontal Scaling**
- Load balancer configuration
- Database connection pooling
- Redis for session storage
- CDN for static assets

### **Performance Optimization**
- Database indexing
- Query optimization
- Background job distribution
- Caching strategies

## 🔍 Troubleshooting

### **Common Issues**

1. **"Agent stuck at INITIALIZING"**
   - Check integration status: `/api/integrations/status`
   - Manually trigger setup: POST to analytics endpoint

2. **"Email delivery failures"**
   - Verify SendGrid API key
   - Check domain verification
   - Review email logs

3. **"Payment processing errors"**
   - Check Hedera account balance
   - Verify network configuration
   - Review transaction logs

4. **"High memory usage"**
   - Monitor background jobs
   - Check for memory leaks
   - Optimize database queries

### **Support Contacts**
- **Technical Issues**: Create GitHub issue
- **Security Concerns**: security@yourdomain.com
- **Emergency**: +1-xxx-xxx-xxxx

---

## ✅ Go-Live Checklist

- [ ] All environment variables configured
- [ ] Database migrations completed
- [ ] SSL certificates installed
- [ ] Domain DNS configured
- [ ] Health checks passing
- [ ] Integrations initialized
- [ ] Monitoring setup
- [ ] Backup procedures tested
- [ ] Security scan completed
- [ ] Load testing performed
- [ ] Team trained on operations

**🎉 Ready for Production!**
