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
import VaultIcon from './Vault';


const solidBorder = '1px solid #bbb';
const tableWidth = 1600;
const graphicCellWidth = 41;
const graphicCellHeight = 32;
const arrowHeadSize = 4;
const arrowColor = '#666';

const styles = theme => ({
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
  legendCell: {
    borderLeft: solidBorder,
    borderRight: solidBorder,
    position: 'relative',
  },
  legendLowerCell: {
    borderBottom: solidBorder,
  },
  peerTypeIcon: {
    position: 'absolute',
    width: '24px',
    height: '24px',
    color: '#666',
  },
  labelCell: {
    border: solidBorder,
    padding: '2px 8px',
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
  graphicIcon: {
    color: arrowColor,
    position: 'absolute',
  },
  graphicCell: {
    position: 'relative',
  },
  arrowLine: {
    position: 'absolute',
    height: '2px',
    top: '15px',
    backgroundColor: arrowColor,
  },
  arrowHeadLeft: {
    position: 'absolute',
    top: 16 - arrowHeadSize,
    width: 0,
    height: 0,
    border: `${arrowHeadSize}px solid transparent`,
    borderRightColor: arrowColor,
  },
  arrowHeadRight: {
    position: 'absolute',
    top: 16 - arrowHeadSize,
    width: 0,
    height: 0,
    border: `${arrowHeadSize}px solid transparent`,
    borderLeftColor: arrowColor,
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
        // path = username;
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
                {getCurrencyFormatter(record.currency)(record.amount)
                } {record.currency}
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
      legendLowerCell,
      labelCell,
      cell,
      numberCell,
      textCell,
    } = classes;

    const {
      movements,
      peer_order,
      loops,
    } = record;

    const rightColumns = 8;
    const headRows = [];
    const numCell = `${cell} ${numberCell}`;
    const txtCell = `${cell} ${textCell}`;

    headRows.push(
      <tr key="top">
        <th className={`${classes.cell} ${classes.headCell}`}
          colSpan={2 + rightColumns}
        >
          Movements
        </th>
      </tr>
    );

    const legendWidthStyle = {
      width: graphicCellWidth * peer_order.length - 1,
      minWidth: graphicCellWidth * peer_order.length - 1,
    };

    headRows.push(
      <tr key="legend">
        <td className={labelCell}></td>
        {this.renderLegendCell(rightColumns)}
      </tr>
    );

    headRows.push(
      <tr key="labels">
        <td key="number" className={labelCell}>Number</td>
        <td key="legend" className={legendLowerCell} style={legendWidthStyle}>
        </td>
        <td key="vault_delta" className={labelCell}>Vault</td>
        <td key="wallet_delta" className={labelCell}>Wallet</td>
        <td key="amount" className={labelCell}>Amount</td>
        <td key="design" className={labelCell}>Note Design</td>
        <td key="issuer" className={labelCell}>Issuer</td>
        <td key="action" className={labelCell}>Action Code</td>
        <td key="ts" className={labelCell}>Date and Time</td>
        <td key="reco" className={labelCell}>Reconciled</td>
      </tr>
    );

    const bodyRows = [];

    movements.forEach((movement, index) => {
      const mvCells = [];
      const {
        loop_id,
        currency,
        amount,
        wallet_delta,
        vault_delta,
        issuer_id,
      } = movement;

      mvCells.push(
        <td key="number" className={numCell}>{movement.number}</td>);

      mvCells.push(this.renderGraphicCell(movement));

      if (vault_delta && vault_delta !== '0') {
        mvCells.push(
          <td key="vault_delta" className={numCell}>
            {getCurrencyDeltaFormatter(currency)(vault_delta)} {currency}
          </td>);
      } else {
        mvCells.push(<td key="vault_delta" className={numCell}></td>);
      }

      if (wallet_delta && wallet_delta !== '0') {
        mvCells.push(
          <td key="wallet_delta" className={numCell}>
            {getCurrencyDeltaFormatter(currency)(wallet_delta)} {currency}
          </td>);
      } else {
        mvCells.push(<td key="wallet_delta" className={numCell}></td>);
      }

      if (amount && amount !== '0') {
        mvCells.push(
          <td key="amount" className={numCell}>
            {getCurrencyFormatter(currency)(amount)} {currency}
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
        <td key="issuer" className={txtCell}>
          {this.renderProfileLink(issuer_id)}
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
    totalCells.push(<td className={labelCell} key="graphic"></td>);
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
      {getCurrencyDeltaFormatter(currency)(totals[currency])} {currency}
    </div>);
  }

  renderLegendCell(rightColumns) {
    // The legend is the table cell above the graphic cells.
    const {
      classes,
      record,
    } = this.props;

    const {
      peerTypeIcon,
      legendCell,
    } = classes;

    const {
      peers,
      peer_order,
    } = record;

    const elements = [];

    peer_order.forEach((peerId, index) => {
      const iconStyle = {
        left: index * graphicCellWidth + 8,
        top: index * graphicCellHeight + 4,
      };
      const iconKey = `icon-${index}`;

      let icon = null;

      const peer = peers[peerId];
      if (peer) {
        if (peer.is_issuer) {
          icon = (
            <div key={iconKey} className={peerTypeIcon}
              style={iconStyle} title="Issuer"
            >
              <VaultIcon/>
            </div>);
        } else if (peer.is_dfi_account) {
          icon = (
            <div key={iconKey} className={peerTypeIcon}
              style={iconStyle} title="DFI Account"
            >
              <AccountBalance/>
            </div>);
        }
      }

      if (!icon) {
        icon = (
          <div key={iconKey} className={peerTypeIcon}
            style={iconStyle} title="Wallet"
          >
            <AccountBalanceWallet/>
          </div>
        );
      }

      elements.push(icon);

      const linkStyle = {
        position: 'absolute',
        left: (index + 1) * graphicCellWidth,
        top: index * graphicCellHeight + 4,
        lineHeight: '24px',
      };
      elements.push(
        <div key={`profile-${index}`} style={linkStyle}>
          {this.renderProfileLink(peerId)}
        </div>);

      const dashStyle = {
        position: 'absolute',
        left: (index + 0.5) * graphicCellWidth - 1,
        top: (index + 1) * graphicCellHeight,
        width: 0,
        height: (peer_order.length - index - 1) * graphicCellHeight + 20,
        borderLeft: '1px dashed #ccc',
      };
      elements.push(<div key={`dash-${index}`} style={dashStyle}></div>);
    });

    const legendStyle = {
      height: graphicCellHeight * peer_order.length,
    };

    return (
      <td className={legendCell} style={legendStyle}
        colSpan={1 + rightColumns}
      >
        {elements}
      </td>);
  }

  renderGraphicCell(movement) {
    // A graphic cell shows a graphical representation of a movement.
    // Graphic cells are below the legend label.
    const {
      classes,
      record,
    } = this.props;

    const {
      graphicIcon,
      graphicCell,
      arrowLine,
      arrowHeadLeft,
      arrowHeadRight,
    } = classes;

    const {
      peers,
      peer_order,
      peer_index,
    } = record;

    const {
      from_id,
      to_id,
      issuer_id,
    } = movement;

    const getIcon = (peerId, style) => {
      if (peerId === issuer_id) {
        if (!from_id) {
          return (
            <div key={peerId} className={graphicIcon}
              style={style} title="Issued Notes"
            >
              <StarIcon/>
            </div>);
        } else {
          return (
            <div key={peerId} className={graphicIcon}
              style={style} title="Issuer Vault"
            >
              <VaultIcon/>
            </div>);
        }
      } else if (peers[peerId] && peers[peerId].is_dfi_account) {
        return (
          <div key={peerId} className={graphicIcon}
            style={style} title="DFI Account"
          >
            <AccountBalance/>
          </div>);
      } else {
        return (
          <div key={peerId} className={graphicIcon}
            style={style} title="Wallet"
          >
            <AccountBalanceWallet/>
          </div>);
      }
    };

    const elements = [];

    let from_index = peer_index[from_id];
    let to_index = peer_index[to_id];

    if (from_index >= 0) {
      elements.push(getIcon(from_id, {
        top: 4,
        left: graphicCellWidth * from_index + 8,
      }));
    }

    if (to_index >= 0) {
      elements.push(getIcon(to_id, {
        top: 4,
        left: graphicCellWidth * to_index + 8,
      }));
    }

    if (from_index >= 0 && to_index >= 0 && from_index !== to_index) {
      // Add an arrow.
      let lineStyle;
      let headStyle;
      let headClass;
      if (from_index < to_index) {
        // The arrow is left to right.
        lineStyle = {
          left: (from_index + 1) * graphicCellWidth - arrowHeadSize,
          width: (to_index - from_index - 1) * graphicCellWidth + arrowHeadSize,
        };
        headStyle = {
          left: to_index * graphicCellWidth,
        };
        headClass = arrowHeadRight;
      } else {
        // The arrow is right to left.
        lineStyle = {
          left: (to_index + 1) * graphicCellWidth,
          width: (from_index - to_index - 1) * graphicCellWidth + arrowHeadSize,
        };
        headStyle = {
          left: (to_index + 1) * graphicCellWidth - arrowHeadSize * 2,
        };
        headClass = arrowHeadLeft;
      }
      elements.push(<div className={arrowLine} style={lineStyle}></div>);
      elements.push(<div className={headClass} style={headStyle}></div>);
    }

    const graphicStyle = {
      height: graphicCellHeight,
      width: graphicCellWidth * peer_order.length - 1,
    };
    return (
      <td key="graphic" className={graphicCell} style={graphicStyle}>
        {elements}
      </td>);
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
    let record = fetchcache.get(state, recordURL);
    const loading = fetchcache.fetching(state, recordURL);
    const loadError = fetchcache.getError(state, recordURL);
    let recordCompleteURL = null;

    if (record) {
      // Now that the initial record is loaded, load the complete record,
      // which takes longer because it updates all profiles and loops.
      recordCompleteURL = fOPNReport.pathToURL(
        `/transfer-record-complete/${transferId}`);
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
  withStyles(styles, {withTheme: true}),
  withRouter,
  connect(mapStateToProps),
)(TransferSummary);
