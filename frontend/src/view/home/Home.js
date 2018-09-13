import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReport } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import Hidden from '@material-ui/core/Hidden';
import LayoutConfig from '../app/LayoutConfig';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import ReportFilter from '../report/ReportFilter';
import Tab from '@material-ui/core/Tab';
import Table from '@material-ui/core/Table';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
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
    isIssuer: PropTypes.bool.isRequired,
    match: PropTypes.object.isRequired,
    mirrorId: PropTypes.string,
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
    const {classes, match, isIssuer, mirrorId, fileId} = this.props;

    const tab = match.params.tab || 'reco';
    const tabContent = this.renderTabContent(tab);

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
        {isIssuer ? <Tab value="liabilities" label="Liabilities" /> : null}
      </Tabs>
    );

    const filterBox = (
      <div className={classes.reportFilterBox}>
        <ReportFilter mirrorId={mirrorId} fileId={fileId} />
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

        {tabContent}
      </div>
    );
  }

  renderTabContent(tab) {
    switch(tab) {
    case 'reco':
    default:
      return this.renderRecoTab();
    case 'transactions':
      return this.renderTransactionsTab();
    case 'liabilities':
      return this.renderLiabilitiesTab();
    }
  }

  renderRecoTab() {
    return (
      <div>
        Reconciliation
      </div>
    );
  }

  renderTransactionsTab() {
    return (
      <div>
        <Paper style={{overflow: 'hidden', padding: '0 8', margin: 16, minWidth: 290}}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell colSpan="7" style={{textAlign: 'center'}}>
                  <div>BCB FBO Transaction Report</div>
                  <div>1 June 2018 through 30 June 2018</div>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableHead>
              <TableRow>
                <TableCell colSpan="7" style={{textAlign: 'center'}}>
                  Deposits (increase account balance)
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan="2" style={{textAlign: 'center'}}>
                  Account Activity
                </TableCell>
                <TableCell colSpan="4" style={{textAlign: 'center'}}>
                  Wallet Activity
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Transfer</TableCell>
                <TableCell>Reconciled</TableCell>
              </TableRow>
            </TableHead>
          </Table>
        </Paper>
      </div>
    );
  }

  renderLiabilitiesTab() {
    return 'Liabilities!';
  }

}

const mirrorsAndFilesURL = fOPNReport.pathToURL('/mirrors-and-files');


function mapStateToProps(state) {
  const {mirrorId, fileId} = state.report;
  const mirrorsAndFiles = fetchcache.get(state, mirrorsAndFilesURL) || {};
  const mirrors = mirrorsAndFiles.mirrors || {};
  const mirrorOrder = mirrorsAndFiles.mirror_order;
  let selectedMirrorId = mirrorId;

  if (mirrorOrder && mirrorOrder.length) {
    if (!selectedMirrorId || !mirrors[selectedMirrorId]) {
      selectedMirrorId = mirrorsAndFiles.default_mirror || '';
    }

    if (!selectedMirrorId) {
      selectedMirrorId = mirrorOrder[0];
    }
  } else {
    selectedMirrorId = '';
  }

  const isIssuer = !!(
    selectedMirrorId &&
    mirrors[selectedMirrorId] &&
    mirrors[selectedMirrorId].target_id === 'c');

  return {
    isIssuer,
    mirrorId: selectedMirrorId,
    fileId,
  };
}


export default compose(
  withStyles(styles, {withTheme: true}),
  withRouter,
  connect(mapStateToProps),
)(Home);
