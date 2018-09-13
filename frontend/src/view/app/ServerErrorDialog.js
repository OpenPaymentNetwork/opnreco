
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
import { setServerError } from '../../reducer/app';


class ServerErrorDialog extends React.Component {
  static propTypes = {
    serverError: PropTypes.string,
    dispatch: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
  }

  handleClose() {
    this.props.dispatch(setServerError(null));
  }

  render() {
    const {serverError} = this.props;
    return (
      <Dialog
        open={!!serverError}
        onClose={this.binder(this.handleClose)}
        aria-labelledby="error-dialog-title"
      >
        <DialogTitle id="error-dialog-title">Server Error</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {serverError}
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
  serverError: state.app.serverError,
});


export default connect(mapStateToProps)(ServerErrorDialog);
