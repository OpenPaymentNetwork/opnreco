
import { binder } from '../../util/binder';
import Button from '@material-ui/core/Button';
import PeriodOverview from './PeriodOverview';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import RecoReport from '../report/RecoReport';
import StatementView from './StatementView';
import TransactionReport from '../report/TransactionReport';
import TransferSummary from '../report/TransferSummary';


export default class TabContent extends React.Component {
  static propTypes = {
    ploop: PropTypes.object,
    period: PropTypes.object,
    tab: PropTypes.string,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
    this.state = {
      errorTab: null,
    };
  }

  componentDidCatch(error, info) {
    /* eslint {"no-console": 0} */
    const {ploop, period, tab} = this.props;

    if (typeof console !== 'undefined') {
      console.error(
        'TabContent render error',
        {error, info, ploop, period, tab});
    }
    this.setState({errorTab: this.props.tab});
  }

  componentDidUpdate(prevProps) {
    if (this.state.errorTab && prevProps.tab !== this.props.tab) {
      // Clear the error.
      this.setState({errorTab: null});
    }
  }

  handleTryAgain() {
    this.setState({errorTab: null});
  }

  render() {
    const {errorTab} = this.state;
    if (errorTab && errorTab === this.props.tab) {
      return (
        <div style={{margin: 16}}>
          <Paper style={{padding: 16}}>
            Sorry, something went wrong while rendering this component.
            See the developer console for more info.
            <p>
              <Button variant="outlined"
                onClick={this.binder(this.handleTryAgain)}
              >
                Try Again
              </Button>
            </p>
          </Paper>
        </div>
      );
    }

    const {ploop, period, tab} = this.props;
    switch(tab) {
    case 'reco':
      return <RecoReport ploop={ploop} period={period} />;
    case 'transactions':
      return <TransactionReport ploop={ploop} period={period} />;
    case 'liabilities':
      return this.renderLiabilitiesTab();
    case 't':
      return <TransferSummary ploop={ploop} period={period} />;
    case 'overview':
      return <PeriodOverview ploop={ploop} period={period} />;
    case 'statement':
      return <StatementView ploop={ploop} period={period} />;
    default:
      return null;
    }
  }

  renderLiabilitiesTab() {
    return 'Liabilities!';
  }
}
