'use client';

/**
 * Third Party Payment Guide
 * Instructions for organizations to pay with testnet PYUSD
 */

import { Button } from '@/components/ui/button';
import { getWalletSetupInstructions } from '@/lib/blockchain';

export default function PaymentGuidePage() {
  const instructions = getWalletSetupInstructions();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-4 mb-4">
              <img src="/payPal.png" alt="PayPal" className="h-12 filter brightness-0 invert" />
              <h1 className="text-3xl font-bold text-white">PYUSD Payment Guide</h1>
            </div>
            <p className="text-blue-100 text-lg">
              How to pay with PayPal USD on Ethereum Sepolia testnet
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Overview */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">🚀 Quick Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl mb-2">🏦</div>
              <h3 className="font-bold text-blue-900">Testnet Environment</h3>
              <p className="text-blue-700 text-sm mt-2">
                Safe testing environment with no real money involved
              </p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-3xl mb-2">💳</div>
              <h3 className="font-bold text-green-900">PYUSD Tokens</h3>
              <p className="text-green-700 text-sm mt-2">
                PayPal USD test tokens for blockchain donations
              </p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-3xl mb-2">⚡</div>
              <h3 className="font-bold text-purple-900">Instant Tracking</h3>
              <p className="text-purple-700 text-sm mt-2">
                Real-time transaction monitoring and balance updates
              </p>
            </div>
          </div>
        </div>

        {/* Step-by-step Instructions */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{instructions.title}</h2>
          
          <div className="space-y-6">
            {instructions.steps.map((step) => (
              <div key={step.step} className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  {step.step}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-gray-700 mb-2">{step.description}</p>
                  
                  {step.details && (
                    <div className="bg-gray-50 rounded-lg p-3 mb-2">
                      <h4 className="font-medium text-gray-900 mb-2">Configuration Details:</h4>
                      <div className="space-y-1 text-sm text-gray-600">
                        {Object.entries(step.details).map(([key, value]) => (
                          <div key={key} className="flex">
                            <span className="font-medium min-w-24 capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                            <code className="text-xs bg-gray-200 px-2 py-1 rounded">{value}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {step.action && (
                    <p className="text-blue-600 font-medium">
                      👉 {step.action}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Faucet Links */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">🚿 Get Test Tokens</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-bold text-gray-900 mb-2">Sepolia ETH Faucets</h3>
              <p className="text-gray-600 text-sm mb-3">Get free ETH for gas fees</p>
              <div className="space-y-2">
                <a
                  href="https://sepolia-faucet.pk910.de"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                >
                  PK910 Faucet
                </a>
                <a
                  href="https://sepoliafaucet.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center bg-green-600 text-white py-2 rounded hover:bg-green-700"
                >
                  Sepolia Faucet
                </a>
              </div>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-bold text-gray-900 mb-2">PYUSD Test Tokens</h3>
              <p className="text-gray-600 text-sm mb-3">Get test PYUSD for donations</p>
              <div className="space-y-2">
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <p className="text-yellow-800 text-sm">
                    📧 Contact project maintainer for test PYUSD tokens, or use DEX swaps with testnet ETH
                  </p>
                </div>
                <div className="text-xs text-gray-500">
                  <p>PYUSD Contract: 0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Example Payment Flow */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">💰 Example Payment Flow</h2>
          
          <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
                <p className="text-gray-800">Visit donation page: <code className="text-blue-600">/donate/ai-payroll-demo</code></p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
                <p className="text-gray-800">Enter donation amount (e.g., $25 PYUSD)</p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
                <p className="text-gray-800">Fill company details and generate QR code</p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</div>
                <p className="text-gray-800">Scan QR with MetaMask mobile or copy address</p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">✓</div>
                <p className="text-gray-800">Transaction appears in donation history automatically!</p>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Details */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">🔧 Technical Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-bold text-gray-900 mb-2">Blockchain Network</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p><strong>Network:</strong> Ethereum Sepolia Testnet</p>
                <p><strong>Chain ID:</strong> 11155111</p>
                <p><strong>Block Explorer:</strong> sepolia.etherscan.io</p>
                <p><strong>Gas Token:</strong> Sepolia ETH</p>
              </div>
            </div>
            
            <div>
              <h3 className="font-bold text-gray-900 mb-2">PYUSD Token</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p><strong>Symbol:</strong> PYUSD</p>
                <p><strong>Decimals:</strong> 6</p>
                <p><strong>Type:</strong> ERC-20 Token</p>
                <p><strong>Contract:</strong> 0xCaC524B...B1B3bB9</p>
              </div>
            </div>
          </div>
          
          <div className="mt-6 bg-blue-50 rounded-lg p-4">
            <h4 className="font-bold text-blue-900 mb-2">🎯 Why This Matters for Hackathon</h4>
            <p className="text-blue-800 text-sm">
              This demonstrates real blockchain integration with PayPal's PYUSD, showing how traditional payments 
              can seamlessly integrate with Web3 technology. The system automatically detects and records all 
              transactions, providing transparent and auditable donation tracking.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
