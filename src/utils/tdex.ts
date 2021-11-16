import axios from 'axios';
import type { CoinSelector, UtxoInterface } from 'ldk';
import { bestBalanceDiscovery, bestPriceDiscovery, combineDiscovery, Discoverer, DiscoveryOpts, Trade, TradeInterface, TraderClient, TradeType } from 'tdex-sdk';
import type { TDEXMnemonic } from 'tdex-sdk';

import type { TDEXTrade, TDEXMarket, TDEXProvider } from '../redux/actionTypes/tdexActionTypes';

import { defaultPrecision, LbtcDenomination } from './constants';
import { getMainAsset } from './constants';
import { InvalidTradeTypeError, MakeTradeError } from './errors';
import { isLbtc, toSatoshi } from './helpers';

export interface AssetWithTicker {
  asset: string;
  ticker: string;
  precision: number;
  coinGeckoID?: string;
}

/**
 * Select the best price in a set of available markets
 * @param known the amount/asset inputs by the user
 * @param trades the set of trades available
 * @param lbtcUnit
 * @param onError launch if an error happen in getMarketPrice request
 * @param torProxy
 */
export async function bestPrice(
  known: { amount: string; asset: string; precision: number },
  trades: TDEXTrade[],
  lbtcUnit: LbtcDenomination,
  onError: (e: string) => void,
  torProxy = 'https://proxy.tdex.network'
): Promise<{ amount: number; asset: string; trade: TDEXTrade }> {
  if (trades.length === 0) throw new Error('trades array should not be empty');

  const toPrice = async (trade: TDEXTrade) =>
    calculatePrice(known, trade, lbtcUnit, torProxy)
      .then((res) => ({ ...res, trade }))
      .catch(onError);
  const pricesPromises = trades.map(toPrice);

  const results = (await Promise.allSettled(pricesPromises))
    .filter(({ status }) => status === 'fulfilled')
    .map(
      (p) =>
        (
          p as PromiseFulfilledResult<{
            amount: number;
            asset: string;
            trade: TDEXTrade;
          }>
        ).value
    )
    .filter((res) => res !== undefined);

  if (results.length === 0) throw new Error('Unable to preview price from providers.');

  const sorted = results.sort((p0, p1) => p0.amount - p1.amount);
  return sorted[0];
}

export function createTraderClient(endpoint: string, proxy = 'https://proxy.tdex.network'): TraderClient {
  return new TraderClient(endpoint, proxy)
}

const bestBalanceAndThenBestPrice = combineDiscovery(bestBalanceDiscovery, bestPriceDiscovery);

// Create discoverer object for a specific set of trader clients
export function createDiscoverer(clients: TraderClient[], errorHandler?: () => Promise<void>): Discoverer {
  return new Discoverer(
    clients,
    bestBalanceAndThenBestPrice,
    errorHandler
  )
}


/**
 * Wrapper for marketPrice request
 * @param known the amount/asset provided by the user
 * @param trade trade used to compute the price
 * @param lbtcUnit
 * @param torProxy
 */
export async function calculatePrice(
  known: { amount: string; asset: string; precision: number },
  trade: TDEXTrade,
  lbtcUnit: LbtcDenomination,
  torProxy = 'https://proxy.tdex.network'
): Promise<{ amount: number; asset: string }> {
  if (Number(known.amount) <= 0) {
    return {
      amount: 0,
      asset: trade.market.baseAsset === known.asset ? trade.market.quoteAsset : trade.market.baseAsset,
    };
  }
  const client = new TraderClient(trade.market.provider.endpoint, torProxy);
  const response = await client.marketPrice(
    trade.market,
    trade.type,
    toSatoshi(known.amount, known.precision, isLbtc(known.asset) ? lbtcUnit : undefined).toNumber(),
    known.asset
  );
  return {
    amount: response[0].amount,
    asset: response[0].asset,
  };
}

/**
 * make and broadcast the swap transaction
 * @param trade the selected trade using to swap
 * @param known the data inputs by the user
 * @param explorerLiquidAPI the esplora URL
 * @param utxos the user's set of utxos
 * @param identity the user's identity, using to sign and blind the transaction
 * @param coinSelector the coin selector using to *select* unspents
 * @param torProxy
 */
export async function makeTrade(
  trade: TDEXTrade,
  known: { amount: number; asset: string },
  explorerLiquidAPI: string,
  utxos: UtxoInterface[],
  identity: TDEXMnemonic,
  coinSelector: CoinSelector,
  torProxy = 'https://proxy.tdex.network'
): Promise<string> {
  const trader = new Trade(
    {
      explorerUrl: explorerLiquidAPI,
      providerUrl: trade.market.provider.endpoint,
      utxos,
      coinSelector,
    },
    torProxy
  );
  let txid = '';
  try {
    if (trade.type === TradeType.BUY) {
      txid = await trader.buy({ ...known, market: trade.market, identity });
    }
    if (trade.type === TradeType.SELL) {
      txid = await trader.sell({ ...known, market: trade.market, identity });
    }
  } catch (e) {
    console.error(e);
    throw MakeTradeError;
  }
  if (txid === '') {
    throw InvalidTradeTypeError;
  }
  return txid;
}

/**
 * Construct all the TDexTrade from a set of markets
 * @param markets the set of available markets
 * @param sentAsset the asset to sent
 * @param receivedAsset the asset to receive
 */
export function allTrades(markets: TDEXMarket[], sentAsset?: string, receivedAsset?: string): Record<TradeType, TDEXTrade[]> {
  if (!sentAsset || !receivedAsset) return [];
  const trades: TDEXTrade[] = [];
  const tradesByType: Record<TradeType, TDEXTrade[]> = {
    [TradeType.SELL]: [],
    [TradeType.BUY]: [],
  }
  for (const market of markets) {
    if (sentAsset === market.baseAsset && receivedAsset === market.quoteAsset) {
      trades.push({ market, type: TradeType.SELL });
    }

    if (sentAsset === market.quoteAsset && receivedAsset === market.baseAsset) {
      trades.push({ market, type: TradeType.BUY });
    }
  }

  return trades;
}

/**
 * Filter a set of markets using asset to sent.
 * @param markets
 * @param sentAsset
 */
export function getTradablesAssets(markets: TDEXMarket[], sentAsset: string): AssetWithTicker[] {
  const results: AssetWithTicker[] = [];

  for (const market of markets) {
    if (sentAsset === market.baseAsset && !results.map((r) => r.asset).includes(market.quoteAsset)) {
      const mainAsset = getMainAsset(market.quoteAsset);
      const ticker = mainAsset ? mainAsset.ticker : market.quoteAsset.slice(0, 4).toUpperCase();
      const coinGeckoID = mainAsset?.coinGeckoID;

      results.push({
        asset: market.quoteAsset,
        ticker,
        coinGeckoID,
        precision: mainAsset?.precision ?? defaultPrecision
      });
    }

    if (sentAsset === market.quoteAsset && !results.map((r) => r.asset).includes(market.baseAsset)) {
      const mainAsset = getMainAsset(market.baseAsset);
      const ticker = mainAsset ? mainAsset.ticker : market.baseAsset.slice(0, 4).toUpperCase();
      const coinGeckoID = mainAsset?.coinGeckoID;

      results.push({
        asset: market.baseAsset,
        ticker,
        coinGeckoID,
        precision: mainAsset?.precision ?? defaultPrecision
      });
    }
  }

  return results;
}

const TDexRegistryURL = 'https://raw.githubusercontent.com/TDex-network/tdex-registry/master/registry.json';

export async function getProvidersFromTDexRegistry(): Promise<TDEXProvider[]> {
  return (await axios.get(TDexRegistryURL)).data;
}
