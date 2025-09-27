/**
 * Live Crypto Prices API
 * Fetches PYUSD and HBAR prices from CoinGecko
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🪙 Fetching live crypto prices...');

    // Fetch PYUSD price
    const pyusdResponse = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=paypal-usd&vs_currencies=usd',
      { 
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AI-Payroll-App'
        }
      }
    );
    
    // Fetch HBAR price
    const hbarResponse = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd',
      { 
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AI-Payroll-App'
        }
      }
    );

    const pyusdData = await pyusdResponse.json();
    const hbarData = await hbarResponse.json();

    console.log('PYUSD Price Data:', pyusdData);
    console.log('HBAR Price Data:', hbarData);

    // Extract prices
    const pyusdPrice = pyusdData['paypal-usd']?.usd || null;
    const hbarPrice = hbarData['hedera-hashgraph']?.usd || null;

    // Additional market data (if we want to show trends later)
    const prices = {
      pyusd: {
        price: pyusdPrice,
        symbol: 'PYUSD',
        name: 'PayPal USD',
        icon: '/payPal.png'
      },
      hbar: {
        price: hbarPrice,
        symbol: 'HBAR',
        name: 'Hedera',
        icon: '/hbar.png'
      }
    };

    return NextResponse.json({
      success: true,
      prices,
      timestamp: new Date().toISOString(),
      source: 'CoinGecko API'
    });

  } catch (error) {
    console.error('❌ Error fetching crypto prices:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch prices',
      prices: {
        pyusd: { price: null, symbol: 'PYUSD', name: 'PayPal USD', icon: '/payPal.png' },
        hbar: { price: null, symbol: 'HBAR', name: 'Hedera', icon: '/hbar.png' }
      },
      timestamp: new Date().toISOString()
    });
  }
}
