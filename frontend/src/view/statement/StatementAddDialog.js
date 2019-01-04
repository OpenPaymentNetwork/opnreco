
import { compose } from '../../util/functional';
import { clearMost } from '../../reducer/clearmost';
import { fOPNReco } from '../../util/fetcher';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import FormControl from '@material-ui/core/FormControl';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormGroup from '@material-ui/core/FormGroup';
import Input from '@material-ui/core/Input';
import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import PropTypes from 'prop-types';
import React from 'react';


const styles = {
  sourceControl: {
    width: '100%',
  },
};


class StatementAddDialog extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    onClose: PropTypes.func.isRequired,
    open: PropTypes.bool,
    period: PropTypes.object.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      method: null,
      source: '',
    };
  }

  componentDidUpdate(prevProps) {
    if (this.props.open && !prevProps.open) {
      this.setState({
        method: null,
        source: '',
      });
    }
  }

  handleChangeMethod = (event) => {
    this.setState({method: event.target.value});
  }

  handleChangeSource = (event) => {
    this.setState({source: event.target.value});
  }

  handleChangeUpload = (event) => {
    const files = event.target.files;
    if (files && files.length) {
      this.setState({loading: true});
      const reader = new FileReader();
      reader.onloadend = (e) => {
        this.handleCompleteUpload(e, files[0]);
      };
      reader.readAsBinaryString(files[0]);
    }
  }

  handleCompleteUpload = (event, file) => {
    const {
      dispatch,
      history,
      period,
    } = this.props;

    const encPeriodId = encodeURIComponent(period.id);
    const url = fOPNReco.pathToURL(
      `/period/${encPeriodId}/statement-upload`);
    const data = {
      b64: window.btoa(event.target.result),
      name: file.name,
      size: file.size,
      type: file.type,
    };
    const promise = this.props.dispatch(fOPNReco.fetch(url, {data}));
    this.setState({loading: true});
    promise.then((response) => {
      // Redirect to the new statement.
      this.setState({loading: false});
      const path = (
        `/period/${encPeriodId}` +
        `/statement/${encodeURIComponent(response.statement.id)}`);
      history.push(path);
      dispatch(clearMost());
      this.props.onClose();
    }).catch(() => {
      this.setState({loading: false});
    });
  }

  handleContinueBlank = () => {
    const {
      dispatch,
      history,
      period,
    } = this.props;

    const encPeriodId = encodeURIComponent(period.id);
    const url = fOPNReco.pathToURL(
      `/period/${encPeriodId}/statement-add-blank`);
    const data = {
      source: this.state.source,
    };
    const promise = this.props.dispatch(fOPNReco.fetch(url, {data}));
    this.setState({loading: true});
    promise.then((response) => {
      // Redirect to the new statement.
      this.setState({loading: false});
      const path = (
        `/period/${encPeriodId}` +
        `/statement/${encodeURIComponent(response.statement.id)}`);
      history.push(path);
      dispatch(clearMost());
      this.props.onClose();
    }).catch(() => {
      this.setState({loading: false});
    });
  }

  render() {
    const {
      classes,
      onClose,
      open,
    } = this.props;

    const {
      method,
      source,
    } = this.state;

    let otherField = null;

    if (method === 'upload') {
      otherField = (
        <input
          id="statement-upload-input"
          type="file"
          style={{display: 'none'}}
          onChange={this.handleChangeUpload} />
      );
    } else if (method === 'blank') {
      otherField = (
        <FormGroup row>
          <FormControl className={classes.sourceControl}>
            <Input
              name="source"
              id="blank_statement_source"
              value={source || ''}
              onChange={this.handleChangeSource}
              placeholder="Source"
            />
          </FormControl>
        </FormGroup>
      );
    }

    // Note: the component="span" attribute is necessary for the
    // upload button to work.

    return (
      <Dialog
        onClose={onClose}
        aria-labelledby="form-dialog-title"
        open={open}
      >
        <DialogTitle id="form-dialog-title">Add a Statement</DialogTitle>
        <DialogContent>

          <FormGroup row>
            <FormControl component="fieldset">
              <RadioGroup
                aria-label="Method"
                name="gender1"
                value={this.state.value}
                onChange={this.handleChangeMethod}
              >
                <FormControlLabel value="upload" control={<Radio />} label={
                  <span>
                    Import from a spreadsheet or CSV file (<a
                      href="/template/Statement-Template-V1.xlsx">
                        download template</a>)
                  </span>
                } />
                <FormControlLabel value="blank" control={<Radio />}
                  label="Add a blank statement" />
              </RadioGroup>
            </FormControl>
          </FormGroup>

          {otherField}

        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>
            Cancel
          </Button>
          <label htmlFor="statement-upload-input">
            <Button
              color="primary"
              disabled={!method || (method === 'blank' && !source)}
              component="span"
              onClick={
                method === 'blank'
                ? this.handleContinueBlank
                : undefined}
            >
              Continue
            </Button>
          </label>
        </DialogActions>
      </Dialog>
    );
  }
}


export default compose(
  withStyles(styles),
  withRouter,
)(StatementAddDialog);
