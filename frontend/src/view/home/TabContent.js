import { binder } from '../../util/binder';
import Button from '@material-ui/core/Button';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import RecoReport from '../report/RecoReport';
import Table from '@material-ui/core/Table';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import TransferSummary from '../report/TransferSummary';


export default class TabContent extends React.Component {
  static propTypes = {
    ploop: PropTypes.object,
    file: PropTypes.object,
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
    const {ploop, file, tab} = this.props;

    if (typeof console !== 'undefined') {
      console.error(
        'TabContent render error',
        {error, info, ploop, file, tab});
    }
    this.setState({errorTab: this.props.tab});
  }

  componentDidUpdate(prevProps) {
    if (this.state.errorTab && prevProps.tab !== this.props.tab) {
      // Clear the error.
      this.setState({errorTab: null});
    }
  }

  render() {
    const {errorTab} = this.state;
    if (errorTab && errorTab === this.props.tab) {
      return (
        <div style={{margin: 16, padding: 16}}>
          <Paper>
            Sorry, something went wrong while rendering this component.
            See the console for more info.
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

    const {ploop, file, tab} = this.props;
    switch(tab) {
    case 'reco':
      return <RecoReport ploop={ploop} file={file} />;
    case 'transactions':
      return this.renderTransactionsTab();
    case 'liabilities':
      return this.renderLiabilitiesTab();
    case 't':
      return <TransferSummary ploop={ploop} file={file} />;
    default:
      return null;
    }
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
