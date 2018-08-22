
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import FormControl from '@material-ui/core/FormControl';
import FormHelperText from '@material-ui/core/FormHelperText';
import IconButton from '@material-ui/core/IconButton';
import Input from '@material-ui/core/Input';
import InputAdornment from '@material-ui/core/InputAdornment';
import PropTypes from 'prop-types';
import React from 'react';
import Visibility from '@material-ui/icons/Visibility';
import VisibilityOff from '@material-ui/icons/VisibilityOff';
import withMobileDialog from '@material-ui/core/withMobileDialog';
import { binder } from '../../util/binder';
import { callOPNAPI } from '../../util/callapi';
import { connect } from 'react-redux';
import { logIn, logOut } from '../../reducer/login';
import { tokenRefreshSuccess, tokenRefreshCancel } from '../../reducer/app';
import { withStyles } from '@material-ui/core/styles';


const styles = {
};


class TokenRefreshDialog extends React.Component {
  static propTypes = {
    callOPNAPI: PropTypes.func.isRequired,
    classes: PropTypes.object.isRequired,
    fullScreen: PropTypes.bool.isRequired,
    logIn: PropTypes.func.isRequired,
    logOut: PropTypes.func.isRequired,
    personalName: PropTypes.string,
    tokenRefresh: PropTypes.bool.isRequired,
    tokenRefreshSuccess: PropTypes.func.isRequired,
    tokenRefreshCancel: PropTypes.func.isRequired,
    token: PropTypes.string,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
    this.state = {
      password: '',
      showPassword: false,
      submitting: false,
      error: null,
    };
  }

  handleLogOut() {
    this.props.tokenRefreshCancel();
    this.props.logOut();
  }

  handleOk() {
    this.setState({submitting: true, error: null});
    const options = {
      data: {
        password: this.state.password,
      },
      disableRefresh: true,
    };
    this.props.callOPNAPI('/token/refresh', options).then(tokenInfo => {
      this.props.tokenRefreshSuccess(tokenInfo.access_token);
      this.props.logIn(tokenInfo.access_token, this.props.personalName);
      this.setState({submitting: false});
      // Update the personal name.
      this.props.callOPNAPI('/me', {disableRefresh: true}).then(
        profileInfo => {
          if (profileInfo.title !== this.props.personalName) {
            this.props.logIn(tokenInfo.access_token, profileInfo.title);
          }
        });
    }).catch((error) => {
      this.setState({error: String(error), submitting: false});
    });
  }

  handleChangePassword(event) {
    this.setState({password: event.target.value});
  }

  handleClickShowPassword() {
    this.setState(state => ({showPassword: !state.showPassword}));
  }

  handleMouseDownPassword(event) {
    event.preventDefault();
  }

  handleKeyDown(event) {
    if (event.key === 'Enter') {
      this.handleOk();
    }
  }

  render() {
    const { fullScreen, personalName } = this.props;

    let welcome;
    if (personalName) {
      welcome = <span>Welcome back, {personalName}</span>;
    } else {
      welcome = <span>Welcome back</span>;
    }

    let errorContent = null;
    if (this.state.error) {
      errorContent = <FormHelperText>{this.state.error}</FormHelperText>;
    }

    return (
      <Dialog
        open={this.props.tokenRefresh}
        aria-labelledby="form-dialog-title"
        fullScreen={fullScreen}
      >
        <DialogTitle>Password</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {welcome}. Please enter your PIN or password.
          </DialogContentText>
          <FormControl fullWidth error={!!this.state.error}>
            <Input
              autoFocus
              type={this.state.showPassword ? 'text': 'password'}
              value={this.state.password}
              onChange={this.binder('handleChangePassword')}
              onKeyDown={this.binder('handleKeyDown')}
              endAdornment={
                <InputAdornment position="end">
                  <IconButton
                    aria-label="Toggle password visibility"
                    onClick={this.binder('handleClickShowPassword')}
                    onMouseDown={this.binder('handleMouseDownPassword')}
                  >
                    {this.state.showPassword ? <Visibility /> : <VisibilityOff />}
                  </IconButton>
                </InputAdornment>
              }
            />
            {errorContent}
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={this.binder('handleLogOut')} color="primary">
            Sign Out
          </Button>
          <Button onClick={this.binder('handleOk')} color="primary">
            Ok
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
}


const mapStateToProps = (state) => ({
  token: state.login.token,
  tokenRefresh: state.app.tokenRefresh,
  personalName: state.login.personalName,
});


const dispatchToProps = {
  callOPNAPI,
  logIn,
  logOut,
  tokenRefreshSuccess,
  tokenRefreshCancel,
};


// withRouter() seems to be required for any component containing Routes. See:
// https://github.com/ReactTraining/react-router/issues/4671
export default withMobileDialog()(
  withStyles(styles)(
    connect(mapStateToProps, dispatchToProps)(TokenRefreshDialog)));
