import { connect } from 'react-redux';

import RestoreWallet from '../../pages/RestoreWallet';
import { setSeedBackupFlag } from '../../utils/storage-helper';
import { setIsBackupDone } from '../actions/appActions';
import type { RootState } from '../store';

const mapStateToProps = (state: RootState) => {
  return {
    backupDone: state.app.backupDone,
  };
};

const mapDispatchToProps = (dispatch: any) => {
  return {
    setIsBackupDone: (done: boolean) => {
      setSeedBackupFlag(done);
      dispatch(setIsBackupDone(done));
    },
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(RestoreWallet);
