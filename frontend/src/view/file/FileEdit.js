
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import FileRemoveDialog from './FileRemoveDialog';
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

  handleRemove = () => {
    this.setState({removeExists: true, removeShown: true});
  }

  handleRemoveCancel = () => {
    this.setState({removeShown: false});
  }

  handleRemoveConfirmed = () => {
    const {
      dispatch,
      history,
      file,
    } = this.props;

    const encFileId = encodeURIComponent(file.id);
    const url = fOPNReco.pathToURL(`/file/${encFileId}/remove`);
    const data = {};
    const promise = this.props.dispatch(fOPNReco.fetch(url, {data}));
    this.setState({removing: true});
    promise.then(() => {
      this.setState({removing: false});
      dispatch(clearWithFiles());
      history.push('/file');
    }).catch(() => {
      this.setState({removing: false});
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
      removeExists,
      removeShown,
      removing,
    } = this.state;

    let spinner = null;
    if (saving) {
      spinner = <CircularProgress size="24px" className={classes.progress} />;
    }

    let removeDialog = null;
    if (removeExists) {
      removeDialog = (
        <FileRemoveDialog
          onCancel={this.handleRemoveCancel}
          onRemove={this.handleRemoveConfirmed}
          open={removeShown}
          removing={removing}
        />);
    }

    return (
      <div className={classes.root}>
        <div className={classes.content}>
          <Paper className={classes.paperContent}>
            <form className={classes.form} noValidate>
              {removeDialog}

              <FormGroup className={classes.formGroup}>
                <TextField
                  id="title"
                  label="Title"
                  value={form.title}
                  onChange={(event) => this.handleChangeText(event, 'title')}
                  InputLabelProps={{
                    shrink: true,
                  }}
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
                  onClick={this.handleRemove}
                >
                  Remove
                </Button>

                {spinner}
              </FormGroup>


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
