import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReport } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import Hidden from '@material-ui/core/Hidden';
import LayoutConfig from '../app/LayoutConfig';
import PropTypes from 'prop-types';
import React from 'react';
import ReportFilter from '../report/ReportFilter';
import Tab from '@material-ui/core/Tab';
import TabContent from './TabContent';
import Tabs from '@material-ui/core/Tabs';


const styles = theme => ({
  root: {
  },
  topLine: {
    [theme.breakpoints.up('lg')]: {
      display: 'flex',
      alignItems: 'flex-end',
    },
    backgroundColor: theme.palette.primary.light,
    color: '#fff',
  },
  reportFilterBox: {
    padding: 16,
  },
  tabs: {
    flexGrow: '1',
  },
});


class Home extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    history: PropTypes.object.isRequired,
    match: PropTypes.object.isRequired,
    account: PropTypes.object,
    accountKey: PropTypes.string,
    file: PropTypes.object,
    fileId: PropTypes.string,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
  }

  handleTabChange(event, value) {
    this.props.history.push(`/${value}`);
  }

  render() {
    const {classes, match, account, accountKey, file, fileId} = this.props;

    const tab = match.params.tab || 'reco';

    const tabs = (
      <Tabs
        className={classes.tabs}
        value={tab}
        scrollable
        scrollButtons="auto"
        onChange={this.binder(this.handleTabChange)}
      >
        <Tab value="reco" label="Reconciliation" />
        <Tab value="transactions" label="Transactions" />
        <Tab value="liabilities" label="Liabilities" />
        <Tab value="t" label="Transfer Details" />
      </Tabs>
    );

    const filterBox = (
      <div className={classes.reportFilterBox}>
        <ReportFilter accountKey={accountKey} fileId={fileId} />
      </div>
    );

    return (
      <div className={classes.root}>
        <LayoutConfig title="OPN Reports" />

        <div className={classes.topLine}>

          <Hidden lgUp>
            {filterBox}
            {tabs}
          </Hidden>

          <Hidden mdDown>
            {tabs}
            {filterBox}
          </Hidden>

        </div>

        <TabContent tab={tab} account={account} file={file} />
      </div>
    );
  }
}

const accountsURL = fOPNReport.pathToURL('/accounts');


function mapStateToProps(state) {
  const {accountKey, fileId} = state.report;
  const fetched = fetchcache.get(state, accountsURL) || {};
  const accounts = fetched.accounts || {};
  const accountOrder = fetched.account_order;
  let selectedAccountKey = accountKey;

  if (accountOrder && accountOrder.length) {
    if (!selectedAccountKey || !accounts[selectedAccountKey]) {
      selectedAccountKey = fetched.default_account || '';
    }

    if (!selectedAccountKey) {
      selectedAccountKey = accountOrder[0];
    }
  } else {
    selectedAccountKey = '';
  }

  const account = selectedAccountKey ? accounts[selectedAccountKey] : null;

  let file = null;
  if (fileId && account && account.files) {
    file = account.files[fileId];
  }

  return {
    account,
    accountKey: account ? selectedAccountKey : null,
    file,
    fileId: file ? fileId : null,
  };
}


export default compose(
  withStyles(styles, {withTheme: true}),
  withRouter,
  connect(mapStateToProps),
)(Home);
