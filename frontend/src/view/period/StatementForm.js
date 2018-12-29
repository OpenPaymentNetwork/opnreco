
import { binder, binder1 } from '../../util/binder';
import { withStyles } from '@material-ui/core/styles';
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
};


class StatementForm extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
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
    const {
      statement,
    } = this.props;

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

  render() {
    const {
      classes,
      period,
      periods,
    } = this.props;

    const {
      form,
    } = this.state;

    const disabled = period.closed;

    return (
      <div className={classes.root}>
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
              periods={periods}
            />
          </FormControl>

        </FormGroup>
        <FormGroup row>
        </FormGroup>
      </div>
    );
  }
}


export default withStyles(styles)(StatementForm);
