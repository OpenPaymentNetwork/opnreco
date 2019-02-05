
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

    const getAmountColumns = (rowname, strong) => {
      if (showCirc) {
        const combined = cfmt(totals[rowname].combined);
        return (
          <React.Fragment>
            <td className={classes.amountCell}>
              {cfmt(totals[rowname].circ)}
            </td>
            <td className={classes.amountCell}>
              {cfmt(totals[rowname].surplus)}
            </td>
            <td className={classes.amountCell}>
              {strong ? <strong>{combined}</strong> : combined}
            </td>
          </React.Fragment>
        );
      } else {
        return (
          <td className={classes.amountCell}>
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
              {getAmountColumns('start', false)}
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
              {getAmountColumns('reconciled_total', true)}
              <td className={classes.amountCell}></td>
              <td className={classes.amountCell}></td>
            </tr>

            <tr>
              <td className={classes.rowHeadCell}>
                Unreconciled
              </td>
              {getAmountColumns('outstanding_delta')}
              <td className={classes.amountCell}>
                {counts.account_entries_unreconciled}
              </td>
              <td className={classes.amountCell}>
                {counts.movements_unreconciled}
              </td>
            </tr>

            <tr>
              <td className={classes.rowHeadCell}>
                End Balance
              </td>
              {getAmountColumns('end', true)}
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
