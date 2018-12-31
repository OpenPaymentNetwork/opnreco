
import { binder, binder1 } from '../../util/binder';
import { clearMost } from '../../reducer/clearmost';
import { compose } from '../../util/functional';
import { fetchcache } from '../../reducer/fetchcache';
import { fOPNReco } from '../../util/fetcher';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import FormControl from '@material-ui/core/FormControl';
import FormGroup from '@material-ui/core/FormGroup';
import Input from '@material-ui/core/Input';
import InputLabel from '@material-ui/core/InputLabel';
import PeriodAssignSelect from './PeriodAssignSelect';
import PropTypes from 'prop-types';
import React from 'react';


const styles = {
  root: {
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
  buttonBox: {
    margin: '24px 0 8px 0',
  },
  button: {
    marginRight: '16px',
  },
};


class StatementForm extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    period: PropTypes.object.isRequired,
    periods: PropTypes.array.isRequired,
    statement: PropTypes.object.isRequired,
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
    this.initForm();
  }

  componentDidUpdate() {
    this.initForm();
  }

  initForm() {
    const {statement} = this.props;

    if (statement.id === this.state.initializedForStatementId) {
      // Already initialized.
      return;
    }

    this.setState({
      form: statement,
      initializedForStatementId: statement.id,
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

  handleSave() {
    const {
      dispatch,
      period,
      statement,
      history,
    } = this.props;

    const url = fOPNReco.pathToURL(
      `/period/${encodeURIComponent(period.id)}/statement-save`);
    const data = {
      ...this.state.form,
      id: statement.id,
    };
    const promise = this.props.dispatch(fOPNReco.fetch(url, {data}));
    this.setState({saving: true});
    promise.then((response) => {
      this.setState({
        form: response.statement,
        saving: false,
      });
      const newPeriodId = response.statement.period_id;
      if (newPeriodId !== period.id) {
        // Redirect to the statement in the new period. Suspend fetchcache to
        // avoid loading from the old URL.
        const newPath = (
          `/period/${encodeURIComponent(newPeriodId)}/statement/` +
          encodeURIComponent(statement.id));
        dispatch(fetchcache.suspend());
        history.push(newPath);
        // Resume fetchcache.
        window.setTimeout(() => {
          dispatch(fetchcache.resume());
        }, 0);
      }
      dispatch(clearMost());

    }).catch(() => {
      this.setState({saving: false});
    });
  }

  handleCancel() {
    const {statement} = this.props;
    this.setState({
      form: statement,
      initializedForStatementId: statement.id,
    });
  }

  handleDelete() {
  }

  render() {
    const {
      classes,
      period,
      periods,
      statement,
    } = this.props;

    const {
      form,
      saving,
    } = this.state;

    const {closed} = period;

    let changed = false;
    if (!closed) {
      for (const attr of Object.keys(form)) {
        if (form[attr] !== statement[attr]) {
          changed = true;
        }
      }
    }

    return (
      <div className={classes.root}>
        <FormGroup row className={classes.formLine}>
          <FormControl className={classes.sourceControl} disabled={closed}>
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

          <FormControl className={classes.periodControl} disabled={closed}>
            <InputLabel shrink htmlFor="statement_period_id">
              Period
            </InputLabel>
            <PeriodAssignSelect
              id="statement_period_id"
              name="period_id"
              value={form.period_id || ''}
              displayEmpty
              onChange={this.binder1(this.handleFormChange, 'period_id')}
              periods={periods}
            />
          </FormControl>

        </FormGroup>
        <FormGroup row className={classes.buttonBox}>
          <Button
            className={classes.button}
            color="primary"
            variant="contained"
            disabled={closed || !changed || saving}
            onClick={this.binder(this.handleSave)}
          >
            Save
          </Button>

          <Button
            className={classes.button}
            color="default"
            variant="contained"
            disabled={closed || !changed || saving}
            onClick={this.binder(this.handleCancel)}
          >
            Cancel
          </Button>

          <Button
            className={classes.button}
            color="default"
            disabled={closed || saving}
            onClick={this.binder(this.handleDelete)}
          >
            Delete
          </Button>

          {this.state.saving ?
            <CircularProgress size={24} />
            : null}
        </FormGroup>
      </div>
    );
  }
}


export default compose(
  withStyles(styles),
  withRouter,
)(StatementForm);
