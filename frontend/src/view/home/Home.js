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
    transferId: PropTypes.string,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
  }

  handleTabChange(event, value) {
    if (value === 't' && this.props.transferId) {
      this.props.history.push(`/${value}/${this.props.transferId}`);
    } else {
      this.props.history.push(`/${value}`);
    }
  }

  handleTabClick(event) {
    event.preventDefault();
  }

  render() {
    const {
      classes,
      match,
      account,
      accountKey,
      file,
      fileId,
      transferId,
    } = this.props;

    const tab = match.params.tab || 'reco';

    const transferPath = transferId ? `/t/${transferId}` : '/t';
    const tabs = (
      <Tabs
        className={classes.tabs}
        value={tab}
        scrollable
        scrollButtons="auto"
        onChange={this.binder(this.handleTabChange)}
      >
        <Tab value="reco" label="Reconciliation" href="/reco"
          onClick={this.binder(this.handleTabClick)} />
        <Tab value="transactions" label="Transactions" href="/transactions"
          onClick={this.binder(this.handleTabClick)} />
        <Tab value="liabilities" label="Liabilities" href="/liabilities"
          onClick={this.binder(this.handleTabClick)} />
        <Tab value="t" label="Transfer Summary" href={transferPath}
          onClick={this.binder(this.handleTabClick)} />
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
    transferId: state.app.transferId,
  };
}


export default compose(
  withStyles(styles, {withTheme: true}),
  withRouter,
  connect(mapStateToProps),
)(Home);
