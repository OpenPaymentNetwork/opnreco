
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import LayoutConfig from '../app/LayoutConfig';
import MenuItem from '@material-ui/core/MenuItem';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Select from '@material-ui/core/Select';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';
import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';


const styles = theme => ({
  homeMain: {
    position: 'relative',
  },
  topLine: {
    display: 'flex',
    alignItems: 'flex-end',
    backgroundColor: theme.palette.primary.light,
    color: '#fff',
  },
  filterContainer: {
    display: 'flex',
    float: 'right',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    flexWrap: 'wrap-reverse',
    padding: '0 8px',
    margin: '0 16px 16px 16px',
  },
  filterControlBox: {
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

    return (
      <div className={classes.homeMain}>
        <LayoutConfig title="OPN Reports" />

        <div className={classes.topLine}>
          <Tabs
            className={classes.tabs}
            value={tab}
            scrollable
            scrollButtons="auto"
            onChange={this.binder('handleTabChange')}
          >
            <Tab value="reco" label="Reconciliation" />
            <Tab value="transactions" label="Transactions" />
            <Tab value="liabilities" label="Liabilities" />
          </Tabs>

        </div>

        {tabContent}
      </div>
    );
  }

  renderFilterControls() {
    const {classes} = this.props;
    return (
      <Paper className={classes.filterContainer}>
        <div className={classes.filterControlBox}>
          <FormControl>
            <InputLabel htmlFor="filter-mirror">Reconciliation Target</InputLabel>
            <Select
              value="c"
              inputProps={{
                id: 'filter-mirror',
              }}
            >
              <MenuItem value="c">BCB FBO Circulation: USD Open Loop</MenuItem>
              <MenuItem value="201">Zions Bank: USD Open Loop</MenuItem>
              <MenuItem value="203">RevCash Store: MXN Pokecash</MenuItem>
            </Select>
          </FormControl>
        </div>
        <div className={classes.filterControlBox}>
          <FormControl>
            <InputLabel htmlFor="filter-date">Date range</InputLabel>
            <Select
              value="2018-06-01--2018-06-30"
              inputProps={{
                id: 'filter-date',
              }}
            >
              <MenuItem value="2018-06-01--2018-06-30">June 2018</MenuItem>
              <MenuItem value="2018-07-01--2018-07-31">July 2018</MenuItem>
              <MenuItem value="2018-08-01--2018-08-31">August 2018</MenuItem>
              <MenuItem value="custom">Custom Range&hellip;</MenuItem>
            </Select>
          </FormControl>
        </div>
      </Paper>
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
    const filterControls = this.renderFilterControls();

    return (
      <div>
        {filterControls}

        Reconciliation
      </div>
    );
  }

  renderTransactionsTab() {
    const filterControls = this.renderFilterControls();

    return (
      <div>
        {filterControls}

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
