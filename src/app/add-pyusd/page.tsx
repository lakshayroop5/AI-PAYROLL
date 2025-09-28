'use client';

/**
 * Add PYUSD Token to MetaMask
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function AddPYUSDPage() {
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const PYUSD_CONFIG = {
    address: '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9',
    symbol: 'PYUSD',
    decimals: 6,
    image: 'https://assets.coingecko.com/coins/images/31212/large/PYUSD_Logo_%281%29.png'
  };

  async function addPYUSDToMetaMask() {
    if (!window.ethereum) {
      alert('MetaMask not detected! Please install MetaMask first.');
      return;
    }

    setAdding(true);
    try {
      const success = await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: PYUSD_CONFIG.address,
            symbol: PYUSD_CONFIG.symbol,
            decimals: PYUSD_CONFIG.decimals,
            image: PYUSD_CONFIG.image,
          },
        },
      });

      if (success) {
        setAdded(true);
        alert('✅ PYUSD token added to MetaMask! Check your wallet now.');
      } else {
        alert('❌ Failed to add PYUSD token. Please add it manually.');
      }
    } catch (error) {
      console.error('Error adding token:', error);
      alert('❌ Error adding token. Please add it manually.');
    } finally {
      setAdding(false);
    }
  }

  async function switchToSepolia() {
    if (!window.ethereum) {
      alert('MetaMask not detected!');
      return;
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }], // Sepolia chainId in hex
      });
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0xaa36a7',
                chainName: 'Sepolia test network',
                rpcUrls: ['https://sepolia.infura.io/v3/'],
                nativeCurrency: {
                  name: 'SepoliaETH',
                  symbol: 'SEP',
                  decimals: 18,
                },
                blockExplorerUrls: ['https://sepolia.etherscan.io'],
              },
            ],
          });
        } catch (addError) {
          console.error('Error adding Sepolia network:', addError);
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-green-600 shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-4 mb-4">
              <img src="/payPal.png" alt="PayPal" className="h-12 filter brightness-0 invert" />
              <h1 className="text-3xl font-bold text-white">Add PYUSD to MetaMask</h1>
            </div>
            <p className="text-blue-100">
              Add PayPal USD token to see your balance in MetaMask
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Current Status */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">🔍 Token Information</h2>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="font-medium">Token Name:</span>
              <span>PayPal USD</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="font-medium">Symbol:</span>
              <span className="font-mono">PYUSD</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="font-medium">Network:</span>
              <span>Ethereum Sepolia Testnet</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="font-medium">Contract:</span>
              <code className="text-xs bg-gray-200 px-2 py-1 rounded">
                {PYUSD_CONFIG.address}
              </code>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="font-medium">Decimals:</span>
              <span>{PYUSD_CONFIG.decimals}</span>
            </div>
          </div>
        </div>

        {/* Add Token Actions */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">🚀 Add PYUSD Token</h2>
          
          {/* Method 1: Automatic */}
          <div className="mb-6">
            <h3 className="font-bold text-gray-900 mb-2">Method 1: Automatic (Recommended)</h3>
            <p className="text-gray-600 text-sm mb-4">
              Click the button below to automatically add PYUSD to your MetaMask wallet.
            </p>
            
            <div className="space-y-3">
              <Button
                onClick={switchToSepolia}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                1️⃣ Switch to Sepolia Network
              </Button>
              
              <Button
                onClick={addPYUSDToMetaMask}
                disabled={adding || added}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {adding ? '⏳ Adding PYUSD...' : added ? '✅ PYUSD Added!' : '2️⃣ Add PYUSD Token'}
              </Button>
            </div>
          </div>

          {/* Method 2: Manual */}
          <div className="border-t pt-6">
            <h3 className="font-bold text-gray-900 mb-2">Method 2: Manual Import</h3>
            <p className="text-gray-600 text-sm mb-4">
              If automatic method doesn't work, follow these steps:
            </p>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-start space-x-2">
                <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">1</span>
                <p>Open MetaMask and ensure you're on <strong>Sepolia testnet</strong></p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">2</span>
                <p>Scroll down in your token list and click <strong>"Import tokens"</strong></p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">3</span>
                <p>Enter contract address: <code className="bg-gray-200 px-1 rounded text-xs">0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9</code></p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">4</span>
                <p>Symbol should auto-fill as <strong>PYUSD</strong></p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">5</span>
                <p>Click <strong>"Add Custom Token"</strong> then <strong>"Import Tokens"</strong></p>
              </div>
            </div>
          </div>
        </div>

        {/* Troubleshooting */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-bold text-yellow-900 mb-2">🔧 Still Not Seeing Your Tokens?</h3>
          <div className="text-yellow-800 text-sm space-y-2">
            <p>• Make sure you're on <strong>Sepolia testnet</strong> in MetaMask</p>
            <p>• Double-check the contract address is correct</p>
            <p>• Try refreshing MetaMask or restarting the browser</p>
            <p>• Check if your transaction was successful on <a href="https://sepolia.etherscan.io" className="underline" target="_blank">Sepolia Etherscan</a></p>
            <p>• It can take a few minutes for balance to appear after receiving tokens</p>
          </div>
        </div>

        {/* Back to App */}
        <div className="mt-6 text-center">
          <Button
            onClick={() => window.close()}
            variant="outline"
          >
            ← Back to AI-Payroll
          </Button>
        </div>
      </div>
    </div>
  );
}
