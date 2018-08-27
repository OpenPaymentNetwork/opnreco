
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
    padding: '0 8',
    margin: 16,
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

    const filterControls = this.renderFilterControls();

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

          {filterControls}
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
            <InputLabel htmlFor="filter-account">Account</InputLabel>
            <Select
              value="c"
              inputProps={{
                id: 'filter-account',
              }}
            >
              <MenuItem value="c">Circulation</MenuItem>
              <MenuItem value="201">XXXX35 at Zions Bank</MenuItem>
              <MenuItem value="all">All</MenuItem>
            </Select>
          </FormControl>
        </div>
        <div className={classes.filterControlBox}>
          <FormControl>
            <InputLabel htmlFor="filter-loop">Cash design</InputLabel>
            <Select
              value="0"
              inputProps={{
                id: 'filter-loop',
              }}
            >
              <MenuItem value="0">Open loop</MenuItem>
              <MenuItem value="42">Magrathean Cash</MenuItem>
              <MenuItem value="all">All</MenuItem>
            </Select>
          </FormControl>
        </div>
        <div className={classes.filterControlBox}>
          <FormControl>
            <InputLabel htmlFor="filter-currency">Currency</InputLabel>
            <Select
              value="USD"
              inputProps={{
                id: 'filter-currency',
              }}
            >
              <MenuItem value="USD">USD</MenuItem>
              <MenuItem value="MXN">MXN</MenuItem>
              <MenuItem value="all">All</MenuItem>
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
    return null; //'Reco!';
  }

  renderTransactionsTab() {
    return 'Transactions!';
  }

  renderLiabilitiesTab() {
    return 'Liabilities!';
  }

}

export default compose(
  withStyles(styles, {withTheme: true}),
  withRouter,
)(Home);
