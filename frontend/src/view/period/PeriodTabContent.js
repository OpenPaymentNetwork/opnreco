
import Button from '@material-ui/core/Button';
import InternalRecoReport from '../report/InternalRecoReport';
import PeriodOverview from './PeriodOverview';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import RecoReport from '../report/RecoReport';
import StatementView from '../statement/StatementView';
import TransactionReport from '../report/TransactionReport';
import TransferSummary from '../report/TransferSummary';


export default class PeriodTabContent extends React.Component {
  static propTypes = {
    file: PropTypes.object,
    period: PropTypes.object,
    tab: PropTypes.string,
  };

  constructor(props) {
    super(props);
    this.state = {
      errorTab: null,
    };
  }

  componentDidCatch(error, info) {
    /* eslint {"no-console": 0} */
    const { file, period, tab } = this.props;

    if (typeof console !== 'undefined') {
      console.error(
        'PeriodTabContent render error',
        { error, info, file, period, tab });
    }
    this.setState({ errorTab: this.props.tab });
  }

  componentDidUpdate(prevProps) {
    if (this.state.errorTab && prevProps.tab !== this.props.tab) {
      // Clear the error.
      this.setState({ errorTab: null });
    }
  }

  handleTryAgain = () => {
    this.setState({ errorTab: null });
  };

  render() {
    const { errorTab } = this.state;
    if (errorTab && errorTab === this.props.tab) {
      return (
        <div style={{ margin: 16 }}>
          <Paper style={{ padding: 16 }}>
            Sorry, something went wrong while rendering this component.
            See the developer console for more info.
            <p>
              <Button variant="outlined"
                onClick={this.handleTryAgain}
              >
                Try Again
              </Button>
            </p>
          </Paper>
        </div>
      );
    }

    const { file, period, tab } = this.props;
    switch (tab) {
      case 'reco':
        return <RecoReport file={file} period={period} />;
      case 'transactions':
        return <TransactionReport file={file} period={period} />;
      case 't':
        return <TransferSummary file={file} period={period} />;
      case 'overview':
        return <PeriodOverview file={file} period={period} />;
      case 'statement':
        return <StatementView file={file} period={period} />;
      case 'internal':
        return <InternalRecoReport file={file} period={period} />;
      default:
        return null;
    }
  }
}
