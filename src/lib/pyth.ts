/**
 * Pyth Network Price Feed Integration
 * Handles real-time price feeds with staleness validation
 */

export interface PythPriceData {
  feedId: string;
  price: string; // Price as string to maintain precision
  confidence: string; // Confidence interval
  expo: number; // Exponent for price scaling
  publishTime: number; // Unix timestamp
  emaPrice: string; // Exponential moving average price
  emaConfidence: string; // EMA confidence
}

export interface PriceSnapshot {
  feedId: string;
  symbol: string; // e.g., "HBAR/USD"
  price: number; // Normalized price value
  confidence: number; // Confidence as percentage
  timestamp: Date;
  staleness: number; // Age in seconds
  raw: PythPriceData; // Raw Pyth data for auditability
}

export interface AssetConfig {
  symbol: string;
  feedId: string;
  decimals: number;
  description: string;
}

export class PythPriceService {
  private hermesUrl: string;
  private maxStalenessSeconds: number;
  private retryAttempts: number;
  private retryDelay: number;

  // Supported assets with their Pyth feed IDs
  private readonly ASSET_CONFIGS: Record<string, AssetConfig> = {
    'HBAR': {
      symbol: 'HBAR/USD',
      feedId: '0x0ac7c3c3fcdb6b0eb5d1b68b9bf33dc8b5e5c0b9e4c7a9b1d6f2a5f9c8e3b0d7',
      decimals: 8,
      description: 'Hedera Hashgraph USD Price'
    },
    'BTC': {
      symbol: 'BTC/USD',
      feedId: '0xe62df6c8b4c85d9a6d7c0b3f8e2a1c5b8d9f3a6c1e4b7d0f2a8c5e9b3d6f1a4',
      decimals: 8,
      description: 'Bitcoin USD Price'
    },
    'ETH': {
      symbol: 'ETH/USD',
      feedId: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
      decimals: 8,
      description: 'Ethereum USD Price'
    }
  };

  constructor() {
    this.hermesUrl = process.env.PYTH_HERMES_URL || 'https://hermes.pyth.network';
    this.maxStalenessSeconds = parseInt(process.env.MAX_PRICE_STALENESS_SECONDS || '300');
    this.retryAttempts = parseInt(process.env.DEFAULT_RETRY_ATTEMPTS || '3');
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Get latest price for an asset
   */
  async getLatestPrice(asset: string): Promise<PriceSnapshot> {
    const config = this.getAssetConfig(asset);
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const priceData = await this.fetchPriceData(config.feedId);
        const snapshot = this.createPriceSnapshot(config, priceData);
        
        // Validate staleness
        if (snapshot.staleness > this.maxStalenessSeconds) {
          throw new Error(
            `Price data is too stale: ${snapshot.staleness}s > ${this.maxStalenessSeconds}s`
          );
        }
        
        return snapshot;
      } catch (error) {
        if (attempt === this.retryAttempts) {
          throw new Error(
            `Failed to get latest price for ${asset} after ${this.retryAttempts} attempts: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          );
        }
        
        // Wait before retrying
        await this.delay(this.retryDelay * attempt);
      }
    }
    
    throw new Error(`Failed to get latest price for ${asset}`);
  }

  /**
   * Get price at a specific timestamp (if available)
   */
  async getHistoricalPrice(asset: string, timestamp: Date): Promise<PriceSnapshot | null> {
    const config = this.getAssetConfig(asset);
    
    try {
      // For historical data, we would typically use a different endpoint
      // For now, we'll return null as historical data might not be available
      // In a real implementation, this would query historical price feeds
      console.log(`Historical price requested for ${asset} at ${timestamp.toISOString()}`);
      return null;
    } catch (error) {
      console.error(`Error fetching historical price for ${asset}:`, error);
      return null;
    }
  }

  /**
   * Get multiple asset prices in batch
   */
  async getBatchPrices(assets: string[]): Promise<Map<string, PriceSnapshot>> {
    const results = new Map<string, PriceSnapshot>();
    const promises = assets.map(async (asset) => {
      try {
        const price = await this.getLatestPrice(asset);
        results.set(asset, price);
      } catch (error) {
        console.error(`Error fetching price for ${asset}:`, error);
        // Don't include failed fetches in results
      }
    });

    await Promise.allSettled(promises);
    return results;
  }

  /**
   * Convert USD amount to native asset amount
   */
  convertUsdToNative(usdAmount: number, priceSnapshot: PriceSnapshot, assetDecimals: number): string {
    const nativeAmount = usdAmount / priceSnapshot.price;
    const scaledAmount = Math.floor(nativeAmount * Math.pow(10, assetDecimals));
    return scaledAmount.toString();
  }

  /**
   * Convert native asset amount to USD
   */
  convertNativeToUsd(nativeAmount: string, priceSnapshot: PriceSnapshot, assetDecimals: number): number {
    const amount = parseInt(nativeAmount) / Math.pow(10, assetDecimals);
    return amount * priceSnapshot.price;
  }

  /**
   * Get supported assets
   */
  getSupportedAssets(): AssetConfig[] {
    return Object.values(this.ASSET_CONFIGS);
  }

  /**
   * Validate price freshness
   */
  isPriceFresh(priceSnapshot: PriceSnapshot): boolean {
    return priceSnapshot.staleness <= this.maxStalenessSeconds;
  }

  /**
   * Get asset configuration
   */
  private getAssetConfig(asset: string): AssetConfig {
    const config = this.ASSET_CONFIGS[asset.toUpperCase()];
    if (!config) {
      throw new Error(`Unsupported asset: ${asset}`);
    }
    return config;
  }

  /**
   * Fetch price data from Hermes API
   */
  private async fetchPriceData(feedId: string): Promise<PythPriceData> {
    const url = `${this.hermesUrl}/api/latest_price_feeds?ids[]=${feedId}&encoding=hex`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AI-Payroll-System/1.0.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Hermes API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error('No price data received from Hermes API');
    }

    const priceUpdate = data[0];
    if (!priceUpdate || !priceUpdate.price) {
      throw new Error('Invalid price data structure received');
    }

    return {
      feedId: priceUpdate.id,
      price: priceUpdate.price.price,
      confidence: priceUpdate.price.conf,
      expo: priceUpdate.price.expo,
      publishTime: priceUpdate.price.publish_time,
      emaPrice: priceUpdate.ema_price?.price || priceUpdate.price.price,
      emaConfidence: priceUpdate.ema_price?.conf || priceUpdate.price.conf
    };
  }

  /**
   * Create normalized price snapshot
   */
  private createPriceSnapshot(config: AssetConfig, priceData: PythPriceData): PriceSnapshot {
    // Convert price from Pyth format (price * 10^expo) to decimal
    const price = parseInt(priceData.price) * Math.pow(10, priceData.expo);
    const confidence = parseInt(priceData.confidence) * Math.pow(10, priceData.expo);
    
    const timestamp = new Date(priceData.publishTime * 1000);
    const staleness = Math.floor((Date.now() - timestamp.getTime()) / 1000);
    
    return {
      feedId: priceData.feedId,
      symbol: config.symbol,
      price,
      confidence: (confidence / price) * 100, // Confidence as percentage
      timestamp,
      staleness,
      raw: priceData
    };
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create price snapshot for database storage
   */
  createStorableSnapshot(priceSnapshot: PriceSnapshot): string {
    return JSON.stringify({
      feedId: priceSnapshot.feedId,
      symbol: priceSnapshot.symbol,
      price: priceSnapshot.price,
      confidence: priceSnapshot.confidence,
      timestamp: priceSnapshot.timestamp.toISOString(),
      staleness: priceSnapshot.staleness,
      raw: priceSnapshot.raw
    });
  }

  /**
   * Parse stored price snapshot
   */
  parseStoredSnapshot(snapshotJson: string): PriceSnapshot {
    const data = JSON.parse(snapshotJson);
    return {
      ...data,
      timestamp: new Date(data.timestamp)
    };
  }
}

export const pythPriceService = new PythPriceService();