
import { compose } from '../../util/functional';
import { getCurrencyFormatter } from '../../util/currency';
import { renderReportDate } from '../../util/reportrender';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import Add from '@material-ui/icons/Add';
import CircularProgress from '@material-ui/core/CircularProgress';
import Fab from '@material-ui/core/Fab';
import PropTypes from 'prop-types';
import React from 'react';
import StatementAddDialog from './StatementAddDialog';
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
  addCell: {
    padding: '16px',
    border: '1px solid #bbb',
    textAlign: 'right',
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
    this.state = {};
  }

  handleClick = (event, path) => {
    if (event.button === 0) {
      event.preventDefault();
      this.props.history.push(path);
    }
  }

  handleAddButton = () => {
    this.setState({dialogExists: true, dialogOpen: true});
  }

  handleCancelAdd = () => {
    this.setState({dialogOpen: false});
  }

  render() {
    const {
      classes,
      now,
      period,
      ploop,
      statements,
    } = this.props;

    const colCount = 7;
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
            onClick={(event) => this.handleClick(event, path)}
            className={classes.clickableRow}
          >
            <td className={classes.textCell}>
              {statement.id}
            </td>
            <td className={classes.textCell}>
              {statement.source}
            </td>
            <td className={classes.textCell}>
              {statement.filename}
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
      rows = [
        <tr key="empty">
          <td colSpan={colCount} className={classes.textCell}>
            <em>No account statements have been added to this period.</em>
          </td>
        </tr>
      ];
    } else {
      rows = [
        <tr key="loading">
          <td colSpan={colCount} className={classes.textCell}>
            <CircularProgress size="24px" className={classes.progress} />
          </td>
        </tr>
      ];
    }

    if (statements && !period.closed) {
      rows.push(
        <tr key="add">
          <td colSpan={colCount} className={classes.addCell}>
            <Fab size="small" color="primary" aria-label="Add a statement"
              onClick={this.handleAddButton}>
              <Add />
            </Fab>
          </td>
        </tr>
      );
    }

    const reportDate = now ? renderReportDate(period, now) : null;
    const {peer_title, currency, loop_id, loop_title} = ploop;

    let dialog = null;

    if (this.state.dialogExists) {
      dialog = (
        <StatementAddDialog
          open={this.state.dialogOpen}
          onCancel={this.handleCancelAdd}
        />
      );
    }

    return (
      <Typography className={classes.root} component="div">
        {dialog}
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
              <th className={classes.columnHeadCell}>File Name</th>
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
