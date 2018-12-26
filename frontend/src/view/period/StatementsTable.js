
import { binder1 } from '../../util/binder';
import { compose } from '../../util/functional';
import { FormattedDate } from 'react-intl';
import { getCurrencyFormatter } from '../../util/currency';
import { renderReportDate } from '../../util/reportrender';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import CircularProgress from '@material-ui/core/CircularProgress';
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
  clickableRow: {
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#eee',
    },
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
  textCell: {
    textAlign: 'left',
    padding: '4px 8px',
    border: '1px solid #bbb',
  },
  columnHeadCell: {
    fontWeight: 'normal',
    textAlign: 'left',
    padding: '4px 8px',
    border: '1px solid #bbb',
  },
  link: {
    display: 'block',
  },
};


class StatementsTable extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    history: PropTypes.object.isRequired,
    now: PropTypes.string,
    period: PropTypes.object,
    ploop: PropTypes.object,
    statements: PropTypes.array,
  };

  constructor(props) {
    super(props);
    this.binder1 = binder1(this);
  }

  handleClick(path, event) {
    if (event.button === 0) {
      event.preventDefault();
      this.props.history.push(path);
    }
  }

  render() {
    const {
      classes,
      now,
      period,
      ploop,
      statements,
    } = this.props;

    const colCount = 8;
    let rows = null;
    const encPeriodId = encodeURIComponent(period.id);

    if (statements && statements.length) {
      const cfmt = new getCurrencyFormatter(period.currency);
      rows = statements.map(statement => {
        const path = (
          `/period/${encPeriodId}` +
          `/statement/${encodeURIComponent(statement.id)}`);

        return (
          <tr key={statement.id}
            onClick={this.binder1(this.handleClick, path)}
            className={classes.clickableRow}
          >
            <td className={classes.textCell}>
              {statement.id}
            </td>
            <td className={classes.textCell}>
              {statement.source}
            </td>
            <td className={classes.textCell}>
              {statement.start_date ?
                <FormattedDate value={statement.start_date}
                  day="numeric" month="short" year="numeric"
                  timeZone="UTC" /> : null}
            </td>
            <td className={classes.textCell}>
              {statement.end_date ?
                <FormattedDate value={statement.end_date}
                  day="numeric" month="short" year="numeric"
                  timeZone="UTC" /> : null}
            </td>
            <td className={classes.amountCell}>
              {statement.inc_count}
            </td>
            <td className={classes.amountCell}>
              {cfmt(statement.inc_total)}
            </td>
            <td className={classes.amountCell}>
              {statement.dec_count}
            </td>
            <td className={classes.amountCell}>
              {cfmt(statement.dec_total)}
            </td>
          </tr>
        );
      });
    } else if (statements && !statements.length) {
      rows = (
        <tr>
          <td colSpan={colCount} className={classes.textCell}>
            <em>No account statements have been added to this period.</em>
          </td>
        </tr>
      );
    } else {
      rows = (
        <tr>
          <td colSpan={colCount} className={classes.textCell}>
            <CircularProgress size="24px" className={classes.progress} />
          </td>
        </tr>
      );
    }

    const reportDate = now ? renderReportDate(period, now) : null;
    const {peer_title, currency, loop_id, loop_title} = ploop;

    return (
      <Typography className={classes.root} component="div">
        <table className={classes.table}>
          <thead>
            <tr>
              <th className={classes.headCell}
                colSpan={colCount}
              >
                {peer_title} Account Statements
                <div>
                  {currency}
                  {' '}{loop_id === '0' ? 'Open Loop' : loop_title}
                  {' - '}{reportDate}
                </div>
              </th>
            </tr>
            <tr>
              <th className={classes.columnHeadCell}>ID</th>
              <th className={classes.columnHeadCell}>Source</th>
              <th className={classes.columnHeadCell}>Start Date</th>
              <th className={classes.columnHeadCell}>End Date</th>
              <th className={classes.columnHeadCell}>Increases</th>
              <th className={classes.columnHeadCell}>Increases Total</th>
              <th className={classes.columnHeadCell}>Decreases</th>
              <th className={classes.columnHeadCell}>Decreases Total</th>
            </tr>
          </thead>
          <tbody>
            {rows}
          </tbody>
        </table>
      </Typography>
    );
  }
}

export default compose(
  withStyles(styles),
  withRouter,
)(StatementsTable);
