import { binder, binder1 } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReco } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { FormattedDate } from 'react-intl';
import { getCurrencyFormatter } from '../../util/currency';
import { getPagerState } from '../../reducer/pager';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import CircularProgress from '@material-ui/core/CircularProgress';
import LayoutConfig from '../app/LayoutConfig';
import Pager from '../../util/Pager';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import Typography from '@material-ui/core/Typography';
import CheckBox from '@material-ui/icons/CheckBox';
import CheckBoxOutlineBlank from '@material-ui/icons/CheckBoxOutlineBlank';


const tableWidth = 800;


const styles = {
  root: {
    fontSize: '0.9rem',
    padding: '0 16px',
  },
  pagerPaper: {
    margin: '16px auto',
    maxWidth: tableWidth - 16,
    padding: '8px',
  },
  tablePaper: {
    margin: '16px auto',
    maxWidth: tableWidth,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    color: '#000',
  },
  titleCell: {
    border: '1px solid #bbb',
    padding: '4px 8px',
    fontWeight: 'normal',
    backgroundColor: '#ddd',
  },
  headCell: {
    border: '1px solid #bbb',
    padding: '4px 8px',
    backgroundColor: '#eee',
  },
  headCellLeft: {
    borderLeft: '4px solid #bbb',
    borderRight: '1px solid #bbb',
    borderTop: '1px solid #bbb',
    borderBottom: '1px solid #bbb',
    padding: '4px 8px',
    backgroundColor: '#eee',
  },
  headCellRight: {
    borderRight: '4px solid #bbb',
    borderLeft: '1px solid #bbb',
    borderTop: '1px solid #bbb',
    borderBottom: '1px solid #bbb',
    padding: '4px 8px',
    backgroundColor: '#eee',
  },
  headCellLeftRight: {
    borderLeft: '4px solid #bbb',
    borderRight: '4px solid #bbb',
    borderTop: '1px solid #bbb',
    borderBottom: '1px solid #bbb',
    padding: '4px 8px',
    backgroundColor: '#eee',
  },
  cell: {
    border: '1px solid #bbb',
    padding: '4px 8px',
  },
  cellLeft: {
    borderLeft: '4px solid #bbb',
    borderRight: '1px solid #bbb',
    borderTop: '1px solid #bbb',
    borderBottom: '1px solid #bbb',
    padding: '4px 8px',
  },
  cellRight: {
    borderRight: '4px solid #bbb',
    borderLeft: '1px solid #bbb',
    borderTop: '1px solid #bbb',
    borderBottom: '1px solid #bbb',
    padding: '4px 8px',
  },
  cellLeftRight: {
    borderLeft: '4px solid #bbb',
    borderRight: '4px solid #bbb',
    borderTop: '1px solid #bbb',
    borderBottom: '1px solid #bbb',
    padding: '4px 8px',
  },
  center: {
    textAlign: 'center',
  },
  right: {
    textAlign: 'right',
  },
  amountCell: {
    border: '1px solid #bbb',
    textAlign: 'right',
    padding: '4px 8px',
  },
  periodRow: {
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#eee',
    },
  },
  periodSelectedRow: {
    backgroundColor: '#ffe',
  },
  checkbox: {
    display: 'block',
    margin: '0 auto',
  },
};


class PeriodsView extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    contentURL: PropTypes.string,
    content: PropTypes.object,
    loading: PropTypes.bool,
    ploop: PropTypes.object,
    pagerName: PropTypes.string.isRequired,
    initialRowsPerPage: PropTypes.number.isRequired,
    period: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
    this.binder1 = binder1(this);
  }

  handleClickPeriod(periodId) {
    this.props.history.push('/period/' + periodId);
  }

  renderTableBody(showCirc) {
    const {
      classes,
      content,
      ploop,
      period: selectedPeriod,
    } = this.props;

    const cfmt = new getCurrencyFormatter(ploop.currency);
    const rows = [];
    const ccStartDate = classes.cell;
    const ccEndDate = classes.cellRight;
    const ccStartCirc = `${classes.cellLeft} ${classes.right}`;
    const ccEndCirc = `${classes.cellRight} ${classes.right}`;
    const ccStartCombined = `${classes.cellLeft} ${classes.right}`;
    const ccEndCombined = `${classes.cellRight} ${classes.right}`;
    const ccStatements = `${classes.cellLeft} ${classes.right}`;
    const ccClosed = `${classes.cell} ${classes.center}`;
    const cCheckbox = classes.checkbox;

    content.periods.forEach(period => {
      let rowClass = classes.periodRow;
      if (selectedPeriod && period.period_id === selectedPeriod.period_id) {
        rowClass += ' ' + classes.periodSelectedRow;
      }

      rows.push(
        <tr
          key={period.period_id}
          data-period-id={period.period_id}
          className={rowClass}
          onClick={this.binder1(this.handleClickPeriod, period.period_id)}
        >
          <td className={ccStartDate} width="14%">
            {period.start_date ?
              <FormattedDate value={period.start_date}
                day="numeric" month="short" year="numeric"
                timeZone="UTC" />
              : 'Initial'}
          </td>
          <td className={ccEndDate} width="14%">
            {period.end_date ?
              <FormattedDate value={period.end_date}
                day="numeric" month="short" year="numeric"
                timeZone="UTC" />
              : 'In progress'}
          </td>
          {showCirc ?
            <td className={ccStartCirc} width="12%">
              {cfmt(period.start_circ)}
            </td>
            : null}
          {showCirc ?
            <td className={ccEndCirc} width="12%">
              {cfmt(period.end_circ)}
            </td>
            : null}
          <td className={ccStartCombined} width="12%">
            {cfmt(period.start_combined)}
          </td>
          <td className={ccEndCombined} width="12%">
            {period.end_combined ? cfmt(period.end_combined) : 'In progress'}
          </td>
          <td className={ccStatements} width="12%" title="Statements">
            {period.statement_count}
          </td>
          <td className={ccClosed} width="12%">
            {period.closed ?
              <CheckBox className={cCheckbox}/> :
              <CheckBoxOutlineBlank className={cCheckbox} />}
          </td>
        </tr>
      );
    });

    return <tbody>{rows}</tbody>;
  }

  renderTable() {
    const {
      classes,
      ploop,
    } = this.props;

    const {currency, loop_id} = ploop;

    let circHead0 = null;
    let circHead1 = null;
    let columnCount;

    const showCirc = (ploop.peer_id === 'c');

    if (showCirc) {
      columnCount = 8;
      circHead0 = (
        <td colSpan="2" className={`${classes.headCellLeftRight} ${classes.center}`}>Circulation</td>
      );
      circHead1 = (
        <React.Fragment>
          <td className={`${classes.headCellLeft} ${classes.right}`}>Start</td>
          <td className={`${classes.headCellRight} ${classes.right}`}>End</td>
        </React.Fragment>
      );
    } else {
      columnCount = 6;
    }

    const headRow0 = (
      <tr>
        <td colSpan="2" className={`${classes.headCellRight} ${classes.center}`}>Date</td>
        {circHead0}
        <td colSpan="2" className={`${classes.headCellLeftRight} ${classes.center}`}>Balance</td>
        <td className={`${classes.headCellLeft} ${classes.center}`}>Statements</td>
        <td className={`${classes.headCell} ${classes.center}`}>Closed</td>
      </tr>
    );

    const headRow1 = (
      <tr>
        <td className={classes.headCell}>Start</td>
        <td className={classes.headCellRight}>End</td>
        {circHead1}
        <td className={`${classes.headCellLeft} ${classes.right}`}>Start</td>
        <td className={`${classes.headCellRight} ${classes.right}`}>End</td>
        <td className={`${classes.headCellLeft} ${classes.center}`}></td>
        <td className={`${classes.headCell} ${classes.center}`}></td>
      </tr>
    );

    return (
      <Paper className={classes.tablePaper}>
        <table className={classes.table}>
          <thead>
            <tr>
              <th className={classes.titleCell} colSpan={columnCount}>
                {ploop.peer_title} Reconciliation Periods
                <div>
                  {currency}
                  {' '}{loop_id === '0' ? 'Open Loop' : ploop.loop_title}
                  {' - '}
                  <FormattedDate
                    value={new Date()}
                    day="numeric" month="short" year="numeric" />
                </div>
              </th>
            </tr>
            {headRow0}
            {headRow1}
          </thead>
          {this.renderTableBody(showCirc)}
        </table>
      </Paper>
    );
  }

  render() {
    const {
      classes,
      contentURL,
      content,
      loading,
      pagerName,
      initialRowsPerPage,
    } = this.props;

    if (!contentURL) {
      // No peer loop selected.
      return null;
    }

    let pageContent, rowcount;

    if (!content) {
      rowcount = null;
      if (loading) {
        pageContent = (
          <div className={classes.root}>
            <Paper className={classes.tablePaper}
              style={{textAlign: 'center', }}
            >
              <CircularProgress style={{padding: '16px'}} />
            </Paper>
            <div style={{height: 1}}></div>
          </div>);
      } else {
        pageContent = null;
      }
    } else {
      rowcount = content.rowcount;
      pageContent = this.renderTable();
    }

    return (
      <Typography className={classes.root} component="div">
        <LayoutConfig title="Periods" />
        <Require fetcher={fOPNReco} urls={[contentURL]} />
        <Paper className={classes.pagerPaper}>
          <Pager
            name={pagerName}
            initialRowsPerPage={initialRowsPerPage}
            rowcount={rowcount} />
        </Paper>
        {pageContent}
        <div style={{height: 1}}></div>
      </Typography>
    );
  }
}


function mapStateToProps(state, ownProps) {
  const pagerName = 'PeriodsView';
  const {ploop} = ownProps;
  const {
    rowsPerPage,
    pageIndex,
    initialRowsPerPage,
  } = getPagerState(state, pagerName, 10);

  if (ploop) {
    const contentURL = fOPNReco.pathToURL(
      `/period-list?ploop_key=${encodeURIComponent(ploop.ploop_key)}` +
      `&offset=${encodeURIComponent(pageIndex * rowsPerPage)}` +
      `&limit=${encodeURIComponent(rowsPerPage || 'none')}`);
    const content = fetchcache.get(state, contentURL);
    const loading = fetchcache.fetching(state, contentURL);
    const loadError = !!fetchcache.getError(state, contentURL);
    return {
      contentURL,
      content,
      loading,
      loadError,
      pagerName,
      initialRowsPerPage,
    };
  } else {
    return {
      pagerName,
      initialRowsPerPage,
    };
  }
}


export default compose(
  withStyles(styles),
  withRouter,
  connect(mapStateToProps),
)(PeriodsView);
