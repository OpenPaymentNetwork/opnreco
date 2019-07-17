import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { FormattedDate, FormattedTime } from 'react-intl';
import {
  getCurrencyDeltaFormatter,
  getCurrencyFormatter
} from '../../util/currency';
import AccountBalance from '@material-ui/icons/AccountBalance';
import AccountBalanceWallet from '@material-ui/icons/AccountBalanceWallet';
import ProfileLink from '../../util/ProfileLink';
import PropTypes from 'prop-types';
import RecoCheckBox from './RecoCheckBox';
import React from 'react';
import StarIcon from '@material-ui/icons/Star';
import VaultIcon from './Vault';
import { withStyles } from '@material-ui/core/styles';


const solidBorder = '1px solid #bbb';
const graphicCellWidth = 41;
const graphicCellHeight = 32;
const arrowHeadSize = 4;
const arrowColor = '#666';


const styles = {
  headCell: {
    padding: '4px 8px',
    backgroundColor: '#ddd',
    textAlign: 'left',
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
    color: arrowColor,
    '&.self': {
      color: '#000',
    },
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
    padding: '0',
  },
  graphicIcon: {
    color: arrowColor,
    position: 'absolute',
    '&.self': {
      color: '#000',
    },
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


class TransferMovementTable extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    periodId: PropTypes.string.isRequired,
    record: PropTypes.object,
  };

  renderMovementLegendCell(columnsAfterGraphic) {
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
      self_id,
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
      const iconClass = peerTypeIcon + (peerId === self_id ? ' self': '');

      let icon = null;

      const peer = peers[peerId];
      if (peer) {
        if (peer.is_issuer) {
          icon = (
            <div key={iconKey} className={iconClass}
              style={iconStyle} title="Issuer"
            >
              <VaultIcon/>
            </div>);
        } else if (peer.is_dfi_account) {
          icon = (
            <div key={iconKey} className={iconClass}
              style={iconStyle} title="DFI Account"
            >
              <AccountBalance/>
            </div>);
        }
      }

      if (!icon) {
        icon = (
          <div key={iconKey} className={iconClass}
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
        colSpan={1 + columnsAfterGraphic}
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
      self_id,
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
      const iconClass = graphicIcon + (peerId === self_id ? ' self': '');
      if (!from_id) {
        return (
          <div key={peerId} className={iconClass}
            style={style} title="Issued Notes"
          >
            <StarIcon/>
          </div>);
      }
      if (peerId === issuer_id) {
        return (
          <div key={peerId} className={iconClass}
            style={style} title="Issuer Vault"
          >
            <VaultIcon/>
          </div>);
      } else if (peers[peerId] && peers[peerId].is_dfi_account) {
        return (
          <div key={peerId} className={iconClass}
            style={style} title="DFI Account"
          >
            <AccountBalance/>
          </div>);
      } else {
        return (
          <div key={peerId} className={iconClass}
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

  renderLoopTitle(loopId) {
    if (loopId === '0') {
      return 'Open Loop';
    } else {
      const {record: {loops}} = this.props;
      return (
        <em>{loops[loopId] ? loops[loopId].title
          : `Closed Loop ${loopId}`}</em>);
    }
  }

  getLayout() {
    const {record} = this.props;
    const {movements} = record;

    let showVault = false;
    let showOtherAmount = false;

    if (record.show_vault) {
      showVault = true;
    }

    movements.forEach(movement => {
      if (movement.vault_delta && movement.vault_delta !== '0') {
        showVault = true;
        return;
      }
      if (movement.wallet_delta && movement.wallet_delta !== '0') {
        return;
      }
      // This amount is not listed in either vault_delta or wallet_delta,
      // so the only way to show it is to show the 'Other Amount' column.
      showOtherAmount = true;
    });

    const columnsAfterGraphic = (
      (showVault ? 1 : 0) + 1 + (showOtherAmount ? 1 : 0) + 5);

    return {
      showVault,
      showOtherAmount,
      columnsAfterGraphic,
    };
  }

  renderHead(layout) {
    const {
      classes,
      record,
    } = this.props;

    const {
      legendLowerCell,
      labelCell,
    } = classes;

    const {
      peer_order,
    } = record;

    const headRows = [];

    headRows.push(
      <tr key="top">
        <th className={`${classes.cell} ${classes.headCell}`}
          colSpan={2 + layout.columnsAfterGraphic}
        >
          Note Possession Changes (Movements)
        </th>
      </tr>
    );

    if (record.movements.length) {
      const legendWidthStyle = {
        width: graphicCellWidth * peer_order.length - 1,
        minWidth: graphicCellWidth * peer_order.length - 1,
      };

      headRows.push(
        <tr key="legend">
          <td className={labelCell}></td>
          {this.renderMovementLegendCell(layout.columnsAfterGraphic)}
        </tr>
      );

      headRows.push(
        <tr key="labels">
          <td key="number" className={labelCell}>Number</td>
          <td key="legend" className={legendLowerCell} style={legendWidthStyle}>
          </td>
          {layout.showVault ?
            <td key="vault" className={labelCell}>Vault</td>
            : null}
          <td key="wallet" className={labelCell}>Wallet</td>
          {layout.showOtherAmount ?
            <td key="other_amount" className={labelCell}>Other Amount</td>
            : null}
          <td key="design" className={labelCell}>Note Design</td>
          <td key="issuer" className={labelCell}>Issuer</td>
          <td key="action" className={labelCell}>Action Code</td>
          <td key="ts" className={labelCell}>Date and Time</td>
          <td key="reco" className={labelCell}>Reconciled</td>
        </tr>
      );
    }

    return <thead>{headRows}</thead>;
  }

  renderBody(layout) {
    const {
      classes,
      record,
      dispatch,
      periodId,
    } = this.props;

    const {
      cell,
      numberCell,
      textCell,
      checkCell,
    } = classes;

    const {
      movements,
    } = record;

    const numCell = `${cell} ${numberCell}`;
    const txtCell = `${cell} ${textCell}`;
    const chkCell = `${cell} ${checkCell}`;
    const {
      showVault,
      showOtherAmount,
    } = layout;

    const bodyRows = [];

    if (!record.movements.length) {
      bodyRows.push(
        <tr key="empty">
          <td colSpan={layout.columnsAfterGraphic + 2}
            className={`${classes.cell} ${classes.textCell}`}
          >
            <em>This transfer has not changed the possession of any notes.</em>
          </td>
        </tr>
      );
    }

    movements.forEach((movement, index) => {
      const mvCells = [];
      const {
        movement_id,
        loop_id,
        currency,
        amount,
        wallet_delta,
        vault_delta,
        issuer_id,
        reco_id,
        reco_applicable,
      } = movement;

      mvCells.push(
        <td key="number" className={numCell}>{movement.number}</td>);

      mvCells.push(this.renderGraphicCell(movement));

      if (showVault) {
        if (vault_delta && vault_delta !== '0') {
          mvCells.push(
            <td key="vault" className={numCell}>
              {getCurrencyDeltaFormatter(currency)(vault_delta)} {currency}
            </td>);
        } else {
          mvCells.push(<td key="vault" className={numCell}></td>);
        }
      }

      if (wallet_delta && wallet_delta !== '0') {
        mvCells.push(
          <td key="wallet" className={numCell}>
            {getCurrencyDeltaFormatter(currency)(wallet_delta)} {currency}
          </td>);
      } else {
        mvCells.push(<td key="wallet" className={numCell}></td>);
      }

      if (showOtherAmount) {
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

      mvCells.push(
        <td key="design" className={txtCell}>
          {this.renderLoopTitle(loop_id)}
        </td>);

      mvCells.push(
        <td key="issuer" className={txtCell}>
          <ProfileLink id={issuer_id} profiles={record.peers} />
        </td>);

      mvCells.push(
        <td key="action" className={txtCell}>
          {movement.action}
        </td>);

      const ts = movement.ts;
      mvCells.push(
        <td key="ts" className={txtCell} title={ts}>
          <FormattedDate value={ts}
            day="numeric" month="short" year="numeric" />
          {' '}
          <FormattedTime value={ts}
            hour="numeric" minute="2-digit" second="2-digit" />
        </td>);

      let recoContent = null;
      if (reco_applicable) {
        recoContent = (
          <RecoCheckBox
            periodId={periodId}
            movementId={movement_id}
            recoId={reco_id}
            dispatch={dispatch} />);
      }
      mvCells.push(
        <td key="reco" className={chkCell}>
          {recoContent}
        </td>);

      bodyRows.push(
        <tr data-movement-id={movement_id} key={`movement-${index}`}>
          {mvCells}
        </tr>
      );
    });

    return <tbody>{bodyRows}</tbody>;
  }

  renderFoot(layout) {
    const {
      classes,
      record,
    } = this.props;

    const {
      labelCell,
      cell,
      numberCell,
    } = classes;

    const numCell = `${cell} ${numberCell}`;

    const footRows = [];

    if (record.delta_totals.length) {
      footRows.push(
        <tr key="total-heading">
          <th className={`${classes.cell} ${classes.headCell}`}
            colSpan={2 + layout.columnsAfterGraphic}
          >
            Total
          </th>
        </tr>
      );
    }

    record.delta_totals.forEach((row, totalIndex) => {
      const {
        currency,
        loop_id,
        vault,
        wallet,
      } = row;
      const totalCells = [];
      const fmt = getCurrencyDeltaFormatter(currency);

      totalCells.push(<td className={labelCell} key="label"></td>);
      totalCells.push(<td className={labelCell} key="graphic"></td>);

      if (layout.showVault) {
        if (vault && vault !== '0') {
          totalCells.push(
            <td className={numCell} key="vault">
              <strong>
                {fmt(vault)} {currency}
              </strong>
            </td>
          );
        } else {
          totalCells.push(<td className={numCell} key="vault"></td>);
        }
      }

      if (wallet && wallet !== '0') {
        totalCells.push(
          <td className={numCell} key="wallet">
            <strong>
              {fmt(wallet)} {currency}
            </strong>
          </td>
        );
      } else {
        totalCells.push(<td className={numCell} key="wallet"></td>);
      }

      if (layout.showOtherAmount) {
        totalCells.push(<td className={labelCell} key="other_amount"></td>);
      }

      totalCells.push(
        <td className={labelCell} key="design">
          {this.renderLoopTitle(loop_id)}
        </td>);

      totalCells.push(<td className={labelCell} key="rest" colSpan="4"></td>);

      footRows.push(
        <tr key={`total-${totalIndex}`}>
          {totalCells}
        </tr>
      );
    });

    return <tfoot>{footRows}</tfoot>;
  }

  render() {
    const {classes} = this.props;

    const layout = this.getLayout();
    return (
      <div>
        <table className={classes.table}>
          {this.renderHead(layout)}
          {this.renderBody(layout)}
          {this.renderFoot(layout)}
        </table>
      </div>
    );
  }

}


export default compose(
  withStyles(styles),
  connect(),  // Provide the dispatch function
)(TransferMovementTable);
