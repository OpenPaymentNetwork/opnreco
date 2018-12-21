
import { binder1 } from '../../util/binder';
import { compose } from '../../util/functional';
import { FormattedDate } from 'react-intl';
import { getCurrencyFormatter } from '../../util/currency';
import { withRouter } from 'react-router';
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


class PeriodStatementList extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    history: PropTypes.object.isRequired,
    result: PropTypes.object,
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
      result: {
        period,
        statements,
      },
    } = this.props;

    const cfmt = new getCurrencyFormatter(period.currency);
    const colCount = 7;

    let rows = null;

    if (statements && statements.length) {
      rows = statements.map(statement => {
        const path = `/statement/${encodeURIComponent(statement.id)}`;

        return (
          <tr key={statement.id}>
            <td className={classes.textCell}>
              <a href={path}
                className={classes.link}
                onClick={this.binder1(this.handleClick, path)}
              >
                {statement.source}
              </a>
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
            <em>This period has no account statements.</em>
          </td>
        </tr>
      );
    }

    return (
      <Typography className={classes.root} component="div">
        <table className={classes.table}>
          <thead>
            <tr>
              <th className={classes.headCell}
                colSpan={colCount}>Account Statements</th>
            </tr>
            <tr>
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
)(PeriodStatementList);
