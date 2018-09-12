
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
import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { fOPN } from '../../util/fetcher';
import { connect } from 'react-redux';
import { logIn, logOut } from '../../reducer/login';
import { tokenRefreshSuccess, tokenRefreshCancel } from '../../reducer/app';
import { withStyles } from '@material-ui/core/styles';


const styles = {
};


class TokenRefreshDialog extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    personalProfile: PropTypes.object,
    tokenRefresh: PropTypes.bool.isRequired,
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
    const {dispatch} = this.props;
    dispatch(tokenRefreshCancel());
    dispatch(logOut());
  }

  handleOk() {
    const {dispatch} = this.props;
    this.setState({submitting: true, error: null});
    const options = {
      data: {
        password: this.state.password,
      },
      disableTokenRefresh: true,
    };
    const action1 = fOPN.fetchPath('/token/refresh', options);
    dispatch(action1).then(tokenInfo => {
      const {personalProfile} = this.props;
      dispatch(tokenRefreshSuccess(tokenInfo.access_token));
      dispatch(logIn(tokenInfo.access_token, personalProfile));
      this.setState({submitting: false});
      // Update the personal profile ID and title.
      const action2 = fOPN.fetchPath('/me', {disableTokenRefresh: true});
      dispatch(action2).then(profileInfo => {
        if (!personalProfile ||
            profileInfo.id !== personalProfile.id ||
            profileInfo.title !== personalProfile.title) {
          dispatch(logIn(tokenInfo.access_token, {
            id: profileInfo.id,
            title: profileInfo.title,
          }));
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
    const { personalProfile } = this.props;

    let welcome;
    if (personalProfile && personalProfile.title) {
      welcome = <span>Welcome back, {personalProfile.title}</span>;
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
      >
        <DialogTitle>OPN Password</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {welcome}. Please enter your password.
          </DialogContentText>
          <FormControl fullWidth error={!!this.state.error}>
            <Input
              autoFocus
              type={this.state.showPassword ? 'text': 'password'}
              value={this.state.password}
              onChange={this.binder(this.handleChangePassword)}
              onKeyDown={this.binder(this.handleKeyDown)}
              endAdornment={
                <InputAdornment position="end">
                  <IconButton
                    aria-label="Toggle password visibility"
                    onClick={this.binder(this.handleClickShowPassword)}
                    onMouseDown={this.binder(this.handleMouseDownPassword)}
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
          <Button onClick={this.binder(this.handleLogOut)} color="primary">
            Sign Out
          </Button>
          <Button onClick={this.binder(this.handleOk)} color="primary">
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


export default compose(
  withStyles(styles),
  connect(mapStateToProps),
)(TokenRefreshDialog);
