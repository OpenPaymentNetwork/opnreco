
import LayoutConfig from '../app/LayoutConfig';
import PropTypes from 'prop-types';
import React from 'react';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';
import { binder } from '../../util/binder';
import { withRouter } from 'react-router';


class Home extends React.Component {
  static propTypes = {
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
    const tab = match.params.tab || 'reco';
    const tabContent = this.renderTabContent(tab);

    return (
      <div>
        <LayoutConfig title="OPN Reports" />

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

export default withRouter(Home);
