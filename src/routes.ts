import { IconExchange, IconSettings, IconWallet } from './components/icons';
import Account from './pages/Account';
import DeleteMnemonic from './pages/DeleteMnemonic';
import Deposit from './pages/Deposit';
import Faq from './pages/Faq';
import Privacy from './pages/Privacy';
import QRScanner from './pages/QRScanner';
import Receive from './pages/Receive';
import Settings from './pages/Settings';
import ShowMnemonicSettings from './pages/ShowMnemonic/show-mnemonic-settings';
import Terms from './pages/Terms';
import WithdrawalDetails from './pages/WithdrawalDetails';
import Backup from './redux/containers/backupContainer';
import Exchange from './redux/containers/exchangeContainer';
import TradeHistory from './redux/containers/exchangeHistoryContainer';
import LiquidityProviders from './redux/containers/liquidityProvidersContainer';
import Operations from './redux/containers/operationsContainer';
import ShowMnemonic from './redux/containers/showMnemonicContainer';
import TradeSummary from './redux/containers/tradeSummaryContainer';
import Wallet from './redux/containers/walletContainer';
import Withdrawal from './redux/containers/withdrawalContainer';

export const routerLinks = {
  wallet: '/wallet',
  exchange: '/exchange',
  settings: '/settings',
  tradeSummary: '/tradesummary/:txid',
  history: '/history',
  operations: '/operations/:asset_id',
  withdrawalDetails: '/withdraw/:txid/details',
  withdrawal: '/withdraw/:asset_id',
  receive: '/receive',
  qrScanner: '/qrscanner/:asset_id',
  account: '/account',
  liquidityProvider: '/liquidity-provider',
  faq: '/faq',
  privacy: '/privacy',
  terms: '/terms',
  backup: '/backup',
  showMnemonic: '/show-mnemonic',
  deposit: '/deposit',
  // Settings
  deleteMnemonic: '/settings/delete-mnemonic',
  showMnemonicSettings: '/settings/show-mnemonic',
};

export const ROUTES = [
  {
    path: routerLinks.faq,
    component: Faq,
  },
  {
    path: routerLinks.privacy,
    component: Privacy,
  },
  {
    path: routerLinks.terms,
    component: Terms,
  },
  {
    path: routerLinks.wallet,
    component: Wallet,
  },
  {
    path: routerLinks.exchange,
    component: Exchange,
  },
  {
    path: routerLinks.settings,
    component: Settings,
  },
  {
    path: routerLinks.history,
    component: TradeHistory,
  },
  {
    path: routerLinks.tradeSummary,
    component: TradeSummary,
  },
  {
    path: routerLinks.withdrawal,
    component: Withdrawal,
  },
  {
    path: routerLinks.receive,
    component: Receive,
  },
  {
    path: routerLinks.qrScanner,
    component: QRScanner,
  },
  {
    path: routerLinks.operations,
    component: Operations,
  },
  {
    path: routerLinks.withdrawalDetails,
    component: WithdrawalDetails,
  },
  {
    path: routerLinks.account,
    component: Account,
  },
  {
    path: routerLinks.liquidityProvider,
    component: LiquidityProviders,
  },
  {
    path: routerLinks.deposit,
    component: Deposit,
  },
  {
    path: routerLinks.backup,
    component: Backup,
  },
  {
    path: routerLinks.showMnemonic,
    component: ShowMnemonic,
  },
  {
    path: routerLinks.showMnemonicSettings,
    component: ShowMnemonicSettings,
  },
  {
    path: routerLinks.deleteMnemonic,
    component: DeleteMnemonic,
  },
];

export const TABS = [
  {
    name: 'wallet',
    path: routerLinks.wallet,
    icon: IconWallet,
    component: Wallet,
  },
  {
    name: 'exchange',
    path: routerLinks.exchange,
    icon: IconExchange,
    component: Exchange,
  },
  {
    name: 'settings',
    path: routerLinks.settings,
    icon: IconSettings,
    component: Settings,
  },
];
