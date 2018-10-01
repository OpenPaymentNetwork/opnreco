import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReport } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { withStyles } from '@material-ui/core/styles';
import { getCurrencyFormatter } from '../../util/currency';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';


const styles = {
  root: {
    fontSize: '1.1rem',
  },
  formPaper: {
    margin: '32px auto',
    maxWidth: 800,
    textAlign: 'center',
  },
  formButton: {
    margin: '16px',
  },
  transferIdField: {
    margin: '16px',
  },
  tablePaper: {
    margin: '32px auto',
    maxWidth: 800,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    color: '#000',
  },
  cell: {
    border: '1px solid #bbb',
  },
};


class TransferDetail extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    recordURL: PropTypes.string,
    record: PropTypes.object,
    loading: PropTypes.bool,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
    this.state = {typingTransferId: ''};
  }

  renderForm() {
    const {classes} = this.props;
    return (
      <div>
        <Paper className={classes.formPaper}>
          <TextField
            id="transfer-id-input"
            label="Transfer ID"
            className={classes.transferIdField}
            value={this.state.typingTransferId}
            onChange={this.binder(this.handleTransferIdChange)}
          />
          <Button className={classes.formButton} variant="outlined">
            Go
          </Button>
        </Paper>
        <div style={{height: 1}}></div>
      </div>
    );
  }

  handleTransferIdChange() {
  }

  render() {
    const form = this.renderForm();

    const {classes, recordURL, record, loading} = this.props;
    if (!recordURL) {
      // No account selected.
      return form;
    }

    const require = <Require fetcher={fOPNReport} urls={[recordURL]} />;

    if (!record) {
      if (loading) {
        return (
          <div className={classes.root}>
            {require}
            {form}
            <CircularProgress margin="16px" />
          </div>);
      }
      return <div className={classes.root}>{require}</div>;
    }

    return (
      <Typography className={classes.root} component="div">
        {require}
        {form}
        <Paper className={classes.tablePaper}>
          <table className={classes.table}>
            <thead>
              <tr>
                <th className={`${classes.cell} ${classes.headCell}`} colSpan="2">
                  Transfer
                  {' in file '}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
              </tr>
            </tbody>
          </table>
        </Paper>
        <div style={{height: 1}}></div>
      </Typography>
    );
  }

}

function mapStateToProps(state, ownProps) {
  const transferId = state.app.transferId;
  const {account, file} = ownProps;
  if (account && transferId) {
    const recordURL = fOPNReport.pathToURL(
      `/transfer-record/${account.target_id}/${account.loop_id}/` +
      `${account.currency}/${file ? file.id : 'current'}/${transferId}`);
    const record = fetchcache.get(state, recordURL);
    const loading = fetchcache.fetching(state, recordURL);
    const loadError = !!fetchcache.getError(state, recordURL);
    return {
      transferId,
      recordURL,
      record,
      loading,
      loadError,
    };
  } else {
    return {};
  }
}


export default compose(
  withStyles(styles),
  connect(mapStateToProps),
)(TransferDetail);
