
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
import { fOPN } from '../../util/fetcher';
import { connect } from 'react-redux';
import { setAccessToken, logOut } from '../../reducer/login';
import { tokenRefreshSuccess, tokenRefreshCancel } from '../../reducer/app';


class TokenRefreshDialog extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    profileId: PropTypes.string.isRequired,
    personalProfile: PropTypes.object,
    tokenRefresh: PropTypes.bool.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      password: '',
      showPassword: false,
      submitting: false,
      error: null,
    };
  }

  handleLogOut = () => {
    const { dispatch } = this.props;
    dispatch(tokenRefreshCancel());
    dispatch(logOut());
  };

  handleOk = () => {
    const { dispatch, profileId } = this.props;
    this.setState({ submitting: true, error: null });
    const options = {
      data: {
        password: this.state.password,
      },
      disableTokenRefresh: true,
    };
    const action1 = fOPN.fetchPath('/token/refresh', options);
    dispatch(action1).then(tokenInfo => {
      const token = tokenInfo.access_token;
      setAccessToken(profileId, token);
      dispatch(tokenRefreshSuccess(token));
      this.setState({ submitting: false });
    }).catch((error) => {
      this.setState({ error: String(error), submitting: false });
    });
  };

  handleChangePassword = (event) => {
    this.setState({ password: event.target.value });
  };

  handleClickShowPassword = () => {
    this.setState(state => ({ showPassword: !state.showPassword }));
  };

  handleMouseDownShowPassword = (event) => {
    event.preventDefault();
  };

  handleKeyDown = (event) => {
    // Matching the string 'Enter' is reliable thanks to React's
    // SyntheticEvent, which conforms to the DOM level 3 events spec:
    // https://www.w3.org/TR/uievents-key/#keys-whitespace
    if (event.key === 'Enter') {
      this.handleOk();
    }
  };

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
              type={this.state.showPassword ? 'text' : 'password'}
              value={this.state.password}
              onChange={this.handleChangePassword}
              onKeyDown={this.handleKeyDown}
              endAdornment={
                <InputAdornment position="end">
                  <IconButton
                    aria-label="Toggle password visibility"
                    onClick={this.handleClickShowPassword}
                    onMouseDown={this.handleMouseDownShowPassword}
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
          <Button onClick={this.handleLogOut} color="primary">
            Sign Out
          </Button>
          <Button onClick={this.handleOk} color="primary">
            Ok
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
}


const mapStateToProps = (state) => ({
  tokenRefresh: state.app.tokenRefresh,
  personalProfile: state.login.personalProfile,
  profileId: state.login.id,
});


export default connect(mapStateToProps)(TokenRefreshDialog);
