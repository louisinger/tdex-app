import {
  IonContent,
  IonPage,
  IonLoading,
  IonText,
  useIonViewWillEnter,
  IonGrid,
  IonRow,
  IonCol,
  IonButton,
} from '@ionic/react';
import classNames from 'classnames';
import type { UtxoInterface } from 'ldk';
import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RouteComponentProps } from 'react-router';
import type { Dispatch } from 'redux';
import { TradeType } from 'tdex-sdk';

import swap from '../../assets/img/swap.svg';
import tradeHistory from '../../assets/img/trade-history.svg';
import Header from '../../components/Header';
import PinModal from '../../components/PinModal';
import Refresher from '../../components/Refresher';
import type {
  TDEXMarket,
  TDEXTrade,
} from '../../redux/actionTypes/tdexActionTypes';
import type { BalanceInterface } from '../../redux/actionTypes/walletActionTypes';
import {
  addErrorToast,
  addSuccessToast,
} from '../../redux/actions/toastActions';
import { watchTransaction } from '../../redux/actions/transactionsActions';
import { unlockUtxos } from '../../redux/actions/walletActions';
import ExchangeRow from '../../redux/containers/exchangeRowContainer';
import type { AssetConfig } from '../../utils/constants';
import {
  defaultPrecision,
  PIN_TIMEOUT_FAILURE,
  PIN_TIMEOUT_SUCCESS,
} from '../../utils/constants';
import {
  AppError,
  IncorrectPINError,
  NoMarketsProvidedError,
} from '../../utils/errors';
import {
  customCoinSelector,
  getAssetHashLBTC,
  toSatoshi,
} from '../../utils/helpers';
import { getConnectedIdentity } from '../../utils/storage-helper';
import type { AssetWithTicker } from '../../utils/tdex';
import { allTrades, makeTrade, getTradablesAssets } from '../../utils/tdex';
import type { PreviewData } from '../TradeSummary';

import './style.scss';

const ERROR_LIQUIDITY = 'Not enough liquidity in market';

interface ExchangeProps extends RouteComponentProps {
  balances: BalanceInterface[];
  utxos: UtxoInterface[];
  explorerUrl: string;
  markets: TDEXMarket[];
  assets: Record<string, AssetConfig>;
  allAssets: AssetWithTicker[];
  dispatch: Dispatch;
}

const Exchange: React.FC<ExchangeProps> = ({
  history,
  balances,
  explorerUrl,
  markets,
  utxos,
  assets,
  allAssets,
  dispatch,
}) => {
  const lbtcUnit = useSelector((state: any) => state.settings.denominationLBTC);
  const [hasBeenSwapped, setHasBeenSwapped] = useState<boolean>(false);
  // user inputs amount
  const [sentAmount, setSentAmount] = useState<string>();
  const [receivedAmount, setReceivedAmount] = useState<string>();
  // assets selected for trade
  const [assetSent, setAssetSent] = useState<AssetWithTicker>();
  const [assetReceived, setAssetReceived] = useState<AssetWithTicker>();
  // current trades/tradable assets
  const [tradableAssets, setTradableAssets] = useState<AssetWithTicker[]>([]);
  const [trades, setTrades] = useState<TDEXTrade[]>([]);
  // selected trade
  const [trade, setTrade] = useState<TDEXTrade>();
  // focused input
  const [isFocused, setIsFocused] = useState<'sent' | 'receive'>('sent');
  // errors
  const [errorSent, setErrorSent] = useState('');
  const [errorReceived, setErrorReceived] = useState('');
  const [needReset, setNeedReset] = useState<boolean>(false);
  //
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isWrongPin, setIsWrongPin] = useState<boolean | null>(null);

  const checkAvailableAmountSent = () => {
    if (!trade || !sentAmount || !assetSent) return;
    const availableAmount =
      trade.type === TradeType.BUY
        ? trade.market.quoteAmount
        : trade.market.baseAmount;
    const sats = toSatoshi(
      sentAmount,
      assets[assetSent.asset]?.precision || defaultPrecision,
      assetSent.ticker === 'L-BTC' ? lbtcUnit : undefined,
    );
    if (
      !hasBeenSwapped &&
      availableAmount &&
      sats.greaterThan(availableAmount)
    ) {
      setErrorSent(ERROR_LIQUIDITY);
      return;
    }
    setErrorSent('');
  };

  const checkAvailableAmountReceived = () => {
    if (!trade || !receivedAmount || !assetReceived) return;
    const availableAmount =
      trade.type === TradeType.BUY
        ? trade.market.baseAmount
        : trade.market.quoteAmount;
    const sats = toSatoshi(
      receivedAmount,
      assets[assetReceived.asset]?.precision || defaultPrecision,
      assetReceived.ticker === 'L-BTC' ? lbtcUnit : undefined,
    );
    if (
      !hasBeenSwapped &&
      availableAmount &&
      sats.greaterThan(availableAmount)
    ) {
      setErrorReceived(ERROR_LIQUIDITY);
      return;
    }
    setErrorReceived('');
    // Reset hasBeenSwapped
    setHasBeenSwapped(false);
  };

  useIonViewWillEnter(() => {
    if (markets.length === 0) {
      dispatch(addErrorToast(NoMarketsProvidedError));
      history.goBack();
      return;
    }
    const lbtcHash = getAssetHashLBTC();
    const lbtcAsset = allAssets.find(h => h.asset === lbtcHash);
    setAssetSent(lbtcAsset);
    setSentAmount(undefined);
    setReceivedAmount(undefined);
  }, [balances, markets]);

  useEffect(() => {
    if (markets.length === 0 || !assetSent || !assetReceived) return;
    setTrades(allTrades(markets, assetSent.asset, assetReceived.asset));
  }, [assetSent, assetReceived, markets]);

  useEffect(() => {
    if (!assetSent || assetReceived) return;
    const tradable = getTradablesAssets(markets, assetSent.asset);
    setTradableAssets(tradable);
    setAssetReceived(tradable[0]);
  }, [assetSent, markets]);

  const sentAmountGreaterThanBalance = () => {
    const balance = balances.find(b => b.asset === assetSent?.asset);
    if (!balance || !sentAmount) return true;
    const amountAsSats = toSatoshi(
      sentAmount,
      balance.precision,
      balance.ticker === 'L-BTC' ? lbtcUnit : undefined,
    );
    return amountAsSats.greaterThan(balance.amount);
  };

  const onConfirm = () => setModalOpen(true);

  // make and broadcast trade, then push to trade summary page
  const onPinConfirm = async (pin: string) => {
    if (!assetSent || !trade || !sentAmount) return;
    try {
      setModalOpen(false);
      setLoading(true);
      let identity;
      try {
        identity = await getConnectedIdentity(pin, dispatch);
        setIsWrongPin(false);
        setTimeout(() => {
          setIsWrongPin(null);
        }, PIN_TIMEOUT_SUCCESS);
      } catch (_) {
        throw IncorrectPINError;
      }
      if (!trade) return;
      const txid = await makeTrade(
        trade,
        {
          amount: toSatoshi(
            sentAmount,
            assets[assetSent.asset]?.precision || defaultPrecision,
          ).toNumber(),
          asset: assetSent.asset,
        },
        explorerUrl,
        utxos,
        identity,
        customCoinSelector(dispatch),
      );

      dispatch(watchTransaction(txid));

      addSuccessToast('Trade successfully computed');
      const preview: PreviewData = {
        sent: {
          ticker: assetSent.ticker,
          amount: `-${sentAmount || '??'}`,
        },
        received: {
          ticker: assetReceived?.ticker || 'unknown',
          amount: receivedAmount?.toString() || '??',
        },
      };
      history.replace(`/tradesummary/${txid}`, { preview });
    } catch (e) {
      console.error(e);
      dispatch(unlockUtxos());
      setIsWrongPin(true);
      setTimeout(() => {
        setIsWrongPin(null);
        setNeedReset(true);
      }, PIN_TIMEOUT_FAILURE);
      if (e instanceof AppError) {
        dispatch(addErrorToast(e));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage id="exchange-page">
      <IonLoading isOpen={loading} />
      {assetSent && assetReceived && markets.length > 0 && (
        <PinModal
          open={modalOpen}
          title="Unlock your seed"
          description={`Enter your secret PIN to send ${sentAmount} ${assetSent.ticker} and receive ${receivedAmount} ${assetReceived.ticker}.`}
          onConfirm={onPinConfirm}
          onClose={() => {
            setModalOpen(false);
          }}
          isWrongPin={isWrongPin}
          needReset={needReset}
          setNeedReset={setNeedReset}
        />
      )}

      {assetSent && markets.length > 0 && (
        <IonContent className="exchange-content">
          <Refresher />
          <IonGrid className="ion-no-padding ion-padding-top">
            <Header
              hasBackButton={false}
              hasCloseButton={true}
              customRightButton={tradeHistory}
              handleCustomRightButton={() => {
                history.push('/history');
              }}
              title="Exchange"
              isTitleLarge={true}
            />
            <ExchangeRow
              sendInput={true}
              focused={isFocused === 'sent'}
              setFocus={() => setIsFocused('sent')}
              setTrade={(t: TDEXTrade) => setTrade(t)}
              relatedAssetAmount={receivedAmount || '0'}
              relatedAssetHash={assetReceived?.asset || ''}
              asset={assetSent}
              assetAmount={sentAmount}
              trades={trades}
              trade={trade}
              onChangeAmount={(newAmount: string) => {
                setSentAmount(newAmount);
                checkAvailableAmountSent();
              }}
              assetsWithTicker={allAssets}
              setAsset={asset => {
                if (assetReceived && asset.asset === assetReceived.asset)
                  setAssetReceived(assetSent);
                setAssetSent(asset);
              }}
              error={errorSent}
              setError={setErrorSent}
              setOtherInputError={setErrorReceived}
            />

            <div
              className="exchange-divider"
              onClick={() => {
                setHasBeenSwapped(true);
                setAssetSent(assetReceived);
                setAssetReceived(assetSent);
                setSentAmount(receivedAmount);
                setReceivedAmount(sentAmount);
              }}
            >
              <img src={swap} alt="swap" />
            </div>

            {assetReceived && (
              <ExchangeRow
                sendInput={false}
                focused={isFocused === 'receive'}
                setFocus={() => setIsFocused('receive')}
                setTrade={(t: TDEXTrade) => setTrade(t)}
                trades={trades}
                trade={trade}
                relatedAssetAmount={sentAmount || '0'}
                relatedAssetHash={assetSent?.asset || ''}
                asset={assetReceived}
                assetAmount={receivedAmount}
                onChangeAmount={(newAmount: string) => {
                  setReceivedAmount(newAmount);
                  checkAvailableAmountReceived();
                }}
                assetsWithTicker={tradableAssets}
                setAsset={asset => {
                  if (asset.asset === assetSent.asset)
                    setAssetSent(assetReceived);
                  setAssetReceived(asset);
                }}
                error={errorReceived}
                setError={setErrorReceived}
                setOtherInputError={setErrorSent}
              />
            )}

            <IonRow>
              <IonCol size="8.5" offset="1.75">
                <IonButton
                  className={classNames('main-button', {
                    'button-disabled':
                      !assetSent ||
                      !assetReceived ||
                      loading ||
                      sentAmountGreaterThanBalance(),
                  })}
                  onClick={onConfirm}
                  disabled={
                    !assetSent ||
                    !assetReceived ||
                    loading ||
                    sentAmountGreaterThanBalance()
                  }
                >
                  CONFIRM
                </IonButton>
              </IonCol>
            </IonRow>

            {trade && (
              <IonRow className="market-provider ion-margin-vertical-x2 ion-text-center">
                <IonCol size="10" offset="1">
                  <IonText className="trade-info" color="light">
                    Market provided by:{' '}
                    <span className="provider-info">
                      {` ${trade.market.provider.name} - ${trade.market.provider.endpoint}`}
                    </span>
                  </IonText>
                </IonCol>
              </IonRow>
            )}
          </IonGrid>
        </IonContent>
      )}
    </IonPage>
  );
};

export default Exchange;
