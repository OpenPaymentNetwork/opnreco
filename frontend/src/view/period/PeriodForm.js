
import { clearWithPloops } from '../../reducer/clearmost';
import { fOPNReco } from '../../util/fetcher';
import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import CircularProgress from '@material-ui/core/CircularProgress';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormGroup from '@material-ui/core/FormGroup';
import Lock from '@material-ui/icons/Lock';
import LockOpen from '@material-ui/icons/LockOpen';
import PropTypes from 'prop-types';
import React from 'react';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';


const styles = {
  content: {
    padding: '16px',
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
  lockLine: {
    position: 'relative',
    paddingLeft: '32px',
    lineHeight: '24px',
  },
  lockIcon: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
};


class PeriodOverview extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    period: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.state = {
      form: {},
    };
  }

  componentDidMount() {
    this.componentDidUpdate();
  }

  componentDidUpdate() {
    const {period} = this.props;
    if (period && this.state.initialized !== period.id) {
      this.setState({
        form: period,
        initialized: period.id,
      });
    }
  }

  handleChangeText = (event, fieldName) => {
    this.setState({
      form: {
        ...this.state.form,
        [fieldName]: event.target.value,
      },
    });
  }

  handleChangePull = (event) => {
    this.setState({
      form: {
        ...this.state.form,
        pull: event.target.checked,
      },
    });
  }

  handleSave = () => {
    this.save('save', false);
  }

  handleSaveClose = () => {
    this.save('save', true);
  }

  handleReopen = () => {
    this.save('reopen', false);
  }

  save(viewName, close) {
    const {
      period,
      dispatch,
    } = this.props;

    const url = fOPNReco.pathToURL(
      `/period/${encodeURIComponent(period.id)}/${viewName}`);
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

  render() {
    const {
      classes,
      period,
    } = this.props;

    const {
      form,
      saving,
    } = this.state;

    const closed = period ? period.closed : true;

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
            onClick={this.handleSave}
          >
            Save
          </Button>

          <Button
            className={classes.saveButton}
            color="primary"
            variant="contained"
            onClick={this.handleSaveClose}
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
            onClick={this.handleReopen}
          >
            Reopen
          </Button>

          {spinner}
        </FormGroup>
      );
    }

    return (
      <form className={classes.form} noValidate>
        <FormGroup row>
          <Typography variant="body1" className={classes.lockLine}
            component="div"
          >
            {closed ?
              <div>
                <Lock className={classes.lockIcon} /> This
                period is closed.
              </div> :
              <div>
                <LockOpen className={classes.lockIcon} /> This
                period is open.
              </div>
            }
          </Typography>
        </FormGroup>
        <FormGroup row>

          <TextField
            id="start_date"
            label="Start Date"
            type="date"
            value={form.start_date || ''}
            onChange={(event) => this.handleChangeText(event, 'start_date')}
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
            onChange={(event) => this.handleChangeText(event, 'end_date')}
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
            onChange={(event) => this.handleChangeText(event, 'start_circ')}
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
            onChange={(event) => this.handleChangeText(event, 'start_surplus')}
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
                onChange={this.handleChangePull}
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
    );
  }
}

export default withStyles(styles)(PeriodOverview);
