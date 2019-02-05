
import { compose } from '../../util/functional';
import { dashed } from '../../util/transferfmt';
import { FormattedDate, FormattedTime } from 'react-intl';
import { getCurrencyDeltaFormatter } from '../../util/currency';
import { isSimpleClick } from '../../util/click';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import React from 'react';
import RecoTableBody from './RecoTableBody';


const styles = {
  head2Cell: {
    backgroundColor: '#eee',
    border: '1px solid #bbb',
    fontWeight: 'normal',
  },
  numberCell: {
    border: '1px solid #bbb',
    padding: '2px 8px',
    textAlign: 'right',
  },
  candidateCell: {
    backgroundColor: '#ffc',
    border: '1px solid #bbb',
    padding: '2px 8px',
    textAlign: 'right',
  },
};


/**
 * Render the tbody in a RecoPopover that shows wallet/vault movements.
 */
class MovementTableBody extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    closeDialog: PropTypes.func.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    movements: PropTypes.array,
    changeMovements: PropTypes.func.isRequired,
    showVault: PropTypes.bool,
    windowPeriodId: PropTypes.string.isRequired,
  };

  handleClickTransfer = (event, path) => {
    if (isSimpleClick(event)) {
      event.preventDefault();
      this.props.closeDialog();
      this.props.history.push(path);
    }
  }

  renderItemCells = (movement, addCandidate) => {
    const {classes, showVault, windowPeriodId} = this.props;
    const encPeriodId = encodeURIComponent(windowPeriodId);
    const tid = dashed(movement.transfer_id);
    const transferPath = (
      `/period/${encPeriodId}/t/${encodeURIComponent(tid)}`);
    const cellClass = (
      addCandidate ? classes.candidateCell : classes.numberCell);

    let vaultCell;
    if (showVault) {
      if (movement.vault_delta && movement.vault_delta !== '0') {
        vaultCell = (
          <td className={cellClass}>
            {getCurrencyDeltaFormatter(movement.currency)(movement.vault_delta)
            } {movement.currency}
          </td>
        );
      } else {
        vaultCell = <td className={cellClass}></td>;
      }
    } else {
      vaultCell = null;
    }

    let walletCell;
    if (movement.wallet_delta && movement.wallet_delta !== '0') {
      walletCell = (
        <td className={cellClass}>
          {getCurrencyDeltaFormatter(movement.currency)(movement.wallet_delta)
          } {movement.currency}
        </td>
      );
    } else {
      walletCell = <td className={cellClass}></td>;
    }

    return (
      <React.Fragment>
        {vaultCell}
        {walletCell}
        <td className={cellClass} title={movement.ts}>
          <FormattedDate value={movement.ts}
            day="numeric" month="short" year="numeric" />
          {' '}
          <FormattedTime value={movement.ts}
            hour="numeric" minute="2-digit" second="2-digit" />
        </td>
        <td className={cellClass}>
          <a href={transferPath}
            onClick={(event) => this.handleClickTransfer(event, transferPath)}
          >
            {tid} ({movement.number})
          </a>
        </td>
      </React.Fragment>
    );
  }

  render() {
    const {
      classes,
      dispatch,
      movements,
      changeMovements,
      showVault,
      ...otherProps
    } = this.props;

    let columnHeadRow;

    if (showVault) {
      columnHeadRow = (
        <tr key="head2">
          <th width="10%" className={classes.head2Cell}></th>
          <th width="15%" className={classes.head2Cell}>Vault</th>
          <th width="15%" className={classes.head2Cell}>Wallet</th>
          <th width="25%" className={classes.head2Cell}>Date and Time</th>
          <th width="35%" className={classes.head2Cell}>Transfer (Movement #)</th>
        </tr>);
    } else {
      columnHeadRow = (
        <tr key="head2">
          <th width="10%" className={classes.head2Cell}></th>
          <th width="15%" className={classes.head2Cell}>Wallet</th>
          <th width="25%" className={classes.head2Cell}>Date and Time</th>
          <th width="50%" className={classes.head2Cell}>Transfer (Movement #)</th>
        </tr>);
    }

    return (
      <RecoTableBody
        dispatch={dispatch}
        items={movements}
        changeItems={changeMovements}
        showVault={showVault}
        renderItemCells={this.renderItemCells}
        searchFields={[
          {name: 'amount', colSpan: showVault ? 2 : 1},
          {name: 'date'},
          {name: 'transfer'},
        ]}
        searchView="reco-search-movement"
        tableTitle="Note Possession Changes (Movements)"
        columnHeadRow={columnHeadRow}
        emptyMessage="No eligible movements found."
        {...otherProps}
      />);
  }
}

export default compose(
  withStyles(styles),
  withRouter,
)(MovementTableBody);
