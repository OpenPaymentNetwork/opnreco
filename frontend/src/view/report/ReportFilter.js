import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReport } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { setAccountKey, setFileId } from '../../reducer/report';
import { withStyles } from '@material-ui/core/styles';
import FormControl from '@material-ui/core/FormControl';
import MenuItem from '@material-ui/core/MenuItem';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import Select from '@material-ui/core/Select';


const styles = theme => ({
  root: {
    [theme.breakpoints.up('lg')]: {
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
    },
  },
  controlBox: {
    padding: 16,
  },
  accountSelect: {
    [theme.breakpoints.up('lg')]: {
      minWidth: 400,
    },
  },
  fileSelect: {
  },
});

const accountsURL = fOPNReport.pathToURL('/accounts');


class ReportFilter extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    fileId: PropTypes.string,
    accountKey: PropTypes.string,
    accounts: PropTypes.object,
    accountOrder: PropTypes.array,
    loading: PropTypes.bool,
    loadError: PropTypes.bool,
    syncProgress: PropTypes.any,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
  }

  handleAccountChange(event) {
    this.props.dispatch(setAccountKey(event.target.value));
  }

  handleFileChange(event) {
    this.props.dispatch(setFileId(event.target.value));
  }

  renderAccountSelections() {
    const {
      accounts,
      accountOrder,
      loading,
      loadError,
      syncProgress,
    } = this.props;

    if (accountOrder && accountOrder.length) {
      return accountOrder.map(accountKey => {
        const account = accounts[accountKey];
        let targetType;
        if (account.target_id === 'c') {
          targetType = 'Circulation';
        } else if (account.target_is_dfi_account) {
          targetType = 'DFI Account';
        } else {
          targetType = 'Wallet';
        }
        return (
          <MenuItem value={accountKey} key={accountKey}>
            {account.target_title} ({targetType}) -
            {' '}{account.currency}
            {' '}{account.loop_id === '0' ? 'Open Loop' : account.loop_title}
          </MenuItem>
        );
      });

    } else {
      let errorMessage;
      if (loading) {
        errorMessage = <em>Loading accounts&hellip;</em>;
      } else if (loadError) {
        errorMessage = <em>Unable to load account list</em>;
      } else if (syncProgress !== null) {
        errorMessage = <em>Syncing&hellip;</em>;
      } else {
        errorMessage = <em>No accounts found for your profile</em>;
      }
      return [
        <MenuItem value="#error" key="#error">
          {errorMessage}
        </MenuItem>
      ];
    }
  }

  render() {
    const {
      classes,
      accountKey,
      fileId,
    } = this.props;

    const accountSelections = this.renderAccountSelections();

    return (
      <Paper className={classes.root}>
        <Require fetcher={fOPNReport} urls={[accountsURL]} />
        <div className={classes.controlBox}>
          <FormControl>
            <Select
              className={classes.mirrorSelect}
              value={accountKey || '#error'}
              onChange={this.binder(this.handleAccountChange)}
              inputProps={{
                id: 'filter-account',
              }}
            >
              {accountSelections}
            </Select>
          </FormControl>
        </div>
        <div className={classes.controlBox}>
          <FormControl>
            <Select
              className={classes.fileSelect}
              value={fileId || 'current'}
              onChange={this.binder(this.handleFileChange)}
              inputProps={{
                id: 'filter-file',
              }}
            >
              <MenuItem value="current">Current File</MenuItem>
              {/* TODO: list the files */}
            </Select>
          </FormControl>
        </div>
      </Paper>
    );
  }
}


function mapStateToProps(state) {
  const fetched = fetchcache.get(state, accountsURL) || {};
  const loading = fetchcache.fetching(state, accountsURL);
  const loadError = !!fetchcache.getError(state, accountsURL);
  return {
    accountsURL,
    accounts: fetched.accounts || {},
    accountOrder: fetched.account_order || [],
    loading,
    loadError,
    syncProgress: state.app.syncProgress,
  };
}


export default compose(
  withStyles(styles, {withTheme: true}),
  connect(mapStateToProps),
)(ReportFilter);
