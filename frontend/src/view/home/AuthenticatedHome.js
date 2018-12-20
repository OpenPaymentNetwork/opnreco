
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReco, ploopsURL, selectableURL } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import LayoutConfig from '../app/LayoutConfig';
import OPNAppBar from '../app/OPNAppBar';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Typography from '@material-ui/core/Typography';


const styles = {
  content: {
    padding: '16px',
  },
  card: {
    textAlign: 'center',
  },
  progressMessage: {
    color: '#777',
  },
};


class AuthenticatedHome extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    ploops: PropTypes.object,
    defaultPloop: PropTypes.string,
    loading: PropTypes.bool,
    loadError: PropTypes.bool,
    syncProgress: PropTypes.any,
    profileTitle: PropTypes.string,
  };

  componentDidMount() {
    this.tryRedirect();
  }

  componentDidUpdate() {
    this.tryRedirect();
  }

  tryRedirect() {
    const {
      ploops,
      defaultPloop,
    } = this.props;

    if (defaultPloop && !this.redirected) {
      const ploop = ploops[defaultPloop];
      const periodId = ploop.periods[ploop.period_order[0]].id;
      this.redirected = true;
      this.props.history.push(`/period/${encodeURIComponent(periodId)}`);
    }
  }

  render() {
    const {
      classes,
      defaultPloop,
      loading,
      loadError,
      syncProgress,
      profileTitle,
    } = this.props;

    let progressMessage = '';
    if (defaultPloop) {
      progressMessage = <span>Loading&hellip;</span>;
    } else {
      if (loading) {
        progressMessage = <span>Loading accounts&hellip;</span>;
      } else if (loadError) {
        progressMessage = <span>Unable to load account list.</span>;
      } else if (syncProgress !== null) {
        let syncMessage;
        if (syncProgress < 0) {
          syncMessage = 'Connecting';
        } else {
          syncMessage = `${syncProgress}%`;
        }
        progressMessage = <span>Syncing ({syncMessage})&hellip;</span>;
      } else {
        if (profileTitle) {
          progressMessage = (
            <span>
              There are no accounts for your
              profile, {profileTitle}.
              Try switching to a different profile.
            </span>);
        } else {
          progressMessage = <span>No accounts found for your profile.</span>;
        }
      }
    }

    return (
      <div className={classes.root}>
        <Require fetcher={fOPNReco} urls={[ploopsURL, selectableURL]} />
        <LayoutConfig title="OPN Reconciliation" />

        <OPNAppBar />

        <div className={classes.content}>
          <Card className={classes.card}>
            <CardContent>
              <Typography variant="h6" component="p"
                  className={classes.progressMessage}>
                {progressMessage}
              </Typography>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
}


function mapStateToProps(state) {
  const fetched = fetchcache.get(state, ploopsURL) || {};
  const loading = fetchcache.fetching(state, ploopsURL);
  const loadError = !!fetchcache.getError(state, ploopsURL);

  let profileTitle = '';
  const selectable = fetchcache.get(state, selectableURL);
  const loginId = state.login.id;
  if (loginId && selectable && selectable.profiles) {
    for (let profile of selectable.profiles) {
      if (profile.id === loginId) {
        profileTitle = profile.title;
        break;
      }
    }
  }

  return {
    ploops: fetched.ploops || {},
    defaultPloop: fetched.default_ploop || '',
    loading,
    loadError,
    syncProgress: state.app.syncProgress,
    profileTitle,
  };
}


export default compose(
  withStyles(styles),
  withRouter,
  connect(mapStateToProps),
)(AuthenticatedHome);
