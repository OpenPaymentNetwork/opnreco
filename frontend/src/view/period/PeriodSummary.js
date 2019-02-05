
import { getCurrencyFormatter } from '../../util/currency';
import { withStyles } from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import React from 'react';
import Typography from '@material-ui/core/Typography';

const styles = {
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    color: '#000',
    fontSize: '0.9rem',
  },
  headCell: {
    padding: '4px 8px',
    fontWeight: 'normal',
    backgroundColor: '#ddd',
    border: '1px solid #bbb',
  },
  amountCell: {
    textAlign: 'right',
    padding: '4px 8px',
    border: '1px solid #bbb',
  },
  totalCell: {
    textAlign: 'right',
    padding: '4px 8px',
    border: '1px solid #bbb',
    fontWeight: 'bold',
  },
  maskedCell: {
    textAlign: 'right',
    padding: '4px 8px',
    border: '1px solid #bbb',
    opacity: '0.5',
  },
  columnHeadCell: {
    fontWeight: 'normal',
    textAlign: 'right',
    padding: '4px 8px',
    border: '1px solid #bbb',
  },
  rowHeadCell: {
    fontWeight: 'normal',
    textAlign: 'left',
    padding: '4px 8px',
    border: '1px solid #bbb',
  },
};


class PeriodSummary extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    result: PropTypes.object,
  };

  render() {
    const {
      classes,
      result: {
        period,
        totals,
        counts,
      },
    } = this.props;

    const showCirc = (period.peer_id === 'c');
    const columnCount = showCirc ? 6 : 4;

    const cfmt = new getCurrencyFormatter(period.currency);

    const getAmountColumns = (rowname, options) => {
      let cellClass = classes.amountCell;
      if (options && options.cellClass) {
        cellClass = options.cellClass;
      }

      let totalClass = cellClass;
      if (options && options.totalClass) {
        totalClass = options.totalClass;
      }

      if (showCirc) {
        return (
          <React.Fragment>
            <td className={cellClass}>
              {cfmt(totals[rowname].circ)}
            </td>
            <td className={cellClass}>
              {cfmt(totals[rowname].surplus)}
            </td>
            <td className={totalClass}>
              {cfmt(totals[rowname].combined)}
            </td>
          </React.Fragment>
        );
      } else {
        return (
          <td className={totalClass}>
            {cfmt(totals[rowname].combined)}
          </td>
        );
      }
    };

    return (
      <Typography className={classes.root} component="div">
        <table className={classes.table}>
          <thead>
            <tr>
              <th className={classes.headCell}
                colSpan={columnCount}>Period Summary</th>
            </tr>
            <tr>
              <th className={classes.columnHeadCell}></th>
              {showCirc ?
                <React.Fragment>
                  <th className={classes.columnHeadCell}>Circulation</th>
                  <th className={classes.columnHeadCell}>Surplus/Deficit</th>
                  <th className={classes.columnHeadCell}>Combined</th>
                </React.Fragment>
                : <th className={classes.columnHeadCell}>Amount</th>
              }
              <th className={classes.columnHeadCell}>Account Entries</th>
              <th className={classes.columnHeadCell}>OPN Movements</th>
            </tr>
          </thead>
          <tbody>

            <tr>
              <td className={classes.rowHeadCell}>
                Start Balance
              </td>
              {getAmountColumns('start')}
              <td className={classes.amountCell}></td>
              <td className={classes.amountCell}></td>
            </tr>

            <tr>
              <td className={classes.rowHeadCell}>
                Internally Reconciled
              </td>
              {getAmountColumns('internal_reconciled_delta')}
              <td className={classes.amountCell}>
              </td>
              <td className={classes.amountCell}>
                {counts.internal_movements_reconciled}
              </td>
            </tr>

            <tr>
              <td className={classes.rowHeadCell}>
                Externally Reconciled
              </td>
              {getAmountColumns('external_reconciled_delta')}
              <td className={classes.amountCell}>
                {counts.account_entries_reconciled}
              </td>
              <td className={classes.amountCell}>
                {counts.external_movements_reconciled}
              </td>
            </tr>

            <tr>
              <td className={classes.rowHeadCell}>
                Start + Reconciled
              </td>
              {getAmountColumns('reconciled_total', {
                totalClass: classes.totalCell})}
              <td className={classes.amountCell}></td>
              <td className={classes.amountCell}></td>
            </tr>

            <tr>
              <td className={classes.rowHeadCell}>
                Unreconciled OPN Movements
              </td>
              {getAmountColumns('unreco_movements_delta')}
              <td className={classes.amountCell}>
              </td>
              <td className={classes.amountCell}>
                {counts.movements_unreconciled}
              </td>
            </tr>

            <tr>
              <td className={classes.rowHeadCell}>
                Unreconciled Account Entries
              </td>
              {getAmountColumns(
                'unreco_entries_delta', {cellClass: classes.maskedCell})}
              <td className={classes.amountCell}>
                {counts.account_entries_unreconciled}
              </td>
              <td className={classes.amountCell}>
              </td>
            </tr>

            <tr>
              <td className={classes.rowHeadCell}>
                End Balance
              </td>
              {getAmountColumns('end', {totalClass: classes.totalCell})}
              <td className={classes.amountCell}></td>
              <td className={classes.amountCell}></td>
            </tr>

          </tbody>
        </table>
      </Typography>
    );
  }
}

export default withStyles(styles)(PeriodSummary);
