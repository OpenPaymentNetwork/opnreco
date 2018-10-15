import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReport } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import { wfTypeTitles } from '../../util/transferfmt';
import { getCurrencyFormatter } from '../../util/currency';
import { getCurrencyDeltaFormatter } from '../../util/currency';
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
import StarIcon from '@material-ui/icons/Star';
import StorageIcon from '@material-ui/icons/Storage';
import { setTransferId } from '../../reducer/app';


const solidBorder = '1px solid #bbb';
const tableWidth = 1200;

const styles = theme => {
  const arrowColor = '#666';
  return {
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
    legendCell: {
      borderLeft: solidBorder,
      borderRight: solidBorder,
      padding: 0,
      height: '32px',
      position: 'relative',
      '& > $profileLink': {
        position: 'absolute',
        left: 32,
        top: 4,
        lineHeight: '24px',
      },
    },
    profileTypeIcon: {
      position: 'absolute',
      width: '24px',
      height: '24px',
      left: '4px',
      top: '4px',
      color: '#666',
    },
    legendSpacerCell: {
      borderLeft: solidBorder,
      width: '32px',
      maxWidth: '32px',
    },
    labelCell: {
      border: solidBorder,
      padding: '2px 8px',
    },
    legendLabelCell: {
      border: solidBorder,
      borderTop: 'none',
      width: '32px',
      maxWidth: '32px',
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
    iconCell: {
      position: 'relative',
      width: '32px',
      maxWidth: '32px',
      height: '32px',
      overflow: 'hidden',
    },
    iconContent: {
      color: '#666',
      position: 'absolute',
      left: 4,
      top: 4,
    },
    arrowMiddle: {
      position: 'absolute',
      left: -1,
      width: 100,
      top: 14,
      height: 2,
      zIndex: 1,
      backgroundColor: arrowColor,
      borderTop: '1px solid #fff',
      borderBottom: '1px solid #fff',
    },
    arrowLeftStart: {
      position: 'absolute',
      left: 0,
      width: 4,
      top: 14,
      height: 2,
      zIndex: 1,
      backgroundColor: arrowColor,
      border: '1px solid #fff',
      borderLeft: 'none',
    },
    arrowLeftEnd: {
      position: 'absolute',
      left: 32 - 10,
      top: 16 - 5,
      width: 0,
      height: 0,
      border: '5px solid transparent',
      borderRightColor: '#fff',
    },
    arrowLeftEndInner: {
      position: 'absolute',
      left: -4,
      top: -4,
      width: 0,
      height: 0,
      border: '4px solid transparent',
      borderRightColor: arrowColor,
    },
    arrowLeftEndInner2: {
      position: 'absolute',
      left: 4,
      width: 100,
      top: -1,
      height: 2,
      backgroundColor: arrowColor,
    },
    arrowRightStart: {
      position: 'absolute',
      left: 32 - 5,
      width: 100,
      top: 14,
      height: 2,
      zIndex: 1,
      backgroundColor: arrowColor,
      border: '1px solid #fff',
      borderRight: 'none',
    },
    arrowRightEnd: {
      position: 'absolute',
      left: 0,
      top: 16 - 5,
      width: 0,
      height: 0,
      border: '5px solid transparent',
      borderLeftColor: '#fff',
    },
    arrowRightEndInner: {
      position: 'absolute',
      left: -5,
      top: -4,
      width: 0,
      height: 0,
      border: '4px solid transparent',
      borderLeftColor: arrowColor,
    },
  };
};


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

  renderProfileLink(id, title) {
    if (!id) {
      return <span>{title || `[Profile ${id}]`}</span>;
    }

    const {record, classes} = this.props;

    // Prefer the title/username from the peers object.
    const peers = record.peers;
    let text = title;
    let path = `p/${id}`;
    const peer = peers[id];
    if (peer && peer.title) {
      const username = peer.username;
      if (username) {
        text = <span>{peer.title} (<em>{username}</em>)</span>;
        path = username;
      } else {
        text = peer.title;
      }
    }

    return (
      <a className={classes.profileLink}
        href={`${this.publicURL}/${path}`}
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
      profileTypeIcon,
    } = classes;

    const {
      movements,
      peers,
      peer_order,
      loops,
    } = record;

    const rightColumns = 7;
    const columnCount = 1 + peer_order.length + rightColumns;
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

    const labelCells = [<td key="number" className={labelCell}>Num</td>];

    peer_order.forEach((peerId, index) => {
      const legendCells = [<td className={legendSpacerCell} key="number"/>];
      for (let j = 0; j < index; j++) {
        legendCells.push(<td className={legendSpacerCell} key={j}/>);
      }

      let icon = (
        <div className={profileTypeIcon} title="Wallet">
          <AccountBalanceWallet/>
        </div>
      );

      const peer = peers[peerId];
      if (peer) {
        if (peer.is_issuer) {
          icon = (
            <div className={profileTypeIcon} title="Issuer">
              <StorageIcon/>
            </div>);
        } else if (peer.is_dfi_account) {
          icon = (
            <div className={profileTypeIcon} title="DFI Account">
              <AccountBalance/>
            </div>);
        }
      }

      legendCells.push(
        <td key="target" colSpan={peer_order.length - index + rightColumns}
          className={legendCell}
        >
          {icon}
          {this.renderProfileLink(peerId)}
        </td>
      );
      headRows.push(<tr key={peerId}>{legendCells}</tr>);
      labelCells.push(<td key={peerId} className={legendLabelCell}/>);
    });

    labelCells.push(<td key="vault_delta" className={labelCell}>Vault</td>);
    labelCells.push(<td key="wallet_delta" className={labelCell}>Wallet</td>);
    labelCells.push(<td key="amount" className={labelCell}>Amount</td>);
    labelCells.push(<td key="design" className={labelCell}>Note Design</td>);
    labelCells.push(<td key="action" className={labelCell}>Action Code</td>);
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
        wallet_delta,
        vault_delta,
      } = movement;

      mvCells.push(
        <td key="number" className={numCell}>{movement.number}</td>);

      const iconCells = this.renderIconCells(movement);
      iconCells.forEach(cell => {
        mvCells.push(cell);
      });

      if (vault_delta && vault_delta !== '0') {
        mvCells.push(
          <td key="vault_delta" className={numCell}>
            {currency} {getCurrencyDeltaFormatter(currency)(vault_delta)}
          </td>);
      } else {
        mvCells.push(<td key="vault_delta" className={numCell}></td>);
      }

      if (wallet_delta && wallet_delta !== '0') {
        mvCells.push(
          <td key="wallet_delta" className={numCell}>
            {currency} {getCurrencyDeltaFormatter(currency)(wallet_delta)}
          </td>);
      } else {
        mvCells.push(<td key="wallet_delta" className={numCell}></td>);
      }

      if (amount && amount !== '0') {
        mvCells.push(
          <td key="amount" className={numCell}>
            {currency} {getCurrencyFormatter(currency)(amount)}
          </td>);
      } else {
        mvCells.push(<td key="amount" className={numCell}></td>);
      }

      let loopTitle;
      if (loop_id === '0') {
        loopTitle = 'Open Loop';
      } else {
        loopTitle = (
          <em>{loops[loop_id] ? loops[loop_id].title
            : `Closed Loop ${loop_id}`}</em>);
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

    const totalCells = [];

    totalCells.push(<td className={labelCell} key="label">Total</td>);
    totalCells.push(
      <td className={labelCell} key="icons" colSpan={peer_order.length}></td>);
    totalCells.push(
      <td className={numCell} key="vault_delta">
        <strong>{this.renderTotalCell(record.vault_delta_totals)}</strong>
      </td>
    );
    totalCells.push(
      <td className={numCell} key="wallet_delta">
        <strong>{this.renderTotalCell(record.wallet_delta_totals)}</strong>
      </td>
    );
    totalCells.push(
      <td className={labelCell} key="rest" colSpan={rightColumns - 2}></td>);
    bodyRows.push(
      <tr key="total">
        {totalCells}
      </tr>
    );

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

  renderTotalCell(totals) {
    const currencies = Object.keys(totals);
    currencies.sort();
    return currencies.map(currency => <div key={currency}>
      {currency} {getCurrencyDeltaFormatter(currency)(totals[currency])}
    </div>);
  }

  renderIconCells(movement) {
    const {
      classes,
      record,
    } = this.props;

    const {
      iconCell,
      iconContent,
      arrowMiddle,
      arrowLeftStart,
      arrowLeftEnd,
      arrowLeftEndInner,
      arrowLeftEndInner2,
      arrowRightStart,
      arrowRightEnd,
      arrowRightEndInner,
    } = classes;

    const {
      peers,
      peer_index,
      peer_order,
    } = record;

    const {
      from_id,
      to_id,
      issuer_id,
    } = movement;

    const iconCells = [];

    let from_index = peer_index[from_id];
    let to_index = peer_index[to_id];
    if (from_index === undefined || to_index === undefined) {
      // Don't display arrows.
      from_index = -1;
      to_index = -1;
    }

    const getIcon = peerId => {
      if (peerId === issuer_id) {
        if (!from_id) {
          return (
            <div className={iconContent} title="Issued Notes">
              <StarIcon/>
            </div>);
        } else {
          return (
            <div className={iconContent} title="Issuer Vault">
              <StorageIcon/>
            </div>);
        }
      } else if (peers[peerId] && peers[peerId].is_dfi_account) {
        return (
          <div className={iconContent} title="DFI Account">
            <AccountBalance/>
          </div>);
      } else {
        return (
          <div className={iconContent} title="Wallet">
            <AccountBalanceWallet/>
          </div>);
      }
    };

    peer_order.forEach((peerId, index) => {
      let cell;
      if (peerId === from_id || peerId === to_id) {
        let arrowPiece = null;
        if (peerId === from_id) {
          if (from_index < to_index) {
            arrowPiece = <div className={arrowRightStart} />;
          } else  if (from_index > to_index) {
            arrowPiece = <div className={arrowLeftStart} />;
          }
        } else {
          if (from_index < to_index) {
            arrowPiece = (
              <div className={arrowRightEnd}>
                <div className={arrowRightEndInner}/>
              </div>);
          } else if (from_index > to_index) {
            arrowPiece = (
              <div className={arrowLeftEnd}>
                <div className={arrowLeftEndInner}/>
                <div className={arrowLeftEndInner2}/>
              </div>);
          }
        }
        cell = (
          <td key={peerId} className={iconCell}>
            {getIcon(peerId)}
            {arrowPiece}
          </td>
        );
      } else {
        let arrowPiece = null;
        if (
          (from_index < to_index && from_index < index && index < to_index) ||
          (from_index > to_index && from_index > index && index > to_index)) {
          arrowPiece = <div className={arrowMiddle}/>;
        }
        cell = <td key={peerId} className={iconCell}>{arrowPiece}</td>;
      }
      iconCells.push(cell);
    });

    return iconCells;
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
      // No transfer ID selected.
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
  const {match} = ownProps;
  const transferId = match.params.transferId;
  const profileId = state.login.id;

  if (transferId) {
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
