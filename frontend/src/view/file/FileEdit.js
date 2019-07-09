
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import FileArchiveDialog from './FileArchiveDialog';
import FormGroup from '@material-ui/core/FormGroup';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import TextField from '@material-ui/core/TextField';
import { clearWithFiles } from '../../reducer/clearmost';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReco } from '../../util/fetcher';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';


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
  formGroup: {
    marginBottom: '16px',
  },
  button: {
    margin: '16px 16px 16px 0',
  },
  progress: {
    marginLeft: '16px',
  },
};


class FileEdit extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    file: PropTypes.object.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      form: {title: props.file.title},
    };
  }

  handleChangeText = (event, fieldName) => {
    this.setState({
      form: {
        ...this.state.form,
        [fieldName]: event.target.value,
      },
    });
  }

  handleSave = () => {
    const {
      dispatch,
      file,
    } = this.props;

    const url = fOPNReco.pathToURL(
        `/file/${encodeURIComponent(file.id)}/save`);
    const data = this.state.form;
    const promise = dispatch(fOPNReco.fetch(url, {data}));
    this.setState({saving: true});
    promise.then(() => {
      this.setState({saving: false});
      dispatch(clearWithFiles());
    }).catch(() => {
      this.setState({saving: false});
    });
  }

  handleArchive = () => {
    this.setState({archiveDialogExists: true, archiveDialogShown: true});
  }

  handleArchiveCancel = () => {
    this.setState({archiveDialogShown: false});
  }

  handleArchiveConfirmed = () => {
    const {
      dispatch,
      history,
      file,
    } = this.props;

    const encFileId = encodeURIComponent(file.id);
    const url = fOPNReco.pathToURL(`/file/${encFileId}/archive`);
    const data = {};
    const promise = this.props.dispatch(fOPNReco.fetch(url, {data}));
    this.setState({archiving: true});
    promise.then(() => {
      this.setState({archiving: false});
      dispatch(clearWithFiles());
      history.push('/file');
    }).catch(() => {
      this.setState({archiving: false});
    });
  }

  render() {
    const {
      classes,
      file,
    } = this.props;

    const {
      form,
      saving,
      archiveDialogExists,
      archiveDialogShown,
      archiving,
    } = this.state;

    const {archived} = file;

    let spinner = null;
    if (saving) {
      spinner = <CircularProgress size="24px" className={classes.progress} />;
    }

    let archiveDialog = null;
    if (archiveDialogExists) {
      archiveDialog = (
        <FileArchiveDialog
          onCancel={this.handleArchiveCancel}
          onArchive={this.handleArchiveConfirmed}
          open={archiveDialogShown}
          archiving={archiving}
        />);
    }

    let buttons = null;

    if (archived) {
      buttons = (
        <FormGroup row>
          <Button
            className={classes.button}
            variant="contained"
            onClick={this.handleUnarchive}
          >
            Unarchive
          </Button>

          {spinner}
        </FormGroup>
      );
    } else {
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
            onClick={this.handleArchive}
          >
            Archive
          </Button>

          {spinner}
        </FormGroup>
      );
    }

    return (
      <div className={classes.root}>
        <div className={classes.content}>
          <Paper className={classes.paperContent}>
            <form className={classes.form} noValidate>
              {archiveDialog}

              <FormGroup className={classes.formGroup}>
                <TextField
                  id="title"
                  label="Title"
                  value={form.title}
                  onChange={(event) => this.handleChangeText(event, 'title')}
                  InputLabelProps={{
                    shrink: true,
                  }}
                  disabled={archived}
                />
              </FormGroup>

              <FormGroup className={classes.formGroup}>
                <TextField
                  id="currency"
                  label="Currency"
                  value={file.currency}
                  className={classes.field}
                  InputLabelProps={{
                    shrink: true,
                  }}
                  disabled
                />
              </FormGroup>

              {buttons}

            </form>
          </Paper>
          <div style={{height: 1}}></div>
        </div>
      </div>
    );
  }
}

function mapStateToProps() {
  return {
  };
}


export default compose(
  withStyles(styles),
  withRouter,
  connect(mapStateToProps),
)(FileEdit);
