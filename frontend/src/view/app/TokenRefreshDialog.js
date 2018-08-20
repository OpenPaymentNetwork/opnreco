
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import PropTypes from 'prop-types';
import React from 'react';
import TextField from '@material-ui/core/TextField';
import { binder } from '../../util/binder';
import { connect } from 'react-redux';
import { withStyles } from '@material-ui/core/styles';


const styles = theme => ({
  root: {
    position: 'relative',
    width: '100%',
  },
  belowAppBar: {
    flexGrow: 1,
    backgroundColor: theme.palette.background.default,
  },
  main: {
    padding: theme.spacing.unit * 2,
  },
});


class TokenRefreshDialog extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    fullScreen: PropTypes.bool.isRequired,
    token: PropTypes.string,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
  }

  handleLogOut() {

  }

  handleOk() {

  }

  render() {
    const { fullScreen } = this.props;
    return (
      <Dialog
        open={this.state.open}
        onClose={this.handleClose}
        aria-labelledby="form-dialog-title"
        fullScreen={fullScreen}
      >
        <DialogTitle id="form-dialog-title">Password</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Welcome back! Please enter your password.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            id="name"
            label="Password"
            type="password"
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={this.binder('handleLogOut')} color="secondary">
            Log Out
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
});


// withRouter() seems to be required for any component containing Routes. See:
// https://github.com/ReactTraining/react-router/issues/4671
export default withStyles(styles, { withTheme: true })(
  connect(mapStateToProps)(TokenRefreshDialog));
