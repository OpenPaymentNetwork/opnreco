
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import LayoutConfig from '../app/LayoutConfig';
import MenuItem from '@material-ui/core/MenuItem';
import PropTypes from 'prop-types';
import React from 'react';
import Select from '@material-ui/core/Select';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';
import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';


const styles = {
  filterContainer: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  filterControlBox: {
    padding: '8px 16px',
  },
};


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
    const {match} = this.props;

    const filterControls = this.renderFilterControls();

    const tab = match.params.tab || 'reco';
    const tabContent = this.renderTabContent(tab);

    return (
      <div>
        <LayoutConfig title="OPN Reports" />

        {filterControls}

        <Tabs
          indicatorColor="primary"
          textColor="primary"
          value={tab}
          scrollable
          scrollButtons="auto"
          onChange={this.binder('handleTabChange')}
        >
          <Tab value="reco" label="Reconciliation" />
          <Tab value="transactions" label="Transactions" />
          <Tab value="liabilities" label="Liabilities" />
        </Tabs>

        {tabContent}
      </div>
    );
  }

  renderFilterControls() {
    const {classes} = this.props;
    return (
      <div className={classes.filterContainer}>
        <div className={classes.filterControlBox}>
          Account
        </div>
        <div className={classes.filterControlBox}>
          Design
        </div>
        <div className={classes.filterControlBox}>
          Currency
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
    return 'Reco!';
  }

  renderTransactionsTab() {
    return 'Transactions!';
  }

  renderLiabilitiesTab() {
    return 'Liabilities!';
  }

}

export default compose(
  withStyles(styles),
  withRouter,
)(Home);
