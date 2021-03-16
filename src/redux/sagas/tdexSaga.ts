import { SIGN_IN } from './../actions/appActions';
import {
  addProvider,
  clearMarkets,
  DELETE_PROVIDER,
} from './../actions/tdexActions';
import { TDEXState } from '../reducers/tdexReducer';
import {
  addMarkets,
  ADD_PROVIDER,
  UPDATE_MARKETS,
} from '../actions/tdexActions';
import { put, takeLatest, select, call, delay } from 'redux-saga/effects';
import { TDEXMarket, TDEXProvider } from '../actionTypes/tdexActionTypes';
import { TraderClient, MarketInterface } from 'tdex-sdk';
import { addErrorToast } from '../actions/toastActions';
import {
  getProvidersFromStorage,
  setProvidersInStorage,
} from '../../utils/storage-helper';
import { getProvidersFromTDexRegistry } from '../../utils/tdex';
import { provider } from '../config';

function* updateMarketsWithProvidersEndpoints() {
  const providers: TDEXProvider[] = yield select(
    ({ tdex }: { tdex: TDEXState }) => tdex.providers
  );

  const newMarkets: TDEXMarket[] = [];
  for (const p of providers) {
    try {
      const markets: TDEXMarket[] = yield call(getMarketsFromProvider, p);

      newMarkets.push(...markets);
    } catch (e) {
      yield put(addErrorToast(e.message || e));
    }
  }

  yield put(clearMarkets());
  yield put(addMarkets(newMarkets));
}

function* fetchMarkets({
  type,
  payload,
}: {
  type: string;
  payload: TDEXProvider;
}) {
  try {
    const markets = yield call(getMarketsFromProvider, payload);
    if (markets.length > 0) {
      yield put(addMarkets(markets));
    }
  } catch (e) {
    yield put(addErrorToast(e.message || e));
  }
}

function* restoreProviders() {
  try {
    // restore the providers from storage
    const providers: TDEXProvider[] = yield call(getProvidersFromStorage);
    for (const p of providers) {
      yield put(addProvider(p));
    }

    // fetch from registry if no providers found
    if (providers.length <= 0) {
      try {
        const providersFromRegistry: TDEXProvider[] = yield call(
          getProvidersFromTDexRegistry
        );
        for (const p of providersFromRegistry) {
          yield put(addProvider(p));
        }
      } catch (e) {
        // if an error happen, add the default provider (depends on config)
        console.error(e);
        yield put(addErrorToast('Unable to fetch providers from registry'));
        yield put(
          addProvider({ name: 'Default provider', endpoint: provider.endpoint })
        );
      }
    }
  } catch (e) {
    console.error(e);
    yield put(addErrorToast(e));
  }
}

function* persistProviders() {
  yield delay(2000);
  const providers: TDEXProvider[] = yield select(
    ({ tdex }: { tdex: TDEXState }) => tdex.providers
  );
  yield call(setProvidersInStorage, providers);
}

export function* tdexWatcherSaga() {
  yield takeLatest(ADD_PROVIDER, persistProviders);
  yield takeLatest(DELETE_PROVIDER, persistProviders);
  yield takeLatest(ADD_PROVIDER, fetchMarkets);
  yield takeLatest(UPDATE_MARKETS, updateMarketsWithProvidersEndpoints);
  yield takeLatest(SIGN_IN, restoreProviders);
}

async function getMarketsFromProvider(p: TDEXProvider): Promise<TDEXMarket[]> {
  const client = new TraderClient(p.endpoint);
  const markets: MarketInterface[] = await client.markets();

  return markets.map((market) => ({ ...market, provider: p }));
}