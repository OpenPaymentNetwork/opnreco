
import { binder, binder1 } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReco } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { setStatementId } from '../../reducer/app';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import AccountEntryTableContent from './AccountEntryTableContent';
import CircularProgress from '@material-ui/core/CircularProgress';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import StatementForm from './StatementForm';
import StatementsTable from './StatementsTable';
import Typography from '@material-ui/core/Typography';


const tableWidth = '800px';

const styles = {
  root: {
    fontSize: '0.9rem',
    padding: '0 16px',
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
  formCell: {
    padding: '4px 8px',
    fontWeight: 'normal',
    border: '1px solid #bbb',
  },
  statementForm: {
    padding: '16px 0',
  },
  formLine: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  sourceControl: {
    minWidth: '250px',
  },
  periodControl: {
    marginLeft: '16px',
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
    this.binder1 = binder1(this);
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

  renderStatement() {
    const {
      classes,
      dispatch,
      loading,
      loadError,
      period,
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

    const colCount = 6;

    return (
      <Paper className={classes.tablePaper}>
        <Typography component="div">
          <table className={classes.table}>
            <thead>
              <tr>
                <th className={classes.headCell}
                  colSpan={colCount}
                >
                  Statement {statementId}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={colCount} className={classes.formCell}>
                  <StatementForm
                    period={period}
                    periods={record.periods}
                    statement={record.statement} />
                </td>
              </tr>
            </tbody>
            <AccountEntryTableContent
              dispatch={dispatch}
              period={period}
              statement={record.statement}
              entries={record.entries}
            />
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
