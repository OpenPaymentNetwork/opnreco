import { FormattedDate, FormattedTime, FormattedRelative } from 'react-intl';
import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReport } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { getCurrencyFormatter, getCurrencyDeltaFormatter }
  from '../../util/currency';
import { setTransferId } from '../../reducer/app';
import { wfTypeTitles } from '../../util/transferfmt';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import CancelIcon from '@material-ui/icons/Cancel';
import CircularProgress from '@material-ui/core/CircularProgress';
import IconButton from '@material-ui/core/IconButton';
import MovementTable from './MovementTable';
import Paper from '@material-ui/core/Paper';
import ProfileLink from './ProfileLink';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import SearchIcon from '@material-ui/icons/Search';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import CheckBoxIcon from '@material-ui/icons/CheckBox';
import CheckBoxOutlineBlankIcon
  from '@material-ui/icons/CheckBoxOutlineBlank';


const solidBorder = '1px solid #bbb';
const tableWidth = 1600;

const styles = {
  root: {
    fontSize: '1.0rem',
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
    fontWeight: 'normal',
    backgroundColor: '#ddd',
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
  },
  fieldValueCell: {
    padding: '2px 8px',
  },
  detailButton: {
    margin: '8px',
  },
  labelCell: {
    border: solidBorder,
    padding: '2px 8px',
  },
  numberCell: {
    padding: '2px 8px',
    textAlign: 'right',
  },
  textCell: {
    padding: '2px 8px',
  },
  checkCell: {
    textAlign: 'center',
    paddingTop: '4px',
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
    recordCompleteURL: PropTypes.string,
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
              <td className={fieldValueCell}>
                <FormattedDate value={record.start} />
                {' '}
                <FormattedTime value={record.start} />
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

  renderExchangesTable() {
    const {
      classes,
      record,
    } = this.props;

    const {
      cell,
      labelCell,
      numberCell,
      textCell,
      checkCell,
    } = classes;

    const {
      loops,
    } = record;

    const numCell = `${cell} ${numberCell}`;
    const txtCell = `${cell} ${textCell}`;
    const chkCell = `${cell} ${checkCell}`;

    let rows = record.exchanges.forEach((exchange, exchangeIndex) => {
      const {
        loop_id,
        reco_id,
      } = exchange;
      let loopTitle;
      if (loop_id === '0') {
        loopTitle = 'Open Loop';
      } else {
        loopTitle = (
          <em>{loops[loop_id] ? loops[loop_id].title
            : `Closed Loop ${loop_id}`}</em>);
      }

      let recoContent;
      if (reco_id !== null) {
        recoContent = <CheckBoxIcon />;
      } else {
        recoContent = <CheckBoxOutlineBlankIcon />;
      }

      return (
        <tr key={exchangeIndex}>
          <td className={numCell}>
            {getCurrencyDeltaFormatter(exchange.currency)(exchange.vault_amount)
            } {exchange.currency}
          </td>
          <td className={numCell}>
            {getCurrencyDeltaFormatter(exchange.currency)(exchange.wallet_amount)
            } {exchange.currency}
          </td>
          <td className={txtCell}>
            {loopTitle}
          </td>
          <td className={chkCell}>
            {recoContent}
          </td>
        </tr>);
    });

    if (!rows || !rows.length) {
      rows = [
        <tr key="empty">
          <td colSpan="4" className={labelCell}>
            <em>No vault/wallet exchanges detected in this transfer.</em>
          </td>
        </tr>
      ];
    }

    return (
      <table className={classes.table}>
        <thead>
          <tr>
            <th className={`${classes.cell} ${classes.headCell}`}
              colSpan="4"
            >
              Exchanges
            </th>
          </tr>
          <tr>
            <td className={labelCell}>Vault</td>
            <td className={labelCell}>Wallet</td>
            <td className={labelCell}>Note Design</td>
            <td className={labelCell}>Reconciled</td>
          </tr>
        </thead>
        <tbody>
          {rows}
        </tbody>
      </table>);
  }

  render() {
    const form = this.renderForm();

    const {
      classes,
      recordURL,
      record,
      recordCompleteURL,
      loading,
      loadError,
      transferId,
    } = this.props;

    if (!recordURL) {
      // No transfer ID selected.
      return (
        <div className={classes.root}>
          {form}
        </div>
      );
    }

    const requireURLs = [recordURL];
    if (recordCompleteURL) {
      requireURLs.push(recordCompleteURL);
    }
    const require = (
      <Require fetcher={fOPNReport}
        urls={requireURLs}
        options={{suppressServerError: true}} />);

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
            <MovementTable record={record} />
          </Paper>
          <Paper className={classes.tablePaper}>
            {this.renderExchangesTable()}
          </Paper>
        </div>
      );
    }

    return (
      <Typography className={classes.root} component="div">
        {require}
        {form}
        {content}
        <div style={{height: 1}}></div>
      </Typography>
    );
  }

}

function mapStateToProps(state, ownProps) {
  const {ploop, file, match} = ownProps;
  const transferId = match.params.transferId;
  const profileId = state.login.id;

  if (ploop && transferId) {
    const subpath = (
      `${ploop.ploop_key}/${file ? file.file_id : 'current'}/${transferId}`);
    const recordURL = fOPNReport.pathToURL(`/transfer-record/${subpath}`);
    let record = fetchcache.get(state, recordURL);
    const loading = fetchcache.fetching(state, recordURL);
    const loadError = fetchcache.getError(state, recordURL);
    let recordCompleteURL = null;

    if (record) {
      // Now that the initial record is loaded, load the complete record,
      // which often takes longer because it updates all profiles and loops.
      recordCompleteURL = fOPNReport.pathToURL(
        `/transfer-record-complete/${subpath}`);
      const recordComplete = fetchcache.get(state, recordCompleteURL);
      if (recordComplete) {
        record = recordComplete;
      }
    }

    return {
      profileId,
      transferId,
      recordURL,
      record,
      recordCompleteURL,
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
