import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { TradeOrder } from 'tdex-sdk';
import { RootState } from '../../redux/store';
import { computeOrders, createDiscoverer, getTradablesAssets } from '../../utils/tdex';

interface AssetSats {
  assetHash: string;
  sats: number;
}

// calculate price is a wrapper of marketPrice rpc call
// it returns the price of the asset in sats
const calculatePrice =
  (sats: number, asset: string) =>
  async (order: TradeOrder): Promise<AssetSats> => {
    const response = await order.traderClient.marketPrice(order.market, order.type, sats, asset);

    return {
      assetHash: response[0].asset,
      sats: response[0].amount,
    };
  };

// custom state hook using to represent an asset/sats pair
function useAssetSats(initialValue: string) {
  const [assetHash, setAssetHash] = useState(initialValue);
  const [sats, setSats] = useState<number>(0);

  return [assetHash, sats, setAssetHash, setSats] as const;
}

export function useTradeState(initialSendAsset: string, initialReceiveAsset: string) {
  const [sendAsset, sendSats, setSendAsset, setSendSats] = useAssetSats(initialSendAsset);
  const [receiveAsset, receiveSats, setReceiveAsset, setReceiveSats] = useAssetSats(initialReceiveAsset);
  const [bestOrder, setBestOrder] = useState<TradeOrder>();

  const [sendLoader, setSendLoader] = useState(false);
  const [receiveLoader, setReceiveLoader] = useState(false);

  const [sendError, setSendError] = useState<Error>();
  const [receiveError, setReceiveError] = useState<Error>();

  const markets = useSelector((s: RootState) => s.tdex.markets);

  const getTradable = (asset: string) => getTradablesAssets(markets, asset);

  // auto update receive asset
  useEffect(() => {
    const tradableAssets = getTradable(sendAsset);
    if (!tradableAssets.includes(receiveAsset)) {
      setReceiveAsset(tradableAssets[0]);
    }
  }, [sendAsset]);

  // auto update send asset
  useEffect(() => {
    const tradableAssets = getTradable(receiveAsset);
    if (!tradableAssets.includes(sendAsset)) {
      setSendAsset(tradableAssets[0]);
    }
  }, [receiveAsset]);

  const discoverBestOrder = async (sats: number, asset: string): Promise<TradeOrder> => {
    const allPossibleOrders = computeOrders(markets, sendAsset, receiveAsset);
    const discoverer = createDiscoverer(allPossibleOrders);
    const bestOrders = await discoverer.discover({ asset, amount: sats });
    return bestOrders[0];
  };

  const setBestOrderPipe = (order: TradeOrder) => {
    setBestOrder(order);
    return order;
  };

  const updateReceiveSats = () => {
    setReceiveLoader(true);
    return discoverBestOrder(sendSats, sendAsset)
      .then(setBestOrderPipe) // set best order
      .then(calculatePrice(sendSats, sendAsset))
      .then((r: AssetSats) => setReceiveSats(r.sats))
      .catch(setReceiveError)
      .finally(() => setReceiveLoader(false));
  };

  const updateSendSats = () => {
    setSendLoader(true);
    return discoverBestOrder(receiveSats, receiveAsset)
      .then(setBestOrderPipe) // set best order
      .then(calculatePrice(receiveSats, receiveAsset))
      .then((r: AssetSats) => setSendSats(r.sats))
      .catch(setSendError)
      .finally(() => setSendLoader(false));
  };

  const resetError = () => {
    setSendError(undefined);
    setReceiveError(undefined);
  };

  // send sats setter
  // auto-update the receive sats amount according to best order
  const setSendAmount = async (sats: number) => {
    resetError();
    setSendSats(sats);
    await updateReceiveSats();
  };

  // receive sats setter
  // auto-update the send sats amount according to best order
  const setReceiveAmount = async (sats: number) => {
    resetError();
    setReceiveSats(sats);
    await updateSendSats();
  };

  return [
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
  ] as const;
}
