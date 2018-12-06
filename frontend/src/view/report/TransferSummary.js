import { FormattedDate, FormattedTime, FormattedRelative } from 'react-intl';
import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReco } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { getCurrencyFormatter } from '../../util/currency';
import { setTransferId } from '../../reducer/app';
import { wfTypeTitles } from '../../util/transferfmt';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import CancelIcon from '@material-ui/icons/Cancel';
import CircularProgress from '@material-ui/core/CircularProgress';
import IconButton from '@material-ui/core/IconButton';
import LayoutConfig from '../app/LayoutConfig';
import Paper from '@material-ui/core/Paper';
import ProfileLink from './ProfileLink';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import SearchIcon from '@material-ui/icons/Search';
import TextField from '@material-ui/core/TextField';
import TransferMovementTable from './TransferMovementTable';
import Typography from '@material-ui/core/Typography';


const solidBorder = '1px solid #bbb';
const tableWidth = 1600;

const styles = {
  root: {
    fontSize: '0.9rem',
    padding: '0 16px',
  },
  searchIconBox: {
    margin: '0 auto',
    maxWidth: tableWidth,
    textAlign: 'right',
  },
  cancelButton: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  formPaper: {
    margin: '16px auto',
    maxWidth: tableWidth,
    textAlign: 'center',
    position: 'relative',
  },
  formButton: {
    margin: '16px',
  },
  headCell: {
    padding: '4px 8px',
    backgroundColor: '#ddd',
    textAlign: 'left',
  },
  transferIdField: {
    margin: '16px',
  },
  tablePaper: {
    margin: '0 auto 16px auto',
    maxWidth: tableWidth,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    color: '#000',
  },
  cell: {
    border: solidBorder,
  },
  fieldNameCell: {
    padding: '2px 8px',
    width: '0%',
  },
  fieldValueCell: {
    padding: '2px 8px',
    width: '100%',
  },
  detailButton: {
    margin: '8px',
  },
};


/* global process: false */
const publicURL = process.env.REACT_APP_OPN_PUBLIC_URL;


class TransferSummary extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    profileId: PropTypes.string.isRequired,
    recordURL: PropTypes.string,
    record: PropTypes.object,
    recordFinalURL: PropTypes.string,
    loading: PropTypes.bool,
    loadError: PropTypes.any,
    transferId: PropTypes.string,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
    this.state = {
      showSearch: props.transferId ? false : true,
      typingTransferId: '',
    };
  }

  componentDidMount() {
    const {transferId} = this.props;
    if (transferId) {
      this.props.dispatch(setTransferId(transferId));
    }
  }

  handleShowSearch() {
    this.setState({showSearch: true});
  }

  handleHideSearch() {
    this.setState({showSearch: false});
  }

  handleKeyDown(event) {
    if (event.key === 'Enter') {
      this.handleTransferIdSubmit();
    }
  }

  handleTransferIdChange(event) {
    // Allow only numbers and dashes.
    const {value} = event.target;
    const re = /[0-9-]+/g;
    const text = [];
    for(;;) {
      const match = re.exec(value);
      if (!match) {
        break;
      }
      text.push(match[0]);
    }
    this.setState({typingTransferId: text.join('')});
  }

  handleTransferIdSubmit() {
    const transferId = this.state.typingTransferId;
    if (transferId) {
      this.props.dispatch(setTransferId(transferId));
      this.props.history.push(`/t/${transferId}`);
    }
  }

  renderForm() {
    const {classes} = this.props;
    const {showSearch, typingTransferId} = this.state;

    if (!showSearch) {
      return (
        <div className={classes.searchIconBox}>
          <IconButton onClick={this.binder(this.handleShowSearch)}>
            <SearchIcon/>
          </IconButton>
        </div>
      );
    }

    return (
      <div>
        <Paper className={classes.formPaper}>
          <IconButton className={classes.cancelButton}
            onClick={this.binder(this.handleHideSearch)}
          >
            <CancelIcon />
          </IconButton>
          <TextField
            id="transfer-id-input"
            label="Transfer ID"
            className={classes.transferIdField}
            value={typingTransferId}
            onChange={this.binder(this.handleTransferIdChange)}
            onKeyDown={this.binder(this.handleKeyDown)}
          />
          <Button
            className={classes.formButton}
            variant="outlined"
            onClick={this.binder(this.handleTransferIdSubmit)}
            disabled={!typingTransferId}
          >
            Go
          </Button>
        </Paper>
        <div style={{height: 1}}></div>
      </div>
    );
  }

  renderSummaryTable() {
    const {
      classes,
      record,
      profileId,
      transferId,
    } = this.props;

    const fieldNameCell = `${classes.cell} ${classes.fieldNameCell}`;
    const fieldValueCell = `${classes.cell} ${classes.fieldValueCell}`;
    const transferURL = `${publicURL}/p/${profileId}/t/${transferId}`;

    return (
      <div>
        <table className={classes.table}>
          <thead>
            <tr>
              <th className={`${classes.cell} ${classes.headCell}`}
                colSpan="2"
              >
                Transfer {transferId}{' '}
                <Button href={transferURL}
                  variant="outlined"
                  className={classes.detailButton}
                  target="_blank" rel="noopener noreferrer"
                >
                  View Details
                </Button>

              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={fieldNameCell}>
                Type
              </td>
              <td className={fieldValueCell}>
                {wfTypeTitles[record.workflow_type] || record.workflow_type}
              </td>
            </tr>
            <tr>
              <td className={fieldNameCell}>
                Start
              </td>
              <td className={fieldValueCell} title={record.start}>
                <FormattedDate value={record.start}
                  day="numeric" month="short" year="numeric" />
                {' '}
                <FormattedTime value={record.start}
                  hour="numeric" minute="2-digit" second="2-digit" />
                {' '}
                (<FormattedRelative value={record.start} />)
              </td>
            </tr>
            <tr>
              <td className={fieldNameCell}>
                Status
              </td>
              <td className={fieldValueCell}>
                {record.canceled ? 'Canceled' :
                  (record.completed ? 'Completed' : 'Waiting')}
              </td>
            </tr>
            <tr>
              <td className={fieldNameCell}>
                Amount
              </td>
              <td className={fieldValueCell}>
                {getCurrencyFormatter(record.currency)(record.amount)
                } {record.currency}
              </td>
            </tr>
            <tr>
              <td className={fieldNameCell}>
                Sender
              </td>
              <td className={fieldValueCell}>
                <ProfileLink id={record.sender_id}
                  title={record.sender_title}
                  profiles={record.peers} />
              </td>
            </tr>
            <tr>
              <td className={fieldNameCell}>
                Recipient
              </td>
              <td className={fieldValueCell}>
                <ProfileLink id={record.recipient_id}
                  title={record.recipient_title}
                  profiles={record.peers} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  render() {
    const form = this.renderForm();

    const {
      classes,
      recordURL,
      record,
      recordFinalURL,
      loading,
      loadError,
      transferId,
    } = this.props;

    if (!recordURL) {
      // No transfer ID selected.
      return (
        <div className={classes.root}>
          <LayoutConfig title="Transfer Summary" />
          {form}
        </div>
      );
    }

    const require = (
      <Require fetcher={fOPNReco}
        urls={[recordURL]}
        options={{
          // If there's an error, this component will show it. Don't
          // pop up a dialog.
          suppressServerError: true,
          finalURL: recordFinalURL,
        }} />);

    let content;

    if (!record) {
      let paperContent;
      if (loading) {
        paperContent = (
          <div style={{textAlign: 'center'}}>
            <CircularProgress style={{padding: '16px'}} />
          </div>);
      } else if (loadError) {
        paperContent = (
          <div style={{padding: '16px'}}>
            <p>{loadError}</p>
          </div>);
      } else {
        paperContent = (
          <div style={{padding: '16px'}}>
            Unable to retrieve transfer {transferId}
          </div>);
      }
      content = (
        <Paper className={classes.tablePaper}>
          {paperContent}
        </Paper>
      );
    } else {
      content = (
        <div>
          <Paper className={classes.tablePaper}>
            {this.renderSummaryTable()}
          </Paper>
          <Paper className={classes.tablePaper}>
            <TransferMovementTable record={record} />
          </Paper>
        </div>
      );
    }

    return (
      <Typography className={classes.root} component="div">
        <LayoutConfig title={`Transfer ${transferId} Summary`} />
        {require}
        {form}
        {content}
        <div style={{height: 1}}></div>
      </Typography>
    );
  }

}

function mapStateToProps(state, ownProps) {
  const {ploop, period, match} = ownProps;
  const transferId = match.params.transferId;
  const profileId = state.login.id;

  if (ploop && transferId) {
    const query = (
      `ploop_key=${encodeURIComponent(ploop.ploop_key)}` +
      `&period_id=${encodeURIComponent(period ? period.period_id : 'current')}` +
      `&transfer_id=${encodeURIComponent(transferId)}`);
    const recordURL = fOPNReco.pathToURL(`/transfer-record?${query}`);
    const recordFinalURL = fOPNReco.pathToURL(
      `/transfer-record-final?${query}`);
    let record = fetchcache.get(state, recordURL);
    const loading = fetchcache.fetching(state, recordURL);
    const loadError = fetchcache.getError(state, recordURL);

    return {
      profileId,
      transferId,
      recordURL,
      record,
      recordFinalURL,
      loading,
      loadError,
    };
  } else {
    return {
      profileId,
      transferId,
    };
  }
}


export default compose(
  withStyles(styles),
  withRouter,
  connect(mapStateToProps),
)(TransferSummary);
