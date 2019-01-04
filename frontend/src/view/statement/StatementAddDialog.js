
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
    onCancel: PropTypes.func.isRequired,
    open: PropTypes.bool,
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

  handleContinueBlank = () => {

  }

  render() {
    const {
      classes,
      onCancel,
      ...otherProps
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
          style={{display: 'none'}} />
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
        onClose={onCancel}
        aria-labelledby="form-dialog-title"
        {...otherProps}
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
                    Import from a spreadsheet (<a
                      href="/template/Statement-Template-V1.xls">
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
          <Button onClick={onCancel}>
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


export default withStyles(styles)(StatementAddDialog);
