import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReport } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import { wfTypeTitles } from '../../util/transferfmt';
import { getCurrencyFormatter } from '../../util/currency';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import { FormattedDate, FormattedTime, FormattedRelative } from 'react-intl';
import IconButton from '@material-ui/core/IconButton';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import SearchIcon from '@material-ui/icons/Search';
import CancelIcon from '@material-ui/icons/Cancel';
import { setTransferId } from '../../reducer/app';


const styles = {
  root: {
    fontSize: '1.1rem',
  },
  searchIconBox: {
    margin: '0 auto',
    maxWidth: 800,
    textAlign: 'right',
  },
  cancelButton: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  formPaper: {
    margin: '16px auto',
    maxWidth: 800,
    textAlign: 'center',
    position: 'relative',
  },
  formButton: {
    margin: '16px',
  },
  transferIdField: {
    margin: '16px',
  },
  tablePaper: {
    margin: '0 auto 16px auto',
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
  fieldNameCell: {
    padding: '2px 8px',
  },
  fieldValueCell: {
    padding: '2px 8px',
  },
  detailButton: {
    margin: '8px',
  },
};


class TransferRecord extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    profileId: PropTypes.string.isRequired,
    recordURL: PropTypes.string,
    record: PropTypes.object,
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

  renderProfileLink(publicURL, id, title) {
    if (!id) {
      return <span>{title}</span>;
    }
    return (
      <a href={`${publicURL}/p/${id}`}
        target="_blank" rel="noopener noreferrer">{title}</a>
    );
  }

  render() {
    const form = this.renderForm();

    const {
      classes,
      recordURL,
      record,
      loading,
      loadError,
      profileId,
      transferId,
    } = this.props;

    if (!recordURL) {
      // No account or transfer ID selected.
      return (
        <div className={classes.root}>
          {form}
        </div>
      );
    }

    const require = (
      <Require fetcher={fOPNReport}
        urls={[recordURL]}
        options={{suppressServerError: true}} />);

    const fieldNameCell = `${classes.cell} ${classes.fieldNameCell}`;
    const fieldValueCell = `${classes.cell} ${classes.fieldValueCell}`;

    /* global process: false */
    const publicURL = process.env.REACT_APP_OPN_PUBLIC_URL;
    const transferURL = `${publicURL}/p/${profileId}/t/${transferId}`;

    let content;

    if (!record) {
      if (loading) {
        content = (
          <div style={{textAlign: 'center'}}>
            <CircularProgress style={{padding: '16px'}} />
          </div>);
      } else if (loadError) {
        content = (
          <div style={{padding: '16px'}}>
            <p>{loadError}</p>
          </div>);
      } else {
        content = (
          <div style={{padding: '16px'}}>
            Unable to retrieve transfer {transferId}
          </div>);
      }
    } else {
      content = (
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
                {record.currency} {
                  getCurrencyFormatter(record.currency)(record.amount)}
              </td>
            </tr>
            <tr>
              <td className={fieldNameCell}>
                Sender
              </td>
              <td className={fieldValueCell}>
                {this.renderProfileLink(
                  publicURL, record.sender_id, record.sender_title)}
              </td>
            </tr>
            <tr>
              <td className={fieldNameCell}>
                Recipient
              </td>
              <td className={fieldValueCell}>
                {this.renderProfileLink(
                  publicURL, record.recipient_id, record.recipient_title)}
              </td>
            </tr>
            <tr>
              <th className={`${classes.cell} ${classes.headCell}`}
                colSpan="2"
              >
                Movements
              </th>
            </tr>
          </tbody>
        </table>
      );
    }

    return (
      <Typography className={classes.root} component="div">
        {require}
        {form}
        <Paper className={classes.tablePaper}>
          {content}
        </Paper>
        <div style={{height: 1}}></div>
      </Typography>
    );
  }

}

function mapStateToProps(state, ownProps) {
  const {account, file, match} = ownProps;
  const transferId = match.params.transferId;
  const profileId = state.login.id;

  if (account && transferId) {
    const recordURL = fOPNReport.pathToURL(
      `/transfer-record/${account.target_id}/${account.loop_id}/` +
      `${account.currency}/${file ? file.id : 'current'}/${transferId}`);
    const record = fetchcache.get(state, recordURL);
    const loading = fetchcache.fetching(state, recordURL);
    const loadError = fetchcache.getError(state, recordURL);
    return {
      profileId,
      transferId,
      recordURL,
      record,
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
)(TransferRecord);
