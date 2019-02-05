import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReco, ploopsURL } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { FormattedDate } from 'react-intl';
import { getCurrencyFormatter } from '../../util/currency';
import { getPagerState } from '../../reducer/pager';
import { isSimpleClick } from '../../util/click';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import Add from '@material-ui/icons/Add';
import CircularProgress from '@material-ui/core/CircularProgress';
import Fab from '@material-ui/core/Fab';
import LayoutConfig from '../app/LayoutConfig';
import Lock from '@material-ui/icons/Lock';
import LockOpen from '@material-ui/icons/LockOpen';
import OPNAppBar from '../app/OPNAppBar';
import Pager from '../../util/Pager';
import Paper from '@material-ui/core/Paper';
import PeriodForm from './PeriodForm';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
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
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#eee',
    },
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
  addCell: {
    padding: '16px',
    border: '1px solid #bbb',
    textAlign: 'right',
  },
  addFormCell: {
    padding: '16px',
    border: '1px solid #bbb',
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
    this.state = {};
  }

  handleClickAnchor = (event, path) => {
    if (isSimpleClick(event)) {
      event.preventDefault();
      this.props.history.push(path);
    }
  }

  handleClickCell = (path) => {
    this.props.history.push(path);
  }

  handleAddButton = () => {
    this.setState({adding: true});
  }

  handleAddClose = () => {
    this.setState({adding: false});
  }

  renderTableBody(showCirc, columnCount) {
    const {
      classes,
      content,
      dispatch,
      ploop,
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
    const ccClosed = `${classes.cell}`;
    const cIcon = classes.cellIcon;

    for (const period of content.periods) {
      const reportsPath = `/period/${encodeURIComponent(period.id)}/reco`;
      const closedPath = `/period/${encodeURIComponent(period.id)}/overview`;

      const onClickCell = () => {
        this.handleClickCell(reportsPath);
      };

      const onClickClosedCell = () => {
        this.handleClickCell(closedPath);
      };

      rows.push(
        <tr
          key={period.id}
          data-period-id={period.id}
          className={classes.periodRow}
        >
          <td className={ccStartDate} width="15%" onClick={onClickCell}>
            {period.start_date ?
              <FormattedDate value={period.start_date}
                day="numeric" month="short" year="numeric"
                timeZone="UTC" />
              : 'Initial'}
          </td>
          <td className={ccEndDate} width="15%" onClick={onClickCell}>
            {period.end_date ?
              <FormattedDate value={period.end_date}
                day="numeric" month="short" year="numeric"
                timeZone="UTC" />
              : 'In progress'}
          </td>
          {showCirc ?
            <td className={ccStartCirc} width="10%" onClick={onClickCell}>
              {cfmt(period.start_circ)}
            </td>
            : null}
          {showCirc ?
            <td className={ccEndCirc} width="10%" onClick={onClickCell}>
              {cfmt(period.end_circ)}
            </td>
            : null}
          <td className={ccStartCombined} width="10%" onClick={onClickCell}>
            {cfmt(period.start_combined)}
          </td>
          <td className={ccEndCombined} width="10%" onClick={onClickCell}>
            {period.end_combined ? cfmt(period.end_combined) : 'In progress'}
          </td>
          <td className={ccStatements} width="10%" onClick={onClickCell}>
            {period.statement_count}
          </td>
          <td className={ccClosed} width="10%" onClick={onClickClosedCell}>
            {period.closed ?
              <span title="Closed"><Lock className={cIcon}/></span> :
              <span title="Open"><LockOpen className={cIcon} /></span>}
          </td>
        </tr>
      );
    }

    if (this.state.adding) {
      rows.push(
        <tr key="add">
          <td colSpan={columnCount} className={classes.addFormCell}>
            <PeriodForm
              add
              dispatch={dispatch}
              onClose={this.handleAddClose}
              ploopKey={ploop.ploop_key}
              period={{
                id: 'add',
                pull: true,
                start_date: content.next_start_date,
              }} />
          </td>
        </tr>
      );
    } else {
      rows.push(
        <tr key="add">
          <td colSpan={columnCount} className={classes.addCell}>
            <Fab size="small" color="primary" aria-label="Add a period"
              onClick={this.handleAddButton}>
              <Add />
            </Fab>
          </td>
        </tr>
      );
    }

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
          {this.renderTableBody(showCirc, columnCount)}
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
  } = getPagerState(state, pagerName, 100);

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
