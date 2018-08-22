
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
import { logOut } from '../../reducer/login';
import { tokenRefreshCancel, setLoggingOut } from '../../reducer/app';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';


const styles = {
};


class LogoutDialog extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    history: PropTypes.object.isRequired,
    loggingOut: PropTypes.bool.isRequired,
    logOut: PropTypes.func.isRequired,
    setLoggingOut: PropTypes.func.isRequired,
    tokenRefreshCancel: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
    this.state = {
      password: '',
      showPassword: false,
    };
  }

  handleLogout() {
    this.props.tokenRefreshCancel();
    this.props.logOut();
    window.setTimeout(() => this.props.history.push('/'), 0);
  }

  handleCancel() {
    this.props.setLoggingOut(false);
  }

  render() {
    return (
      <Dialog
        open={this.props.loggingOut}
        onClose={this.binder('handleCancel')}
        aria-labelledby="form-dialog-title"
      >
        <DialogTitle id="form-dialog-title">Sign Out</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to sign out?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={this.binder('handleCancel')} color="primary">
            Cancel
          </Button>
          <Button onClick={this.binder('handleLogout')} color="primary">
            Sign Out
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
}


const mapStateToProps = (state) => ({
  loggingOut: state.app.loggingOut,
});


const dispatchToProps = {
  logOut,
  tokenRefreshCancel,
  setLoggingOut,
};


export default withRouter(
  withStyles(styles)(
    connect(mapStateToProps, dispatchToProps)(LogoutDialog)));
