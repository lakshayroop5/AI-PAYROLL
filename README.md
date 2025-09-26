# AI Agent Payroll on Hedera

A production-ready, decentralized payroll system with Self identity verification, GitHub integration, Pyth pricing, Hedera settlements, and Lighthouse (Filecoin) storage for immutable payroll slips.

## 🌟 Key Features

### Core Functionality
- **PR-Count Based Distribution**: Proportional payouts based on merged pull request counts
- **Self Identity Verification**: Proof of personhood for managers and contributors
- **GitHub Integration**: OAuth authentication and automated PR data collection
- **Real-time Pricing**: Pyth Network integration for up-to-date asset prices
- **Hedera Settlements**: Direct transfers and scheduled transactions on Hedera Hashgraph
- **Immutable Records**: Lighthouse storage for tamper-proof payroll slips

### Security & Compliance
- **Zero-Knowledge Proofs**: Self-based identity verification
- **Role-Based Access Control**: Manager and contributor permissions
- **Audit Trail**: Comprehensive logging of all actions
- **Idempotent Payouts**: Prevents double payments with retry safety
- **Mirror Node Verification**: Transaction confirmation via Hedera mirror nodes

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Git
- GitHub OAuth App (for repository access)
- Self App credentials (for identity verification)
- Hedera testnet/mainnet account
- Lighthouse API key (for IPFS storage)

### Installation

1. **Clone and install dependencies**:
   ```bash
   cd ai-payroll
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your credentials
   ```

3. **Initialize database**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**: Visit `http://localhost:3000`

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file with the following variables:

```env
# Database
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# GitHub OAuth
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# Self Identity Verification
SELF_APP_ID="your-self-app-id"
SELF_PRIVATE_KEY="your-self-private-key"
SELF_ENVIRONMENT="sandbox"

# Hedera Configuration
HEDERA_NETWORK="testnet"
HEDERA_ACCOUNT_ID="0.0.xxxxx"
HEDERA_PRIVATE_KEY="your-hedera-private-key"

# Pyth Network
PYTH_HERMES_URL="https://hermes.pyth.network"
PYTH_HBAR_USD_FEED_ID="your-pyth-feed-id"

# Lighthouse
LIGHTHOUSE_API_KEY="your-lighthouse-api-key"
```

### GitHub OAuth Setup

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create a new OAuth App with:
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
3. Copy the Client ID and Client Secret to your `.env.local`

### Self Identity Setup

1. Register for a Self developer account
2. Create a new application
3. Configure for personhood verification
4. Copy App ID and Private Key to your `.env.local`

### Hedera Account Setup

1. Create a Hedera testnet account at [portal.hedera.com](https://portal.hedera.com)
2. Fund your account with testnet HBAR
3. Copy your Account ID and Private Key to your `.env.local`

### Lighthouse Setup

1. Sign up for Lighthouse at [lighthouse.storage](https://lighthouse.storage)
2. Generate an API key
3. Copy the API key to your `.env.local`

## 📖 User Guide

### For Repository Managers

1. **Complete Self Verification**:
   - Navigate to Profile > Verification
   - Follow the Self identity verification flow
   - Verify your personhood using NFC or ID documents

2. **Connect GitHub Repositories**:
   - Go to Repositories section
   - Authorize repository access via GitHub OAuth
   - Add repositories for payroll management

3. **Create Payroll Runs**:
   - Select repositories and date range
   - Configure distribution parameters (budget, thresholds)
   - Preview PR-count based allocations
   - Execute payments to verified contributors

### For Contributors

1. **Complete Self Verification**:
   - Navigate to Profile > Verification
   - Complete Self identity verification
   - Link your GitHub account

2. **Set Up Contributor Profile**:
   - Add your Hedera account ID for payouts
   - Configure payout preferences
   - Ensure token associations for HTS payments

3. **Receive Payments**:
   - Payments are automatically distributed based on merged PRs
   - View payout history and transaction receipts
   - Access immutable payroll slips via Lighthouse CIDs

## 🏗️ Architecture

### Technology Stack
- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: SQLite (development), PostgreSQL (production)
- **Blockchain**: Hedera Hashgraph
- **Identity**: Self Protocol
- **Pricing**: Pyth Network
- **Storage**: Lighthouse (IPFS/Filecoin)
- **Authentication**: NextAuth.js

### System Components

1. **Identity Layer**: Self-based verification for managers and contributors
2. **Data Collection**: GitHub API integration for PR analysis
3. **Distribution Engine**: PR-count proportional allocation algorithm
4. **Pricing Oracle**: Pyth Network for real-time asset prices
5. **Settlement Layer**: Hedera Hashgraph for secure payments
6. **Storage Layer**: Lighthouse for immutable payroll records
7. **Audit System**: Comprehensive logging and verification

### Security Model

- **Identity Verification**: Self zero-knowledge proofs
- **Access Control**: Role-based permissions (manager/contributor)
- **Transaction Safety**: Idempotency keys and retry logic
- **Data Integrity**: Cryptographic hashes and mirror node verification
- **Privacy Protection**: Minimal data retention and encrypted storage

## 🧪 Testing

### Running Tests
```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

### Test Coverage
- Self identity verification flows
- GitHub PR data collection
- Distribution calculation algorithms
- Hedera transaction execution
- Lighthouse artifact generation
- End-to-end payroll run execution

## 🚀 Deployment

### Production Environment

1. **Database**: Set up PostgreSQL instance
2. **Environment**: Configure production environment variables
3. **Secrets**: Use secure secret management
4. **Monitoring**: Set up logging and metrics
5. **Backup**: Configure database backups

### Deployment Options
- **Vercel**: Recommended for Next.js applications
- **Railway**: Full-stack deployment with database
- **Docker**: Containerized deployment
- **Self-hosted**: VPS or dedicated server

## 📚 API Documentation

### Authentication
All API endpoints require authentication via NextAuth.js sessions.

### Core Endpoints
- `POST /api/self/verification` - Self identity verification
- `GET /api/repositories` - List managed repositories
- `POST /api/contributors` - Create contributor profile
- `POST /api/payroll/runs` - Create and execute payroll runs
- `GET /api/dashboard/stats` - Dashboard statistics

### Webhook Support
- GitHub webhooks for real-time PR updates
- Hedera mirror node event notifications
- Self verification status updates

## 🔒 Security Considerations

### Best Practices
- Regular security audits
- Secure key management
- Rate limiting and DDoS protection
- Input validation and sanitization
- CSRF protection
- Secure headers and HTTPS enforcement

### Privacy
- Minimal data collection
- Self-sovereign identity principles
- Right to deletion compliance
- Transparent data usage

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Submit a pull request
5. Follow code review process

### Development Guidelines
- Follow TypeScript best practices
- Write comprehensive tests
- Document API changes
- Follow semantic versioning

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs.ai-payroll.com](https://docs.ai-payroll.com)
- **Issues**: [GitHub Issues](https://github.com/ai-payroll/issues)
- **Discord**: [Community Chat](https://discord.gg/ai-payroll)
- **Email**: support@ai-payroll.com

## 🎯 Roadmap

### Phase 1 (Current)
- ✅ Core payroll functionality
- ✅ Self identity verification
- ✅ GitHub integration
- ✅ Hedera settlements
- ✅ Lighthouse storage

### Phase 2 (Q2 2024)
- 🔄 Multi-token support
- 🔄 Advanced distribution algorithms
- 🔄 Mobile app
- 🔄 DAO governance integration

### Phase 3 (Q3 2024)
- 📋 Cross-chain support
- 📋 AI-powered contribution analysis
- 📋 Enterprise features
- 📋 White-label solutions

## 🙏 Acknowledgments

- **Hedera Hashgraph**: For the enterprise-grade DLT platform
- **Self**: For privacy-preserving identity verification
- **Pyth Network**: For reliable price feeds
- **Lighthouse**: For decentralized storage
- **GitHub**: For seamless developer integration

---

**Built with ❤️ for the open-source community**
