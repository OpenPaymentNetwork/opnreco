
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import PropTypes from 'prop-types';
import React from 'react';
import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
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
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    loggingOut: PropTypes.bool.isRequired,
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
    const {dispatch} = this.props;
    dispatch(tokenRefreshCancel());
    dispatch(logOut());
    window.setTimeout(() => this.props.history.push('/'), 0);
  }

  handleCancel() {
    this.props.dispatch(setLoggingOut(false));
  }

  render() {
    return (
      <Dialog
        open={!!this.props.loggingOut}
        onClose={this.binder(this.handleCancel)}
        aria-labelledby="form-dialog-title"
      >
        <DialogTitle id="form-dialog-title">Sign Out</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to sign out?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={this.binder(this.handleCancel)} color="primary">
            Cancel
          </Button>
          <Button onClick={this.binder(this.handleLogout)} color="primary">
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


export default compose(
  withRouter,
  withStyles(styles),
  connect(mapStateToProps),
)(LogoutDialog);
