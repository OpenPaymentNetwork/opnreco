
import { binder, binder1 } from '../../util/binder';
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
import FormControl from '@material-ui/core/FormControl';
import FormGroup from '@material-ui/core/FormGroup';
import Input from '@material-ui/core/Input';
import InputLabel from '@material-ui/core/InputLabel';
import Paper from '@material-ui/core/Paper';
import PeriodAssignSelect from './PeriodAssignSelect';
import PropTypes from 'prop-types';
import React from 'react';
import RecoCheckBox from '../report/RecoCheckBox';
import Require from '../../util/Require';
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
  iconButton: {
    padding: '2px',
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
    this.state = {
      editingEntries: {},  // accountEntryId: true
      form: {},
    };
  }

  componentDidMount() {
    const {period, statementId} = this.props;
    if (statementId) {
      this.props.dispatch(setStatementId(statementId, period.id));
    }
    this.initForm();
  }

  componentDidUpdate(prevProps) {
    const {period, statementId} = this.props;
    if (statementId && statementId !== prevProps.statementId) {
      this.props.dispatch(setStatementId(statementId, period.id));
    }
    this.initForm();
  }

  initForm() {
    const {
      statementId,
      record,
    } = this.props;

    if (!statementId || !record) {
      // The statement is not yet available.
      return;
    }

    if (statementId === this.state.initializedForStatementId) {
      // Already initialized.
      return;
    }

    this.setState({
      form: record.statement,
      initializedForStatementId: statementId,
    });
  }

  handleFormChange(fieldName, event) {
    this.setState({
      form: {
        ...this.state.form,
        [fieldName]: event.target.value,
      }
    });
  }

  renderStatementForm() {
    const {
      classes,
      period,
      record,
    } = this.props;

    const {
      form,
    } = this.state;

    const disabled = period.closed;

    return (
      <div className={classes.statementForm}>
        <FormGroup row className={classes.formLine}>
          <FormControl className={classes.sourceControl} disabled={disabled}>
            <InputLabel shrink htmlFor="statement_source">
              Source
            </InputLabel>
            <Input
              name="source"
              id="statement_source"
              value={form.source || ''}
              onChange={this.binder1(this.handleFormChange, 'source')}
            />
          </FormControl>

          <FormControl className={classes.periodControl} disabled={disabled}>
            <InputLabel shrink htmlFor="statement_period_id">
              Period
            </InputLabel>
            <PeriodAssignSelect
              id="statement_period_id"
              name="period_id"
              value={form.period_id || ''}
              displayEmpty
              onChange={this.binder1(this.handleFormChange, 'period_id')}
              periods={record.periods}
            />
          </FormControl>

        </FormGroup>
        <FormGroup row>
        </FormGroup>
      </div>
    );
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
    const colCount = 6;

    const cfmt = new getCurrencyFormatter(record.statement.currency);

    for (const entry of record.entries) {
      rows.push(this.renderEntry(entry, cfmt));
    }

    const form = this.renderStatementForm();

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
                  {form}
                </td>
              </tr>
            </tbody>
            <thead>
              <tr>
                <th className={classes.headCell}
                  colSpan={colCount}
                >
                  Account Entries
                </th>
              </tr>
              <tr>
                <th className={classes.columnHeadCell} width="15%">
                  Date
                </th>
                <th className={classes.columnHeadCell} width="10%">
                  Amount
                </th>
                <th className={classes.columnHeadCell} width="5%">
                  Page
                </th>
                <th className={classes.columnHeadCell} width="5%">
                  Line
                </th>
                <th className={classes.columnHeadCell} width="60%">
                  Description
                </th>
                <th className={classes.columnHeadCell} width="5%">
                  Reconciled
                </th>
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

  renderEntry(entry, cfmt) {
    const {
      classes,
      period,
      dispatch,
    } = this.props;

    return (
      <tr key={entry.id}>
        <td className={classes.textCell}>
          <FormattedDate value={entry.entry_date}
            day="numeric" month="short" year="numeric"
            timeZone="UTC" />
        </td>
        <td className={classes.amountCell}>
          {cfmt(entry.delta)}
        </td>
        <td className={classes.amountCell}>
          {entry.page}
        </td>
        <td className={classes.amountCell}>
          {entry.line}
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
