
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
import { withStyles } from '@material-ui/core/styles';


const styles = {
};


class ServerErrorDialog extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    serverError: PropTypes.string,
    setServerError: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
  }

  handleClose() {
    this.props.setServerError(null);
  }

  render() {
    const {serverError} = this.props;
    return (
      <Dialog
        open={!!serverError}
        onClose={this.binder('handleClose')}
        aria-labelledby="error-dialog-title"
      >
        <DialogTitle id="error-dialog-title">Server Error</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {serverError}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={this.binder('handleClose')} color="primary">
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


const dispatchToProps = {
  setServerError,
};


export default withStyles(styles)(
  connect(mapStateToProps, dispatchToProps)(ServerErrorDialog));
