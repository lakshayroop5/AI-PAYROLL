'use client';

/**
 * Company Donation Page
 * Displays QR code, wallet address, and payment options for PYUSD donations
 */

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface DonationPageData {
  id: string;
  slug: string;
  pageTitle: string;
  description: string;
  managerName: string;
  managerWallet: string;
  acceptedCurrencies: string[];
  minimumAmount?: number;
  maximumAmount?: number;
  customMessage?: string;
  logoUrl?: string;
  themeColor: string;
  totalDonations: number;
  donationCount: number;
  lastDonationAt?: string;
}

interface DonationHistory {
  id: string;
  companyName?: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  transactionHash?: string;
}

export default function DonationPage() {
  const params = useParams();
  const slug = params?.slug as string;
  
  const [pageData, setPageData] = useState<DonationPageData | null>(null);
  const [donationHistory, setDonationHistory] = useState<DonationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [donationAmount, setDonationAmount] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [message, setMessage] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  useEffect(() => {
    if (slug) {
      fetchPageData();
      fetchDonationHistory();
    }
  }, [slug]);

  async function fetchPageData() {
    try {
      const response = await fetch(`/api/donate/${slug}`);
      if (response.ok) {
        const data = await response.json();
        setPageData(data);
      } else {
        console.error('Failed to fetch donation page data');
      }
    } catch (error) {
      console.error('Error fetching donation page:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchDonationHistory() {
    try {
      const response = await fetch(`/api/donate/${slug}/history`);
      if (response.ok) {
        const data = await response.json();
        setDonationHistory(data.donations || []);
      }
    } catch (error) {
      console.error('Error fetching donation history:', error);
    }
  }

  async function generateQRCode(data: string) {
    try {
      const QRCode = (await import('qrcode')).default;
      const qrDataUrl = await QRCode.toDataURL(data, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeDataUrl(qrDataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  }

  async function submitDonation() {
    if (!pageData || !donationAmount || parseFloat(donationAmount) <= 0) {
      alert('Please enter a valid donation amount');
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch(`/api/donate/${slug}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(donationAmount),
          currency: 'PYUSD',
          companyName: companyName || 'Anonymous',
          donorEmail,
          message
        })
      });

      if (response.ok) {
        const result = await response.json();
        setShowQR(true);
        
        // Generate QR code for the payment
        const paymentAddress = pageData?.managerWallet || '';
        const qrData = `ethereum:${paymentAddress}?value=${parseFloat(donationAmount)}&token=PYUSD`;
        await generateQRCode(qrData);
        
        // Refresh donation history
        fetchDonationHistory();
        alert('✅ Donation created! Please scan the QR code to complete PYUSD payment.');
      } else {
        const error = await response.json();
        alert(`❌ Failed to create donation: ${error.error}`);
      }
    } catch (error) {
      alert('❌ Error creating donation');
    } finally {
      setProcessing(false);
    }
  }

  const paymentAddress = pageData?.managerWallet || '';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!pageData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Page Not Found</h1>
          <p className="text-gray-600">The donation page you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ accentColor: pageData.themeColor }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {pageData.logoUrl && (
                <img src={pageData.logoUrl} alt="Logo" className="h-12 w-12 rounded-lg" />
              )}
              <div>
                <h1 className="text-2xl font-bold text-white">{pageData.pageTitle}</h1>
                <p className="text-blue-100">Managed by {pageData.managerName}</p>
              </div>
            </div>
            
            {/* PayPal Logo */}
            <div className="flex items-center space-x-3">
              <img 
                src="/payPal.png" 
                alt="PayPal" 
                className="h-8 md:h-10"
              />
              <div className="text-right">
                <p className="text-white font-bold text-sm md:text-base">Powered by</p>
                <p className="text-blue-200 text-xs md:text-sm">PayPal USD (PYUSD)</p>
              </div>
            </div>
          </div>
          
          {/* PayPal PYUSD Banner */}
          <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <div className="flex items-center justify-center space-x-3">
              <img src="/payPal.png" alt="PayPal" className="h-6" />
              <p className="text-white font-medium text-center">
                💰 Pay with <span className="font-bold">PayPal App</span> - Convert your currency to PYUSD instantly!
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Donation Form */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-center mb-6">
              <div className="flex items-center justify-center space-x-3 mb-3">
                <img src="/payPal.png" alt="PayPal" className="h-8" />
                <h2 className="text-2xl font-bold text-blue-600">
                  PYUSD Donation
                </h2>
              </div>
              <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-4 border border-blue-200">
                <p className="text-blue-800 font-medium mb-2">
                  🚀 <strong>Revolutionary PayPal Integration!</strong>
                </p>
                <p className="text-blue-700 text-sm">
                  Use your PayPal app to convert any currency to PYUSD and send donations directly on blockchain
                </p>
              </div>
            </div>
            
            {pageData.description && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-blue-800">{pageData.description}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Donation Amount (USD) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(e.target.value)}
                  placeholder="25.00"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
                {pageData.minimumAmount && (
                  <p className="text-xs text-gray-500 mt-1">
                    Minimum: ${pageData.minimumAmount}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company/Organization Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Your Company Name (optional)"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={donorEmail}
                  onChange={(e) => setDonorEmail(e.target.value)}
                  placeholder="your.email@company.com (optional)"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message (optional)
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Thank you for your amazing work..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              <Button 
                onClick={submitDonation}
                disabled={!donationAmount || parseFloat(donationAmount) <= 0 || processing}
                className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white font-bold"
              >
                {processing ? 'Creating PYUSD Payment...' : '💰 Generate PYUSD Payment QR'}
              </Button>
            </div>
          </div>

          {/* Payment Details & QR Code */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-center mb-4">
              <div className="flex items-center justify-center space-x-3 mb-2">
                <img src="/payPal.png" alt="PayPal" className="h-6" />
                <h2 className="text-xl font-bold text-blue-600">PayPal USD Payment</h2>
              </div>
              <p className="text-gray-600 text-sm">Scan with PayPal app or any PYUSD wallet</p>
            </div>
            
            <div className="space-y-4">
              {/* Don't have PYUSD Section */}
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <img src="/payPal.png" alt="PayPal" className="h-6 mt-1" />
                  <div>
                    <h3 className="font-bold text-orange-900 mb-2">🎯 Don't have PYUSD? No Problem!</h3>
                    <div className="text-orange-800 text-sm space-y-1">
                      <p>• Open your <strong>PayPal mobile app</strong></p>
                      <p>• Go to <strong>Crypto</strong> section</p>
                      <p>• Convert any currency to <strong>PYUSD</strong> instantly</p>
                      <p>• Use QR scanner to complete donation</p>
                    </div>
                    <div className="mt-3 p-2 bg-orange-100 rounded text-xs text-orange-700">
                      <strong>💡 Pro Tip:</strong> PYUSD = PayPal USD - Stable, fast, and blockchain-powered!
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Address
                </label>
                <div className="flex items-center space-x-2">
                  <code className="flex-1 p-3 bg-gray-100 rounded text-sm font-mono break-all">
                    {paymentAddress}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(paymentAddress)}
                  >
                    Copy
                  </Button>
                </div>
              </div>

              {showQR && donationAmount && (
                <div className="text-center">
                  <div className="mb-4 p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg">
                    <div className="flex items-center justify-center space-x-3 mb-2">
                      <img src="/payPal.png" alt="PayPal" className="h-6 filter brightness-0 invert" />
                      <h3 className="font-bold text-lg">
                        PayPal USD Payment: ${donationAmount}
                      </h3>
                    </div>
                    <p className="text-blue-100 text-sm">
                      🔥 Scan with PayPal App • Convert any currency to PYUSD instantly!
                    </p>
                  </div>
                  
                  <div className="relative inline-block">
                    <div className="p-4 bg-white border-2 border-blue-300 rounded-lg shadow-2xl">
                      {qrCodeDataUrl ? (
                        <div className="relative">
                          <img 
                            src={qrCodeDataUrl} 
                            alt="PayPal PYUSD Payment QR Code" 
                            className="w-48 h-48"
                          />
                          {/* PayPal logo overlay */}
                          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-full p-2 shadow-lg">
                            <img src="/payPal.png" alt="PayPal" className="h-6 w-6" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-48 h-48 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                          <div className="text-center">
                            <img src="/payPal.png" alt="PayPal" className="h-8 mx-auto mb-2" />
                            <div className="text-2xl mb-2">🔄</div>
                            <p className="text-sm font-medium text-blue-700">Generating PayPal QR...</p>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Animated border */}
                    <div className="absolute inset-0 rounded-lg border-2 border-blue-400 animate-pulse"></div>
                  </div>
                  
                  <div className="mt-4 space-y-3">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="font-medium text-sm mb-1">💳 PYUSD Token Address:</p>
                      <code className="text-xs break-all text-gray-600">
                        0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9
                      </code>
                    </div>
                    
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="font-medium text-sm mb-1">🔗 Payment URL:</p>
                      <code className="text-xs break-all text-gray-600">
                        {typeof window !== 'undefined' ? window.location.origin : ''}/donate/{slug}
                      </code>
                    </div>
                    
                    {/* PayPal Instructions */}
                    <div className="p-3 bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <img src="/payPal.png" alt="PayPal" className="h-4" />
                        <p className="font-bold text-blue-900 text-sm">How to Pay with PayPal App:</p>
                      </div>
                      <div className="text-xs text-blue-800 space-y-1">
                        <p>1. 📱 Open PayPal mobile app</p>
                        <p>2. 💰 Go to "Crypto" or "Digital Currency"</p>
                        <p>3. 🔄 Convert your currency to PYUSD</p>
                        <p>4. 📸 Scan this QR code to send payment</p>
                        <p>5. ✅ Transaction confirms on blockchain instantly!</p>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-500 space-y-1 text-center">
                      <p>• Ethereum Testnet (Sepolia) • PYUSD Test Tokens</p>
                      <p>• Real blockchain technology demonstration</p>
                      <a 
                        href="/payment-guide" 
                        target="_blank"
                        className="block text-blue-600 hover:underline font-medium mt-2"
                      >
                        📘 Need help? View Payment Guide →
                      </a>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t">
                <h3 className="font-medium text-gray-900 mb-2">📊 Statistics</h3>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Total Donations:</dt>
                    <dd className="font-medium">${pageData.totalDonations.toFixed(2)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Donation Count:</dt>
                    <dd className="font-medium">{pageData.donationCount}</dd>
                  </div>
                  {pageData.lastDonationAt && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Last Donation:</dt>
                      <dd className="font-medium">
                        {new Date(pageData.lastDonationAt).toLocaleDateString()}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Donation History */}
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <img src="/payPal.png" alt="PayPal" className="h-6" />
            <h2 className="text-xl font-bold text-blue-600">Recent PayPal USD Donations</h2>
          </div>
          
          {donationHistory.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No donations yet. Be the first to support this project! 🚀</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Date</th>
                    <th className="text-left py-2">Company</th>
                    <th className="text-left py-2">Amount</th>
                    <th className="text-left py-2">Status</th>
                    <th className="text-left py-2">Transaction</th>
                  </tr>
                </thead>
                <tbody>
                  {donationHistory.map((donation) => (
                    <tr key={donation.id} className="border-b hover:bg-gray-50">
                      <td className="py-2">
                        {new Date(donation.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2">{donation.companyName || 'Anonymous'}</td>
                      <td className="py-2 font-medium">
                        ${donation.amount} {donation.currency}
                      </td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          donation.status === 'CONFIRMED' 
                            ? 'bg-green-100 text-green-800' 
                            : donation.status === 'FAILED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {donation.status}
                        </span>
                      </td>
                      <td className="py-2">
                        {donation.transactionHash ? (
                          <a
                            href={`https://sepolia.etherscan.io/tx/${donation.transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-xs"
                          >
                            View on Etherscan
                          </a>
                        ) : (
                          <span className="text-gray-400 text-xs">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Custom Message */}
        {pageData.customMessage && (
          <div className="mt-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
            <div className="flex items-center space-x-3 mb-3">
              <img src="/payPal.png" alt="PayPal" className="h-6 filter brightness-0 invert" />
              <h3 className="font-bold text-lg">💝 Message from the maintainer</h3>
            </div>
            <p className="text-blue-100 leading-relaxed">{pageData.customMessage}</p>
          </div>
        )}

        {/* PayPal PYUSD Promotion */}
        <div className="mt-8 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 rounded-lg p-6 text-white">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-4 mb-4">
              <img src="/payPal.png" alt="PayPal" className="h-10 filter brightness-0 invert" />
              <h2 className="text-2xl font-bold">Powered by PayPal USD (PYUSD)</h2>
            </div>
            <div className="max-w-2xl mx-auto space-y-3 text-sm">
              <p className="font-medium">🚀 <strong>Experience the Future of Digital Payments!</strong></p>
              <p>PYUSD combines the trust of PayPal with the power of blockchain technology. Convert any currency instantly and send donations with just a QR scan!</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-xs">
                <div className="bg-white/20 rounded-lg p-3">
                  <p className="font-bold">💰 Instant Conversion</p>
                  <p>Turn any currency into PYUSD in seconds</p>
                </div>
                <div className="bg-white/20 rounded-lg p-3">
                  <p className="font-bold">🔒 PayPal Security</p>
                  <p>Trusted by millions worldwide</p>
                </div>
                <div className="bg-white/20 rounded-lg p-3">
                  <p className="font-bold">⚡ Blockchain Speed</p>
                  <p>Fast, transparent transactions</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
