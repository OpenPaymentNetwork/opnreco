import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { FormattedDate, FormattedTime } from 'react-intl';
import {
  getCurrencyDeltaFormatter,
  getCurrencyFormatter
} from '../../util/currency';
import AccountBalance from '@material-ui/icons/AccountBalance';
import AccountBalanceWallet from '@material-ui/icons/AccountBalanceWallet';
import CheckBoxIcon from '@material-ui/icons/CheckBox';
import CheckBoxOutlineBlankIcon
  from '@material-ui/icons/CheckBoxOutlineBlank';
import ProfileLink from './ProfileLink';
import PropTypes from 'prop-types';
import React from 'react';
import StarIcon from '@material-ui/icons/Star';
import VaultIcon from './Vault';
import { withStyles } from '@material-ui/core/styles';
import { binder } from '../../util/binder';


const solidBorder = '1px solid #bbb';
const graphicCellWidth = 41;
const graphicCellHeight = 32;
const arrowHeadSize = 4;
const arrowColor = '#666';


const styles = {
  headCell: {
    padding: '4px 8px',
    fontWeight: 'normal',
    backgroundColor: '#ddd',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    color: '#000',
  },
  cell: {
    border: solidBorder,
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
};


class MovementTable extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    record: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
  }

  renderMovementTotalCell(totals) {
    const currencies = Object.keys(totals);
    currencies.sort();
    return currencies.map(currency => <div key={currency}>
      {getCurrencyDeltaFormatter(currency)(totals[currency])} {currency}
    </div>);
  }

  renderMovementLegendCell(rightColumns) {
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
          <ProfileLink id={peerId} profiles={record.peers} />
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
      if (!from_id) {
        return (
          <div key={peerId} className={graphicIcon}
            style={style} title="Issued Notes"
          >
            <StarIcon/>
          </div>);
      }
      if (peerId === issuer_id) {
        return (
          <div key={peerId} className={graphicIcon}
            style={style} title="Issuer Vault"
          >
            <VaultIcon/>
          </div>);
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
      elements.push(
        <div key="arrow_line" className={arrowLine} style={lineStyle}></div>);
      elements.push(
        <div key="arrow_head" className={headClass} style={headStyle}></div>);
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

  renderExchangeRows(options) {
    const {
      rightColumns,
      hasOtherAmount,
    } = options;

    const {
      classes,
      record,
    } = this.props;

    const {
      cell,
      numberCell,
      textCell,
      checkCell,
    } = classes;

    const {
      exchanges,
      loops,
    } = record;

    const numCell = `${cell} ${numberCell}`;
    const txtCell = `${cell} ${textCell}`;
    const chkCell = `${cell} ${checkCell}`;

    const rows = [
      <th key="settlements" className={`${classes.cell} ${classes.headCell}`}
        colSpan={2 + rightColumns}
      >
        Wallet Settlements
      </th>
    ];

    exchanges.forEach((exchange, exchangeIndex) => {
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

      rows.push(
        <tr key={`exchange-${exchangeIndex}`}>
          <td className={txtCell} colSpan="2"></td>
          <td className={numCell}>
            {getCurrencyDeltaFormatter(exchange.currency)(exchange.vault_delta)
            } {exchange.currency}
          </td>
          <td className={numCell}>
            {getCurrencyDeltaFormatter(exchange.currency)(exchange.wallet_delta)
            } {exchange.currency}
          </td>
          {hasOtherAmount ? <td className={numCell}></td> : null}
          <td className={txtCell}>
            {loopTitle}
          </td>
          <td colSpan="3" className={txtCell}></td>
          <td className={chkCell}>
            {recoContent}
          </td>
        </tr>);
    });

    return rows;
  }

  render() {
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
      checkCell,
    } = classes;

    const {
      movements,
      peer_order,
      loops,
    } = record;

    let hasOtherAmount = false;
    movements.forEach(movement => {
      if (movement.vault_delta && movement.vault_delta !== '0') {
        return;
      }
      if (movement.wallet_delta && movement.wallet_delta !== '0') {
        return;
      }
      // This amount is not listed in either vault_delta or wallet_delta,
      // so the only way to show it is to show the 'Other Amount' column.
      hasOtherAmount = true;
    });

    const rightColumns = hasOtherAmount ? 8 : 7;
    const headRows = [];
    const numCell = `${cell} ${numberCell}`;
    const txtCell = `${cell} ${textCell}`;
    const chkCell = `${cell} ${checkCell}`;

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
        {this.renderMovementLegendCell(rightColumns)}
      </tr>
    );

    headRows.push(
      <tr key="labels">
        <td key="number" className={labelCell}>Number</td>
        <td key="legend" className={legendLowerCell} style={legendWidthStyle}>
        </td>
        <td key="vault_delta" className={labelCell}>Vault</td>
        <td key="wallet_delta" className={labelCell}>Wallet</td>
        {hasOtherAmount ?
          <td key="other_amount" className={labelCell}>Other Amount</td>
          : null}
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
        reco_id,
        need_reco,
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

      if (hasOtherAmount) {
        if (amount && amount !== '0' &&
              (!wallet_delta || wallet_delta === '0') &&
              (!vault_delta || vault_delta === '0')) {
          mvCells.push(
            <td key="other_amount" className={numCell}>
              {getCurrencyFormatter(currency)(amount)} {currency}
            </td>);
        } else {
          mvCells.push(<td key="other_amount" className={numCell}></td>);
        }
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
          <ProfileLink id={issuer_id} profiles={record.peers} />
        </td>);

      mvCells.push(
        <td key="action" className={txtCell}>
          {movement.action}
        </td>);

      const ts = new Date(movement.ts);
      mvCells.push(
        <td key="ts" className={txtCell} title={movement.ts}>
          <FormattedDate value={ts} />
          {' '}
          <FormattedTime value={ts} />
        </td>);

      let recoContent = null;
      if (need_reco) {
        if (reco_id !== null) {
          recoContent = <CheckBoxIcon />;
        } else {
          recoContent = <CheckBoxOutlineBlankIcon />;
        }
      }
      mvCells.push(
        <td key="reco" className={chkCell}>
          {recoContent}
        </td>);

      bodyRows.push(
        <tr key={index}>
          {mvCells}
        </tr>
      );
    });

    if (record.exchanges && record.exchanges.length) {
      this.renderExchangeRows({rightColumns, hasOtherAmount}).forEach(row => {
        bodyRows.push(row);
      });
    }

    const totalCells = [];

    totalCells.push(<td className={labelCell} key="label">Total</td>);
    totalCells.push(<td className={labelCell} key="graphic"></td>);
    totalCells.push(
      <td className={numCell} key="vault_delta">
        <strong>
          {this.renderMovementTotalCell(record.vault_delta_totals)}
        </strong>
      </td>
    );
    totalCells.push(
      <td className={numCell} key="wallet_delta">
        <strong>
          {this.renderMovementTotalCell(record.wallet_delta_totals)}
        </strong>
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

}


export default compose(
  withStyles(styles),
  connect(),  // Provide the dispatch function
)(MovementTable);
