
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import PropTypes from 'prop-types';
import React from 'react';
import { binder } from '../../util/binder';
import { connect } from 'react-redux';
import { closeServerError } from '../../reducer/app';


class ServerErrorDialog extends React.Component {
  static propTypes = {
    error: PropTypes.string,
    open: PropTypes.bool,
    dispatch: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
  }

  handleClose() {
    this.props.dispatch(closeServerError());
  }

  render() {
    const {error, open} = this.props;
    let errorText = String(error);
    if (errorText.startsWith('Error: ')) {
      // Remove the redundant 'Error: ' prefix.
      errorText = errorText.substr(7);
    }
    return (
      <Dialog
        open={!!open}
        onClose={this.binder(this.handleClose)}
        aria-labelledby="error-dialog-title"
      >
        <DialogTitle id="error-dialog-title">Error</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {errorText}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={this.binder(this.handleClose)} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
}


const mapStateToProps = (state) => ({
  error: state.app.serverError,
  open: state.app.serverErrorOpen,
});


export default connect(mapStateToProps)(ServerErrorDialog);
