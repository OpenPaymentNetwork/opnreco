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
import AccountBalance from '@material-ui/icons/AccountBalance';
import AccountBalanceWallet from '@material-ui/icons/AccountBalanceWallet';
import MonetizationOn from '@material-ui/icons/MonetizationOn';
import { setTransferId } from '../../reducer/app';


const solidBorder = '1px solid #bbb';

const styles = theme => ({
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
  legendCell: {
    borderLeft: solidBorder,
    borderRight: solidBorder,
    padding: '2px 8px',
  },
  legendSpacerCell: {
    borderLeft: solidBorder,
    width: '32px',
  },
  labelCell: {
    border: solidBorder,
    padding: '2px 8px',
  },
  legendLabelCell: {
    border: solidBorder,
    borderTop: 'none',
    width: '32px',
  },
  profileLink: {
    color: theme.palette.primary.main,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  numberCell: {
    padding: '2px 8px',
    textAlign: 'right',
  },
  textCell: {
    padding: '2px 8px',
  },
});


class TransferSummary extends React.Component {
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
    /* global process: false */
    this.publicURL = process.env.REACT_APP_OPN_PUBLIC_URL;
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

  renderProfileLink(id, title) {
    if (!id) {
      return <span>{title || `[Profile ${id}]`}</span>;
    }

    const {record, classes} = this.props;

    // Prefer the title/username from target_titles and target_usernames.
    const titles = record.target_titles;
    let text = title;
    const title1 = titles[id];
    if (title1) {
      const username = record.target_usernames[id];
      if (username) {
        text = <span>{title1} (<em>{username}</em>)</span>;
      } else {
        text = title1;
      }
    }

    return (
      <a className={classes.profileLink}
        href={`${this.publicURL}/p/${id}`}
        target="_blank" rel="noopener noreferrer">{text}</a>
    );
  }

  renderTopTable() {
    const {
      classes,
      record,
      profileId,
      transferId,
    } = this.props;

    const fieldNameCell = `${classes.cell} ${classes.fieldNameCell}`;
    const fieldValueCell = `${classes.cell} ${classes.fieldValueCell}`;
    const transferURL = `${this.publicURL}/p/${profileId}/t/${transferId}`;

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
                  record.sender_id, record.sender_title)}
              </td>
            </tr>
            <tr>
              <td className={fieldNameCell}>
                Recipient
              </td>
              <td className={fieldValueCell}>
                {this.renderProfileLink(
                  record.recipient_id, record.recipient_title)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  renderMovementsTable() {
    const {
      classes,
      record,
    } = this.props;

    const {
      legendCell,
      legendSpacerCell,
      labelCell,
      legendLabelCell,
      cell,
      numberCell,
      textCell,
    } = classes;

    const {
      movements,
      target_order,
      target_accounts,
      loop_titles,
    } = record;

    const rightColumns = 5;
    const columnCount = 1 + target_order.length + rightColumns;
    const headRows = [];
    const numCell = `${cell} ${numberCell}`;
    const txtCell = `${cell} ${textCell}`;

    headRows.push(
      <tr key="top">
        <th className={`${classes.cell} ${classes.headCell}`}
          colSpan={columnCount}
        >
          Movements
        </th>
      </tr>
    );

    const labelCells = [<td key="number" className={labelCell}>Number</td>];

    target_order.forEach((targetId, index) => {
      const legendCells = [<td className={legendSpacerCell} key="number"/>];
      for (let j = 0; j < index; j++) {
        legendCells.push(<td className={legendSpacerCell} key={j}/>);
      }
      legendCells.push(
        <td key="target" colSpan={target_order.length - index + rightColumns}
          className={legendCell}
        >
          {this.renderProfileLink(targetId)}
        </td>
      );
      headRows.push(<tr key={targetId}>{legendCells}</tr>);
      labelCells.push(<td key={targetId} className={legendLabelCell}/>);
    });

    labelCells.push(<td key="amount" className={labelCell}>Amount</td>);
    labelCells.push(<td key="design" className={labelCell}>Type</td>);
    labelCells.push(<td key="action" className={labelCell}>Action</td>);
    labelCells.push(<td key="ts" className={labelCell}>Date and Time</td>);
    labelCells.push(<td key="reco" className={labelCell}>Reconciled</td>);

    headRows.push(<tr key="labels">{labelCells}</tr>);

    const bodyRows = [];

    movements.forEach((movement, index) => {
      const mvCells = [];
      const {
        loop_id,
        currency,
        amount,
        from_id,
        to_id,
        issuer_id,
      } = movement;

      mvCells.push(
        <td key="number" className={numCell}>{movement.number}</td>);

      const getIcon = targetId => {
        if (targetId === issuer_id) {
          return <span title="Issuer Vault"><MonetizationOn/></span>;
        } else if (target_accounts[targetId]) {
          return <span title="Account"><AccountBalance/></span>;
        } else {
          return <span title="Wallet"><AccountBalanceWallet/></span>;
        }
      };

      target_order.forEach(targetId => {
        let cell;
        if (targetId === from_id) {
          cell = <td key={targetId}>{getIcon(targetId)}</td>;
        } else if (targetId === to_id) {
          cell = <td key={targetId}>{getIcon(targetId)}</td>;
        } else {
          cell = <td key={targetId}></td>;
        }
        mvCells.push(cell);
      });

      mvCells.push(
        <td key="amount" className={numCell}>
          {currency} {getCurrencyFormatter(currency)(amount)}
        </td>);

      let loopTitle;
      if (loop_id === '0') {
        loopTitle = 'Open Loop';
      } else {
        loopTitle = (
          <em>{loop_titles[loop_id] || `Closed Loop ${loop_id}`}</em>);
      }
      mvCells.push(
        <td key="design" className={txtCell}>
          {loopTitle}
        </td>);

      mvCells.push(
        <td key="action" className={txtCell}>
          {movement.action}
        </td>);

      const ts = new Date(movement.ts);
      mvCells.push(
        <td key="ts" className={txtCell}>
          <FormattedDate value={ts} />
          {' '}
          <FormattedTime value={ts} />
        </td>);

      bodyRows.push(
        <tr key={index}>
          {mvCells}
        </tr>
      );
    });

    return (
      <div>
        <table className={classes.table}>
          <thead>
            {headRows}
          </thead>
          <tbody>
            {bodyRows}
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
      loading,
      loadError,
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
            {this.renderTopTable()}
          </Paper>
          <Paper className={classes.tablePaper}>
            {this.renderMovementsTable()}
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
  const {account, match} = ownProps;
  const transferId = match.params.transferId;
  const profileId = state.login.id;

  if (account && transferId) {
    const recordURL = fOPNReport.pathToURL(`/transfer-record/${transferId}`);
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
  withStyles(styles, {withTheme: true}),
  withRouter,
  connect(mapStateToProps),
)(TransferSummary);
