
import About from '../about';
import Home from '../home';
import LoginRedirect from '../login/loginredirect';
import LoginView from '../login';
import OAuth2CallbackView from '../login/oauth2cb';
import OPNAppBar from './OPNAppBar';
import OPNDrawer from './OPNDrawer';
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { Switch, Route } from 'react-router';
import { withRouter } from 'react-router';
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


class App extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    token: PropTypes.string,
  };

  render() {
    if (!this.props.token) {
      return (
        <Switch>
          <Route path="/login" component={LoginView} />
          <Route path="/oauth2cb" component={OAuth2CallbackView} />
          <Route component={LoginRedirect} />
        </Switch>
      );
    }

    const { classes } = this.props;

    return (
      <div className={classes.root}>
        <OPNAppBar />
        <div className={classes.belowAppBar}>
          <OPNDrawer />
          <main className={classes.main}>
            <Route exact path="/" component={Home} />
            <Route exact path="/about-us" component={About} />
          </main>
        </div>
      </div>
    );
  }
}


const mapStateToProps = (state) => ({
  token: state.login.token,
});


// withRouter() seems to be required for any component containing Routes. See:
// https://github.com/ReactTraining/react-router/issues/4671
export default withStyles(styles, { withTheme: true })(
  withRouter(connect(mapStateToProps)(App)));
