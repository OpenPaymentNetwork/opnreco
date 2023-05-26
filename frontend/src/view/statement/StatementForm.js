
import { clearMost } from '../../reducer/clearmost';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fetchcache } from '../../reducer/fetchcache';
import { fOPNReco } from '../../util/fetcher';
import { FormattedDate, FormattedTime } from 'react-intl';
import { getAccessToken } from '../../reducer/login';
import { setStatementId } from '../../reducer/app';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import CloudDownload from '@material-ui/icons/CloudDownload';
import FormControl from '@material-ui/core/FormControl';
import FormGroup from '@material-ui/core/FormGroup';
import Input from '@material-ui/core/Input';
import InputLabel from '@material-ui/core/InputLabel';
import PeriodAssignSelect from '../period/PeriodAssignSelect';
import PropTypes from 'prop-types';
import React from 'react';
import StatementDeleteDialog from './StatementDeleteDialog';


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
  downloadRow: {
    paddingTop: '16px',
  },
  downloadLink: {
    cursor: 'pointer',
    display: 'inline-block',
    height: '24px',
    lineHeight: '24px',
    position: 'relative',
    paddingLeft: '32px',
    paddingRight: '8px',
    color: '#000',
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  downloadIcon: {
    position: 'absolute',
    left: 0,
    top: 0,
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
    deleteConflicts: PropTypes.object,
    accessToken: PropTypes.string.isRequired,
    archived: PropTypes.bool,
  };

  constructor(props) {
    super(props);
    this.accessTokenRef = React.createRef();
    this.downloadFormRef = React.createRef();
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
    const { statement } = this.props;

    if (statement.id === this.state.initializedForStatementId) {
      // Already initialized.
      return;
    }

    this.setState({
      form: statement,
      initializedForStatementId: statement.id,
    });
  }

  handleFormChange = (event, fieldName) => {
    this.setState({
      form: {
        ...this.state.form,
        [fieldName]: event.target.value,
      }
    });
  };

  handleSave = () => {
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
    const promise = this.props.dispatch(fOPNReco.fetch(url, { data }));
    this.setState({ saving: true });
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
        dispatch(setStatementId(statement.id, newPeriodId));
        history.push(newPath);
        // Resume fetchcache.
        window.setTimeout(() => {
          dispatch(fetchcache.resume());
        }, 0);
      }
      dispatch(clearMost());

    }).catch(() => {
      this.setState({ saving: false });
    });
  };

  handleCancel = () => {
    // Cancel the user's changes to the form.
    const { statement } = this.props;
    this.setState({
      form: statement,
      initializedForStatementId: statement.id,
    });
  };

  handleDelete = () => {
    this.setState({ deleteExists: true, deleteShown: true });
  };

  handleDeleteCancel = () => {
    this.setState({ deleteShown: false });
  };

  handleDeleteConfirmed = () => {
    const {
      dispatch,
      period,
      statement,
      history,
    } = this.props;

    const encPeriodId = encodeURIComponent(period.id);
    const url = fOPNReco.pathToURL(`/period/${encPeriodId}/statement-delete`);
    const data = {
      id: statement.id,
    };
    const promise = this.props.dispatch(fOPNReco.fetch(url, { data }));
    this.setState({ deleting: true });
    promise.then(() => {
      const newPath = `/period/${encPeriodId}/statement`;
      dispatch(fetchcache.suspend());
      dispatch(setStatementId(null, null));
      history.push(newPath);
      dispatch(clearMost());
      // Resume fetchcache.
      window.setTimeout(() => {
        dispatch(fetchcache.resume());
      }, 0);
    }).catch(() => {
      this.setState({ deleting: false });
    });
  };

  handleDownload = () => {
    this.accessTokenRef.current.setAttribute('value', this.props.accessToken);
    this.downloadFormRef.current.submit();
  };

  renderDownloadRow() {
    const {
      classes,
      period,
      statement,
    } = this.props;

    const downloadURL = fOPNReco.pathToURL(
      `/period/${encodeURIComponent(period.id)}/statement-download/` +
      `${encodeURIComponent(statement.id)}`);

    return (
      <div className={classes.downloadRow}>
        <span
          className={classes.downloadLink}
          onClick={this.handleDownload}
        >
          <CloudDownload className={classes.downloadIcon} />
          {statement.filename || 'file'}
        </span>
        <span className={classes.uploadDate}>
          (Uploaded <span title={statement.upload_ts}>
            <FormattedDate value={statement.upload_ts}
              day="numeric" month="short" year="numeric" />
            {' '}
            <FormattedTime value={statement.upload_ts}
              hour="numeric" minute="2-digit" second="2-digit" />)
          </span>
        </span>
        <form method="POST" action={downloadURL}
          style={{ display: 'none' }}
          ref={this.downloadFormRef}
        >
          <input type="hidden" name="access_token" ref={this.accessTokenRef} />
        </form>
      </div>
    );
  }

  render() {
    const {
      archived,
      classes,
      deleteConflicts,
      period,
      periods,
      statement,
    } = this.props;

    const {
      form,
      saving,
      deleteExists,
      deleteShown,
      deleting,
    } = this.state;

    const { closed } = period;

    let changed = false;
    if (!closed && !archived) {
      for (const attr of Object.keys(form)) {
        if (form[attr] !== statement[attr]) {
          changed = true;
        }
      }
    }

    let deleteDialog = null;
    if (deleteExists) {
      deleteDialog = (
        <StatementDeleteDialog
          statementId={statement.id}
          deleteConflicts={deleteConflicts}
          onCancel={this.handleDeleteCancel}
          onDelete={this.handleDeleteConfirmed}
          open={deleteShown}
          deleting={deleting}
        />);
    }

    let downloadRow = null;

    if (statement.upload_ts) {
      downloadRow = this.renderDownloadRow();
    }

    return (
      <div className={classes.root}>
        {deleteDialog}

        <FormGroup row className={classes.formLine}>
          <FormControl className={classes.sourceControl} disabled={closed || archived}>
            <InputLabel shrink htmlFor="statement_source">
              Source
            </InputLabel>
            <Input
              name="source"
              id="statement_source"
              value={form.source || ''}
              onChange={(event) => this.handleFormChange(event, 'source')}
            />
          </FormControl>

          <FormControl className={classes.periodControl} disabled={closed || archived}>
            <InputLabel shrink htmlFor="statement_period_id">
              Period
            </InputLabel>
            <PeriodAssignSelect
              id="statement_period_id"
              name="period_id"
              value={form.period_id || ''}
              displayEmpty
              onChange={(event) => this.handleFormChange(event, 'period_id')}
              periods={periods}
            />
          </FormControl>

        </FormGroup>

        {downloadRow}

        <FormGroup row className={classes.buttonBox}>
          <Button
            className={classes.button}
            color="primary"
            variant="contained"
            disabled={closed || archived || !changed || saving}
            onClick={this.handleSave}
          >
            Save Changes
          </Button>

          <Button
            className={classes.button}
            color="default"
            variant="contained"
            disabled={closed || archived || !changed || saving}
            onClick={this.handleCancel}
          >
            Cancel
          </Button>

          <Button
            className={classes.button}
            color="default"
            disabled={closed || archived || saving}
            onClick={this.handleDelete}
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


function mapStateToProps(state) {
  return {
    accessToken: getAccessToken(state.login.id),
  };
}


export default compose(
  withStyles(styles),
  withRouter,
  connect(mapStateToProps),
)(StatementForm);
