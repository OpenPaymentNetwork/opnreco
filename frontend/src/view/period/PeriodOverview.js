
import { binder, binder1 } from '../../util/binder';
import { clearWithPloops } from '../../reducer/clearmost';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReco } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { getCurrencyFormatter } from '../../util/currency';
import { injectIntl, intlShape } from 'react-intl';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import React from 'react';
import CircularProgress from '@material-ui/core/CircularProgress';
import Require from '../../util/Require';
import Paper from '@material-ui/core/Paper';
import TextField from '@material-ui/core/TextField';
import FormGroup from '@material-ui/core/FormGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';


const tableWidth = '800px';

const styles = {
  content: {
    padding: '16px',
  },
  paperContent: {
    maxWidth: tableWidth,
    margin: '0 auto',
    padding: '16px',
  },
  overviewTablePaper: {
    maxWidth: '832px',
    margin: '16px auto',
    padding: 0,
  },
  field: {
    margin: '16px 16px 16px 0',
    minWidth: '250px',
  },
  saveButton: {
    margin: '16px 16px 16px 0',
  },
  progress: {
    marginLeft: '16px',
  },
};


class PeriodOverview extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    intl: intlShape.isRequired,
    loading: PropTypes.bool,
    periodId: PropTypes.string,
    queryURL: PropTypes.string.isRequired,
    result: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
    this.binder1 = binder1(this);
    this.state = {
      form: {},
    };
  }

  componentDidMount() {
    this.componentDidUpdate();
  }

  componentDidUpdate() {
    const {result, periodId} = this.props;
    if (this.state.initialized !== periodId && result) {
      this.setState({
        form: result.period,
        initialized: periodId,
      });
    }
  }

  handleChangeText(fieldName, event) {
    this.setState({
      form: {
        ...this.state.form,
        [fieldName]: event.target.value,
      },
    });
  }

  handleChangePull(event) {
    this.setState({
      form: {
        ...this.state.form,
        pull: event.target.checked,
      },
    });
  }

  handleSave() {
    this.save('save', false);
  }

  handleSaveClose() {
    this.save('save', true);
  }

  handleReopen() {
    this.save('reopen', false);
  }

  save(viewName, close) {
    const {
      periodId,
      dispatch,
    } = this.props;

    const url = fOPNReco.pathToURL(
      `/period/${encodeURIComponent(periodId)}/${viewName}`);
    const data = {
      ...this.state.form,
      close,
    };
    const promise = this.props.dispatch(fOPNReco.fetch(url, {data}));
    this.setState({saving: true});
    promise.then((response) => {
      this.setState({
        form: {
          ...response.period,
          pull: false,
        },
        saving: false,
      });
      dispatch(clearWithPloops());
    }).catch(() => {
      this.setState({saving: false});
    });
  }

  renderForm() {
    const {
      classes,
      result,
    } = this.props;

    const {
      form,
      saving,
    } = this.state;

    const closed = result.period.closed;

    let spinner = null;
    if (saving) {
      spinner = <CircularProgress size="24px" className={classes.progress} />;
    }

    let buttons;
    if (!closed) {
      buttons = (
        <FormGroup row>
          <Button
            className={classes.saveButton}
            color="primary"
            variant="contained"
            onClick={this.binder(this.handleSave)}
          >
            Save
          </Button>

          <Button
            className={classes.saveButton}
            color="primary"
            variant="contained"
            onClick={this.binder(this.handleSaveClose)}
          >
            Save and Close
          </Button>

          {spinner}
        </FormGroup>
      );
    } else {
      buttons = (
        <FormGroup row>
          <Button
            className={classes.saveButton}
            variant="contained"
            onClick={this.binder(this.handleReopen)}
          >
            Reopen
          </Button>

          {spinner}
        </FormGroup>
      );
    }

    return (
      <Paper className={classes.paperContent}>
        <form className={classes.form} noValidate>
          <FormGroup row>

            <TextField
              id="start_date"
              label="Start Date"
              type="date"
              value={form.start_date || ''}
              onChange={this.binder1(this.handleChangeText, 'start_date')}
              className={classes.field}
              InputLabelProps={{
                shrink: true,
              }}
              disabled={closed}
            />

            <TextField
              id="end_date"
              label="End Date"
              type="date"
              value={form.end_date || ''}
              onChange={this.binder1(this.handleChangeText, 'end_date')}
              className={classes.field}
              InputLabelProps={{
                shrink: true,
              }}
              disabled={closed}
            />
          </FormGroup>

          <FormGroup row>
            <TextField
              id="start_circ"
              label="Circulation on Start Date"
              value={form.start_circ || ''}
              onChange={this.binder1(this.handleChangeText, 'start_circ')}
              className={classes.field}
              InputLabelProps={{
                shrink: true,
              }}
              disabled={closed}
            />

            <TextField
              id="start_surplus"
              label="Surplus/Deficit on Start Date"
              value={form.start_surplus || ''}
              onChange={this.binder1(this.handleChangeText, 'start_surplus')}
              className={classes.field}
              InputLabelProps={{
                shrink: true,
              }}
              disabled={closed}
            />
          </FormGroup>

          <FormGroup row>
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.pull || false}
                  onChange={this.binder(this.handleChangePull)}
                  disabled={closed}
                />
              }
              label={
                <div>
                  Pull account entries and movements in the specified
                  date range into this period.
                </div>
              }
            />
          </FormGroup>

          {buttons}
        </form>
      </Paper>
    );
  }

  renderSummary() {
    const {
      classes,
      result: {
        period,
        totals,
        counts,
      },
    } = this.props;

    const showCirc = (period.peer_id === 'c');
    const columnCount = showCirc ? 6 : 4;

    const cfmt = new getCurrencyFormatter(period.currency);

    const getAmountColumns = (rowname) => {
      if (showCirc) {
        return (
          <React.Fragment>
            <td className={classes.amountCell}>
              {cfmt(totals[rowname].circ)}
            </td>
            <td className={classes.amountCell}>
              {cfmt(totals[rowname].surplus)}
            </td>
            <td className={classes.amountCell}>
              {cfmt(totals[rowname].combined)}
            </td>
          </React.Fragment>
        );
      } else {
        return (
          <td className={classes.amountCell}>
            {cfmt(totals[rowname].combined)}
          </td>
        );
      }
    };

    return (
      <Paper className={classes.overviewTablePaper}>
        <table>
          <thead>
            <tr>
              <th className={classes.headCell}
                colSpan={columnCount}>Summary</th>
            </tr>
            <tr>
              <th className={classes.columnHeadCell}></th>
              {showCirc ?
                <React.Fragment>
                  <th className={classes.columnHeadCell}>Circulation</th>
                  <th className={classes.columnHeadCell}>Surplus/Deficit</th>
                  <th className={classes.columnHeadCell}>Combined</th>
                </React.Fragment>
                : <th className={classes.columnHeadCell}>Amount</th>
              }
              <th className={classes.columnHeadCell}>Account Entries</th>
              <th className={classes.columnHeadCell}>OPN Movements</th>
            </tr>
          </thead>
          <tbody>

            <tr>
              <td className={classes.rowHeadCell}>
                Start Balance
              </td>
              {getAmountColumns('start', false)}
              <td className={classes.amountCell}></td>
              <td className={classes.amountCell}></td>
            </tr>

            <tr>
              <td className={classes.rowHeadCell}>
                Internally Reconciled
              </td>
              {getAmountColumns('internal_reconciled_delta')}
              <td className={classes.amountCell}>
              </td>
              <td className={classes.amountCell}>
                {counts.internal_movements_reconciled}
              </td>
            </tr>

            <tr>
              <td className={classes.rowHeadCell}>
                Externally Reconciled
              </td>
              {getAmountColumns('external_reconciled_delta')}
              <td className={classes.amountCell}>
                {counts.account_entries_reconciled}
              </td>
              <td className={classes.amountCell}>
                {counts.external_movements_reconciled}
              </td>
            </tr>

            <tr>
              <td className={classes.rowHeadCell}>
                Start + Reconciled
              </td>
              {getAmountColumns('reconciled_total')}
              <td className={classes.amountCell}></td>
              <td className={classes.amountCell}></td>
            </tr>

            <tr>
              <td className={classes.rowHeadCell}>
                Unreconciled Items
              </td>
              {getAmountColumns('outstanding_delta')}
              <td className={classes.amountCell}>
                {counts.account_entries_unreconciled}
              </td>
              <td className={classes.amountCell}>
                {counts.movements_unreconciled}
              </td>
            </tr>

            <tr>
              <td className={classes.rowHeadCell}>
                End Balance
              </td>
              {getAmountColumns('end')}
              <td className={classes.amountCell}></td>
              <td className={classes.amountCell}></td>
            </tr>

          </tbody>
        </table>
      </Paper>
    );
  }

  renderContent() {
    return (
      <div>
        {this.renderForm()}
        {this.renderSummary()}
      </div>
    );
  }

  render() {
    const {
      classes,
      queryURL,
      result,
      loading,
    } = this.props;

    let content = null;

    if (result) {
      content = this.renderContent();
    } else if (loading) {
      content = (
        <div style={{textAlign: 'center'}}>
          <CircularProgress style={{padding: '16px'}} />
        </div>);
    }

    return (
      <div className={classes.root}>
        <Require fetcher={fOPNReco} urls={[queryURL]} />

        <div className={classes.content}>
          {content}
          <div style={{height: 1}}></div>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state, ownProps) {
  const periodId = ownProps.period.id;
  const queryURL = fOPNReco.pathToURL(
    `/period/${encodeURIComponent(periodId)}/state`);
  const result = fetchcache.get(state, queryURL);
  const loading = fetchcache.fetching(state, queryURL);

  return {
    result,
    queryURL,
    loading,
    periodId,
  };
}


export default compose(
  withStyles(styles),
  withRouter,
  injectIntl,
  connect(mapStateToProps),
)(PeriodOverview);
