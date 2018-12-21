import { binder, binder1 } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReco, ploopsURL } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { FormattedDate } from 'react-intl';
import { getCurrencyFormatter } from '../../util/currency';
import { getPagerState } from '../../reducer/pager';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import CheckBox from '@material-ui/icons/CheckBox';
import CheckBoxOutlineBlank from '@material-ui/icons/CheckBoxOutlineBlank';
import CircularProgress from '@material-ui/core/CircularProgress';
import LayoutConfig from '../app/LayoutConfig';
import OPNAppBar from '../app/OPNAppBar';
import Pager from '../../util/Pager';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import Link from '@material-ui/icons/Link';
import Typography from '@material-ui/core/Typography';


const tableWidth = 800;


const styles = {
  root: {
  },
  content: {
    fontSize: '0.9rem',
  },
  pagerPaper: {
    margin: '16px auto',
    maxWidth: tableWidth,
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
  },
  periodSelectedRow: {
    backgroundColor: '#ffe',
  },
  clickableCell: {
    color: '#000',
    display: 'block',
    textAlign: 'center',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#ddd',
    },
  },
  cellIcon: {
    display: 'block',
    margin: '0 auto',
  },
};


class PeriodList extends React.Component {
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

  handleClickAnchor(path, event) {
    if (event.button === 0) {
      event.preventDefault();
      this.props.history.push(path);
    }
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
    const ccReports = `${classes.cell} ${classes.right}`;
    const ccClosed = `${classes.cell}`;
    const clickableCell = classes.clickableCell;
    const cIcon = classes.cellIcon;

    content.periods.forEach(period => {
      let rowClass = classes.periodRow;
      if (selectedPeriod && period.id === selectedPeriod.id) {
        rowClass += ' ' + classes.periodSelectedRow;
      }

      const reportsPath = `/period/${encodeURIComponent(period.id)}/reco`;
      const closedPath = `/period/${encodeURIComponent(period.id)}/overview`;

      rows.push(
        <tr
          key={period.id}
          data-period-id={period.id}
          className={rowClass}
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
            <td className={ccStartCirc} width="10%">
              {cfmt(period.start_circ)}
            </td>
            : null}
          {showCirc ?
            <td className={ccEndCirc} width="10%">
              {cfmt(period.end_circ)}
            </td>
            : null}
          <td className={ccStartCombined} width="10%">
            {cfmt(period.start_combined)}
          </td>
          <td className={ccEndCombined} width="10%">
            {period.end_combined ? cfmt(period.end_combined) : 'In progress'}
          </td>
          <td className={ccStatements} width="8%">
            {period.statement_count}
          </td>
          <td className={ccReports} width="8%">
            <a
              className={clickableCell}
              href={reportsPath}
              onClick={this.binder1(this.handleClickAnchor, reportsPath)}
            >
              <Link className={cIcon} />
            </a>
          </td>
          <td className={ccClosed} width="8%">
            <a
              className={clickableCell}
              href={closedPath}
              onClick={this.binder1(this.handleClickAnchor, closedPath)}
            >
              {period.closed ?
                <CheckBox className={cIcon}/> :
                <CheckBoxOutlineBlank className={cIcon} />}
            </a>
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
      columnCount = 9;
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
      columnCount = 7;
    }

    const headRow0 = (
      <tr>
        <td colSpan="2" className={`${classes.headCellRight} ${classes.center}`}>Date</td>
        {circHead0}
        <td colSpan="2" className={`${classes.headCellLeftRight} ${classes.center}`}>Balance</td>
        <td className={`${classes.headCellLeft} ${classes.center}`}>Statements</td>
        <td className={`${classes.headCell} ${classes.center}`}>Reports</td>
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
        <td className={`${classes.headCell}`}></td>
        <td className={`${classes.headCell}`}></td>
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
      <div className={classes.root}>
        <LayoutConfig title="Reconciliation Periods" />
        <Require fetcher={fOPNReco} urls={[contentURL, ploopsURL]} />

        <OPNAppBar />

        <Paper className={classes.pagerPaper}>
          <Pager
            name={pagerName}
            initialRowsPerPage={initialRowsPerPage}
            rowcount={rowcount} />
        </Paper>
        <Typography className={classes.content} component="div">
          {pageContent}
        </Typography>
        <div style={{height: 1}}></div>
      </div>
    );
  }
}


function mapStateToProps(state, ownProps) {
  const {ploopKey} = ownProps.match.params;
  const pagerName = 'PeriodsView';
  const {
    rowsPerPage,
    pageIndex,
    initialRowsPerPage,
  } = getPagerState(state, pagerName, 10);

  const contentURL = fOPNReco.pathToURL(
    `/period-list?ploop_key=${encodeURIComponent(ploopKey)}` +
    `&offset=${encodeURIComponent(pageIndex * rowsPerPage)}` +
    `&limit=${encodeURIComponent(rowsPerPage || 'none')}`);
  const content = fetchcache.get(state, contentURL);
  const loading = fetchcache.fetching(state, contentURL);
  const loadError = !!fetchcache.getError(state, contentURL);

  const ploops = (fetchcache.get(state, ploopsURL) || {}).ploops || {};
  const ploop = ploops[ploopKey] || {};

  return {
    contentURL,
    content,
    loading,
    loadError,
    pagerName,
    initialRowsPerPage,
    ploop,
  };
}


export default compose(
  withStyles(styles),
  withRouter,
  connect(mapStateToProps),
)(PeriodList);
