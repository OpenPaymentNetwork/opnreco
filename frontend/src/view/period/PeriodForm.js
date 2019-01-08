
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
import PeriodDeleteDialog from './PeriodDeleteDialog';
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
  button: {
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
  addTopLine: {
    marginTop: '16px',
  },
};


class PeriodOverview extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    period: PropTypes.object,
    add: PropTypes.bool,
    onClose: PropTypes.func,     // Required for add mode
    ploopKey: PropTypes.string.isRequired,
    deleteConflicts: PropTypes.object,
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

  handleDelete = () => {
    this.setState({deleteExists: true, deleteShown: true});
  }

  handleDeleteCancel = () => {
    this.setState({deleteShown: false});
  }

  handleDeleteConfirmed = () => {
    const {
      dispatch,
      history,
      period,
      ploopKey,
    } = this.props;

    const encPeriodId = encodeURIComponent(period.id);
    const url = fOPNReco.pathToURL(`/period/${encPeriodId}/delete`);
    const data = {};
    const promise = this.props.dispatch(fOPNReco.fetch(url, {data}));
    this.setState({deleting: true});
    promise.then(() => {
      dispatch(clearWithPloops());
      this.setState({deleting: false});
      const newPath = `/periods/${encodeURIComponent(ploopKey)}`;
      history.push(newPath);
    }).catch(() => {
      this.setState({deleting: false});
    });
  }

  save(viewName, close) {
    const {
      period,
      dispatch,
      add,
    } = this.props;

    let url;
    if (add) {
      url = fOPNReco.pathToURL(
        `/period-add?ploop_key=${encodeURIComponent(this.props.ploopKey)}`);
    } else {
      url = fOPNReco.pathToURL(
        `/period/${encodeURIComponent(period.id)}/${viewName}`);
    }
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
      if (this.props.add && this.props.onClose) {
        this.props.onClose();
      }
    }).catch(() => {
      this.setState({saving: false});
    });
  }

  render() {
    const {
      classes,
      deleteConflicts,
      period,
      add,
    } = this.props;

    const {
      form,
      saving,
      deleteExists,
      deleteShown,
      deleting,
    } = this.state;

    const closed = add ? false : (period ? period.closed : true);

    let spinner = null;
    if (saving) {
      spinner = <CircularProgress size="24px" className={classes.progress} />;
    }

    let topLine;
    let buttons;
    if (add) {
      buttons = (
        <FormGroup row>
          <Button
            className={classes.button}
            color="primary"
            variant="contained"
            onClick={this.handleSave}
          >
            Add
          </Button>

          <Button
            className={classes.button}
            variant="contained"
            onClick={this.props.onClose}
          >
            Cancel
          </Button>

          {spinner}
        </FormGroup>
      );
    }
    else if (!closed) {
      buttons = (
        <FormGroup row>
          <Button
            className={classes.button}
            color="primary"
            variant="contained"
            onClick={this.handleSave}
          >
            Save
          </Button>

          <Button
            className={classes.button}
            color="primary"
            variant="contained"
            onClick={this.handleSaveClose}
          >
            Save and Close
          </Button>

          <Button
            className={classes.button}
            onClick={this.handleDelete}
          >
            Delete
          </Button>

          {spinner}
        </FormGroup>
      );
    } else {
      buttons = (
        <FormGroup row>
          <Button
            className={classes.button}
            variant="contained"
            onClick={this.handleReopen}
          >
            Reopen
          </Button>

          {spinner}
        </FormGroup>
      );
    }

    if (add) {
      topLine = (
        <Typography variant="h6" className={classes.addTopLine}>
          Add a Period
        </Typography>
      );
    } else {
      topLine = (
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
      );
    }

    let deleteDialog = null;
    if (deleteExists) {
      deleteDialog = (
        <PeriodDeleteDialog
          deleteConflicts={deleteConflicts}
          onCancel={this.handleDeleteCancel}
          onDelete={this.handleDeleteConfirmed}
          open={deleteShown}
          deleting={deleting}
        />);
    }

    return (
      <form className={classes.form} noValidate>
        {deleteDialog}

        <FormGroup row>
          {topLine}
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

        {add ? null :
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
        }

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
