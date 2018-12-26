
import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReco } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { FormattedDate } from 'react-intl';
import { getCurrencyFormatter } from '../../util/currency';
import { setStatementId } from '../../reducer/app';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import CircularProgress from '@material-ui/core/CircularProgress';
import Paper from '@material-ui/core/Paper';
import RecoCheckBox from '../report/RecoCheckBox';
import StatementsTable from './StatementsTable';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import Typography from '@material-ui/core/Typography';


const tableWidth = '800px';

const styles = {
  root: {
    fontSize: '0.9rem',
  },
  tablePaper: {
    maxWidth: tableWidth,
    margin: '16px auto',
    padding: 0,
  },
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
  iconCell: {
    textAlign: 'left',
    padding: '4px 8px',
    border: '1px solid #bbb',
  },
  checkboxCell: {
    textAlign: 'center',
    padding: '0',
    border: '1px solid #bbb',
  },
  columnHeadCell: {
    fontWeight: 'normal',
    textAlign: 'left',
    padding: '4px 8px',
    border: '1px solid #bbb',
  },
};


class StatementView extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    period: PropTypes.object.isRequired,
    ploop: PropTypes.object.isRequired,
    recordURL: PropTypes.string,
    record: PropTypes.object,
    loading: PropTypes.bool,
    loadError: PropTypes.any,
    statementId: PropTypes.string,
    statementsURL: PropTypes.string.isRequired,
    statementsRecord: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
  }

  componentDidMount() {
    const {period, statementId} = this.props;
    if (statementId) {
      this.props.dispatch(setStatementId(statementId, period.id));
    }
  }

  componentDidUpdate(prevProps) {
    const {period, statementId} = this.props;
    if (statementId && statementId !== prevProps.statementId) {
      this.props.dispatch(setStatementId(statementId, period.id));
    }
  }

  renderEntry(entry, cfmt) {
    const {
      classes,
      period,
      dispatch,
    } = this.props;

    return (
      <tr key={entry.id}>
        <td className={classes.iconCell}>
        </td>
        <td className={classes.textCell}>
          <FormattedDate value={entry.entry_date}
            day="numeric" month="short" year="numeric"
            timeZone="UTC" />
        </td>
        <td className={classes.amountCell}>
          {cfmt(entry.delta)}
        </td>
        <td className={classes.amountCell}>
          {entry.statement_page}
        </td>
        <td className={classes.amountCell}>
          {entry.statement_line}
        </td>
        <td className={classes.textCell}>
          {entry.description}
        </td>
        <td className={classes.checkboxCell}>
          <RecoCheckBox
            periodId={period.id}
            recoId={entry.reco_id}
            accountEntryId={entry.id}
            dispatch={dispatch} />
        </td>
      </tr>);
  }

  renderStatement() {
    const {
      classes,
      loading,
      loadError,
      record,
      statementId,
    } = this.props;

    if (!statementId) {
      return null;
    }

    if (!record) {
      let paperContent;
      if (loading) {
        paperContent = (
          <div style={{textAlign: 'center'}}>
            <CircularProgress style={{padding: '16px'}} />
          </div>);
      } else if (loadError) {
        paperContent = (
          <div style={{padding: '16px'}}>
            <p>{loadError}</p>
          </div>);
      } else {
        paperContent = (
          <div style={{padding: '16px'}}>
            Unable to retrieve statement {statementId}
          </div>);
      }
      return (
        <Paper className={classes.tablePaper}>
          {paperContent}
        </Paper>
      );
    }

    const rows = [];
    const colCount = 7;

    const cfmt = new getCurrencyFormatter(record.statement.currency);

    for (const entry of record.entries) {
      rows.push(this.renderEntry(entry, cfmt));
    }

    return (
      <Paper className={classes.tablePaper}>
        <Typography className={classes.root} component="div">
          <table className={classes.table}>
            <thead>
              <tr>
                <th className={classes.headCell}
                  colSpan={colCount}
                >
                  Statement {statementId}
                </th>
              </tr>
              <tr>
                <th className={classes.columnHeadCell}></th>
                <th className={classes.columnHeadCell}>Date</th>
                <th className={classes.columnHeadCell}>Amount</th>
                <th className={classes.columnHeadCell}>Page</th>
                <th className={classes.columnHeadCell}>Line</th>
                <th className={classes.columnHeadCell}>Description</th>
                <th className={classes.columnHeadCell}>Reconciled</th>
              </tr>
            </thead>
            <tbody>
              {rows}
            </tbody>
          </table>
        </Typography>
      </Paper>
    );
  }

  render() {
    const {
      classes,
      recordURL,
      period,
      ploop,
      statementsURL,
      statementsRecord,
    } = this.props;

    const urls = [statementsURL];
    if (recordURL) {
      urls.push(recordURL);
    }

    const require = (
      <Require fetcher={fOPNReco} urls={urls} />);

    return (
      <div className={classes.root}>
        {require}
        <Paper className={classes.tablePaper}>
          <StatementsTable
            period={period}
            ploop={ploop}
            statements={statementsRecord.statements}
            now={statementsRecord.now} />
        </Paper>
        {this.renderStatement()}
        <div style={{height: 1}}></div>
      </div>
    );
  }
}


function mapStateToProps(state, ownProps) {
  const {period, match} = ownProps;
  const statementId = match.params.statementId;

  const encPeriodId = encodeURIComponent(period.id);
  const statementsURL = fOPNReco.pathToURL(
    `/period/${encPeriodId}/statements`);
  const statementsRecord = fetchcache.get(state, statementsURL) || {};

  let res = {
    statementId,
    statementsURL,
    statementsRecord,
  };

  if (statementId) {
    const query = `statement_id=${encodeURIComponent(statementId)}`;
    const recordURL = fOPNReco.pathToURL(
      `/period/${encPeriodId}/statement?${query}`);
    let record = fetchcache.get(state, recordURL);
    const loading = fetchcache.fetching(state, recordURL);
    const loadError = fetchcache.getError(state, recordURL);

    res = {
      ...res,
      recordURL,
      record,
      loading,
      loadError,
    };
  }

  return res;
}


export default compose(
  withStyles(styles),
  withRouter,
  connect(mapStateToProps),
)(StatementView);
