
import LayoutConfig from '../app/LayoutConfig';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';
import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import Table from '@material-ui/core/Table';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import ReportFilter from '../report/ReportFilter';
import Hidden from '@material-ui/core/Hidden';


const styles = theme => ({
  homeMain: {
    position: 'relative',
  },
  topLine: {
    [theme.breakpoints.up('md')]: {
      display: 'flex',
    },
    alignItems: 'flex-end',
    backgroundColor: theme.palette.primary.light,
    color: '#fff',
  },
  reportFilter: {
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
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
  }

  handleTabChange(event, value) {
    this.props.history.push(`/${value}`);
  }

  render() {
    const {classes, match} = this.props;

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
        <Tab value="liabilities" label="Liabilities" />
      </Tabs>
    );

    const filterBox = (
      <div className={classes.reportFilter}>
        <ReportFilter />
      </div>
    );

    return (
      <div className={classes.homeMain}>
        <LayoutConfig title="OPN Reports" />

        <div className={classes.topLine}>

          <Hidden mdUp>
            {filterBox}
            {tabs}
          </Hidden>

          <Hidden smDown>
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

export default compose(
  withStyles(styles, {withTheme: true}),
  withRouter,
)(Home);
