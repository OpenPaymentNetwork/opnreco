
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReco, filesURL, selectableURL } from '../../util/fetcher';
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
    files: PropTypes.object,
    defaultFileId: PropTypes.string,
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
      files,
      defaultFileId,
    } = this.props;

    if (!this.redirected) {
      if (defaultFileId) {
        const file = files[defaultFileId];
        if (file.period_order.length) {
          const periodId = file.periods[file.period_order[0]].id;
          this.redirected = true;
          this.props.history.push(`/period/${encodeURIComponent(periodId)}`);
        }
      }
    }
  }

  render() {
    const {
      classes,
      defaultFileId,
      files,
      loading,
      loadError,
      syncProgress,
      profileTitle,
    } = this.props;

    let progressMessage = '';
    if (defaultFileId) {
      if (files[defaultFileId].period_order.length) {
        progressMessage = <span>Loading&hellip;</span>;
      } else {
        progressMessage = <span>The default file has no periods.</span>;
      }
    } else {
      if (loading) {
        progressMessage = <span>Loading files&hellip;</span>;
      } else if (loadError) {
        progressMessage = <span>Unable to load file list.</span>;
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
              There are no files for your
              profile, {profileTitle}.
              Try switching to a different profile.
            </span>);
        } else {
          progressMessage = <span>No files found for your profile.</span>;
        }
      }
    }

    return (
      <div className={classes.root}>
        <Require fetcher={fOPNReco} urls={[filesURL, selectableURL]} />
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
  const fetched = fetchcache.get(state, filesURL) || {};
  const loading = fetchcache.fetching(state, filesURL);
  const loadError = !!fetchcache.getError(state, filesURL);

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
    files: fetched.files || {},
    defaultFileId: fetched.default_file_id || '',
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
