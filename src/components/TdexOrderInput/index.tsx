import { IonRippleEffect, useIonViewDidEnter, useIonViewDidLeave } from '@ionic/react';
import React, { useEffect } from 'react';
import { connect } from 'react-redux';
import type { TradeOrder } from 'tdex-sdk';

import swap from '../../assets/img/swap.svg';
import type { TDEXMarket } from '../../redux/actionTypes/tdexActionTypes';
import { selectAllTradableAssets } from '../../redux/reducers/tdexReducer';
import type { RootState } from '../../redux/store';
import type { AssetConfig } from '../../utils/constants';
import { setAccessoryBar } from '../../utils/keyboard';
import { getTradablesAssets } from '../../utils/tdex';

import { useTradeState } from './hooks';
import TradeRowInput from './trade-row-input';

import './style.scss';

interface ConnectedProps {
  assetRegistry: Record<string, AssetConfig>;
  initialMarket: TDEXMarket;
  allTradableAssets: AssetConfig[];
  markets: TDEXMarket[];
}

export interface SatsAsset {
  sats: number;
  asset: string;
}

export interface TdexOrderInputResult {
  order: TradeOrder;
  send: SatsAsset;
  receive: SatsAsset;
}

type Props = ConnectedProps & {
  onInput: (tdexOrder?: TdexOrderInputResult) => void;
};

// two rows input component with integrated TDEX discoverer
// let the user chooses a tradable asset pair
// and inputs an amount of satoshis to sell or to buy
// if found, it returns best orders via `onInput` property
const TdexOrderInput: React.FC<Props> = ({ assetRegistry, initialMarket, allTradableAssets, markets, onInput }) => {
  const [
    bestOrder,
    sendAsset,
    sendSats,
    receiveAsset,
    receiveSats,
    setReceiveAsset,
    setSendAsset,
    setSendAmount,
    setReceiveAmount,
    sendLoader,
    receiveLoader,
    sendError,
    receiveError,
  ] = useTradeState(initialMarket.baseAsset, initialMarket.quoteAsset);

  useIonViewDidEnter(() => {
    setAccessoryBar(true).catch(console.error);
  });

  useIonViewDidLeave(() => {
    setAccessoryBar(false).catch(console.error);
  });

  useEffect(() => {
    if (sendError || receiveError) onInput(undefined);
  }, [sendError, receiveError]);

  useEffect(() => {
    if (bestOrder)
      onInput({
        order: bestOrder,
        send: {
          sats: sendSats,
          asset: sendAsset,
        },
        receive: {
          sats: receiveSats,
          asset: receiveAsset,
        },
      });
    onInput(undefined);
  }, [bestOrder]);

  const swapSendAndReceiveAsset = () => {
    const receive = receiveAsset;
    setReceiveAsset(sendAsset);
    setSendAsset(receive);
  };

  return (
    <>
      <TradeRowInput
        type="send"
        sats={sendSats}
        assetSelected={assetRegistry[sendAsset]}
        isLoading={sendLoader}
        error={sendError}
        onChangeAsset={setSendAsset}
        onChangeSats={setSendAmount}
        searchableAssets={allTradableAssets}
      />
      <div className="exchange-divider ion-activatable" onClick={swapSendAndReceiveAsset}>
        <img src={swap} alt="swap" />
        <IonRippleEffect type="unbounded" />
      </div>
      <TradeRowInput
        type="receive"
        sats={receiveSats}
        assetSelected={assetRegistry[receiveAsset]}
        isLoading={receiveLoader}
        error={receiveError}
        onChangeAsset={setReceiveAsset}
        onChangeSats={setReceiveAmount}
        searchableAssets={getTradablesAssets(markets, sendAsset).map((h) => assetRegistry[h])}
      />
    </>
  );
};

const mapStateToProps = (state: RootState): ConnectedProps => ({
  assetRegistry: state.assets,
  initialMarket: state.tdex.markets[0],
  markets: state.tdex.markets,
  allTradableAssets: selectAllTradableAssets(state),
});

export default connect(mapStateToProps)(TdexOrderInput);
