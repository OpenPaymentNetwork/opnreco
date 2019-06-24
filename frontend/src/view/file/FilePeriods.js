import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReco, filesURL } from '../../util/fetcher';
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
import Lock from '@material-ui/icons/Lock';
import LockOpen from '@material-ui/icons/LockOpen';
import Pager from '../../util/Pager';
import Paper from '@material-ui/core/Paper';
import PeriodForm from '../period/PeriodForm';
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
  },
  cellLeft: {
    borderLeft: '4px solid #bbb',
    borderRight: '1px solid #bbb',
    borderTop: '1px solid #bbb',
    borderBottom: '1px solid #bbb',
  },
  cellRight: {
    borderRight: '4px solid #bbb',
    borderLeft: '1px solid #bbb',
    borderTop: '1px solid #bbb',
    borderBottom: '1px solid #bbb',
  },
  cellLeftRight: {
    borderLeft: '4px solid #bbb',
    borderRight: '4px solid #bbb',
    borderTop: '1px solid #bbb',
    borderBottom: '1px solid #bbb',
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
    textDecoration: 'none',
    padding: '4px 8px',
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


class FilePeriods extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    contentURL: PropTypes.string.isRequired,
    content: PropTypes.object,
    loading: PropTypes.bool,
    file: PropTypes.object,
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
      file,
    } = this.props;

    const cfmt = new getCurrencyFormatter(file.currency);
    const rows = [];
    const ccClickableCell = classes.clickableCell;
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
      const overviewPath = `/period/${encodeURIComponent(period.id)}/overview`;

      const onClickAnchor = (event) => {
        this.handleClickAnchor(event, reportsPath);
      };

      const onClickOverviewAnchor = (event) => {
        this.handleClickAnchor(event, overviewPath);
      };

      rows.push(
        <tr
          key={period.id}
          data-period-id={period.id}
          className={classes.periodRow}
        >
          <td className={ccStartDate} width="15%">
            <a className={ccClickableCell} href={reportsPath} onClick={onClickAnchor}>
              {period.start_date ?
                <FormattedDate value={period.start_date}
                  day="numeric" month="short" year="numeric"
                  timeZone="UTC" />
                : 'Initial'}
            </a>
          </td>
          <td className={ccEndDate} width="15%">
            <a className={ccClickableCell} href={reportsPath} onClick={onClickAnchor}>
              {period.end_date ?
                <FormattedDate value={period.end_date}
                  day="numeric" month="short" year="numeric"
                  timeZone="UTC" />
                : 'In progress'}
            </a>
          </td>
          {showCirc ?
            <td className={ccStartCirc} width="10%">
              <a className={ccClickableCell} href={reportsPath} onClick={onClickAnchor}>
                {cfmt(period.start_circ)}
              </a>
            </td>
            : null}
          {showCirc ?
            <td className={ccEndCirc} width="10%">
              <a className={ccClickableCell} href={reportsPath} onClick={onClickAnchor}>
                {cfmt(period.end_circ)}
              </a>
            </td>
            : null}
          <td className={ccStartCombined} width="10%">
            <a className={ccClickableCell} href={reportsPath} onClick={onClickAnchor}>
              {cfmt(period.start_combined)}
            </a>
          </td>
          <td className={ccEndCombined} width="10%">
            <a className={ccClickableCell} href={reportsPath} onClick={onClickAnchor}>
              {period.end_combined ? cfmt(period.end_combined) : 'In progress'}
            </a>
          </td>
          <td className={ccStatements} width="10%">
            <a className={ccClickableCell} href={reportsPath} onClick={onClickAnchor}>
              {period.statement_count}
            </a>
          </td>
          <td className={ccClosed} width="10%">
            <a className={ccClickableCell} href={overviewPath} onClick={onClickOverviewAnchor}>
              {period.closed ?
                <span title="Closed"><Lock className={cIcon}/></span> :
                <span title="Open"><LockOpen className={cIcon} /></span>}
            </a>
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
              fileId={file.id}
              history={this.props.history}
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
      file,
    } = this.props;

    let circHead0 = null;
    let circHead1 = null;
    let columnCount;

    const showCirc = file.has_vault;

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
                {file.title} Reconciliation Periods
                <div>
                  {file.currency}
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
      <div>
        <Paper className={classes.pagerPaper}>
          <Require fetcher={fOPNReco} urls={[contentURL, filesURL]} />
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
  const {file} = ownProps;
  const pagerName = 'PeriodsView';
  const {
    rowsPerPage,
    pageIndex,
    initialRowsPerPage,
  } = getPagerState(state, pagerName, 100);

  const contentURL = fOPNReco.pathToURL(
    `/file/${encodeURIComponent(file.id)}/period-list?` +
    `offset=${encodeURIComponent(pageIndex * rowsPerPage)}&` +
    `limit=${encodeURIComponent(rowsPerPage || 'none')}`);
  const content = fetchcache.get(state, contentURL);
  const loading = fetchcache.fetching(state, contentURL);
  const loadError = !!fetchcache.getError(state, contentURL);

  // const files = (fetchcache.get(state, filesURL) || {}).files || {};

  return {
    contentURL,
    content,
    loading,
    loadError,
    pagerName,
    initialRowsPerPage,
    file,
  };
}


export default compose(
  withStyles(styles),
  withRouter,
  connect(mapStateToProps),
)(FilePeriods);
