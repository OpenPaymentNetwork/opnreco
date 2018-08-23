
import CircularProgress from '@material-ui/core/CircularProgress';
import Divider from '@material-ui/core/Divider';
import ExitToApp from '@material-ui/icons/ExitToApp';
import { FormattedRelative } from 'react-intl';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import PropTypes from 'prop-types';
import React from 'react';
import SwipeableDrawer from '@material-ui/core/SwipeableDrawer';
import Sync from '@material-ui/icons/Sync';
import Toolbar from '@material-ui/core/Toolbar';
import { binder } from '../../util/binder';
import { callOPNAPI, callOPNReportAPI } from '../../util/callapi';
import { connect } from 'react-redux';
import { withStyles } from '@material-ui/core/styles';

import { openDrawer, closeDrawer, setSyncProgress, setLoggingOut }
  from '../../reducer/app';


/* global process: false */


const drawerWidth = 240;

const styles = {
  drawerPaper: {
    width: drawerWidth,
  },
};


const iOS = process.browser && /iPad|iPhone|iPod/.test(navigator.userAgent);


class OPNDrawer extends React.Component {
  static propTypes = {
    callOPNAPI: PropTypes.func.isRequired,
    callOPNReportAPI: PropTypes.func.isRequired,
    classes: PropTypes.object.isRequired,
    closeDrawer: PropTypes.func.isRequired,
    drawerOpen: PropTypes.bool,
    openDrawer: PropTypes.func.isRequired,
    setLoggingOut: PropTypes.func.isRequired,
    setSyncProgress: PropTypes.func.isRequired,
    syncedAt: PropTypes.any,
    syncProgress: PropTypes.any,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
    this.state = {
      selectableProfiles: {},
    };
  }

  componentDidMount() {
    if (!this.props.syncedAt && !this.props.syncProgress) {
      // Start an automatic sync.
      window.setTimeout(() => this.handleSync(), 0);
    }
    this.props.callOPNAPI('/token/selectable').then(selectableProfiles => {
      return null;
    });
  }

  getSyncUI() {
    const { syncProgress, syncedAt } = this.props;
    if (syncProgress === null) {
      if (!syncedAt) {
        return {
          icon: <Sync />,
          primary: 'Sync with OPN',
          secondary: 'Not yet synced',
        };
      } else {
        return {
          icon: <Sync />,
          primary: 'Synced with OPN',
          secondary: <FormattedRelative value={syncedAt} />,
        };
      }
    }

    if (syncProgress < 0) {
      return {
        icon: <CircularProgress size={24} />,
        primary: 'Syncing',
        secondary: <span>Connecting&hellip;</span>,
        disabled: true,
      };
    }

    // We could use a determinate spinner here, but the moving
    // indeterminate spinner looks better.
    return {
      icon: (
        <CircularProgress
          size={24}
          variant="indeterminate"
          value={Math.min(syncProgress, 100)}
        />),
      primary: 'Syncing',
      secondary: <span>{syncProgress}%</span>,
      disabled: true,
    };
  }

  handleSync() {
    const {
      callOPNReportAPI,
      syncProgress,
      setSyncProgress,
    } = this.props;

    if (syncProgress !== null) {
      // Already syncing.
      return;
    }

    const syncBatch = () => {
      callOPNReportAPI('/sync', {method: 'post'}).then(status => {
        if (status.more) {
          setSyncProgress(status.progress_percent);
          syncBatch();
        } else {
          // Done.
          setSyncProgress(null, new Date());
        }
      }).catch(() => {
        // An error occurred and has been shown to the user.
        setSyncProgress(null);
      });
    };

    setSyncProgress(-1);
    syncBatch();
  }

  handleSignOut() {
    this.props.setLoggingOut(true);
  }

  renderContent() {
    const syncUI = this.getSyncUI();
    return (<div>
      <Toolbar>
        (Profile selector here)
      </Toolbar>
      <Divider />
      <List component="nav">
        <ListItem
          button
          onClick={this.binder('handleSync')}
          disabled={syncUI.disabled}
        >
          <ListItemIcon>
            {syncUI.icon}
          </ListItemIcon>
          <ListItemText
            primary={syncUI.primary}
            secondary={syncUI.secondary} />
        </ListItem>

        <ListItem
          button
          onClick={this.binder('handleSignOut')}
        >
          <ListItemIcon>
            <ExitToApp />
          </ListItemIcon>
          <ListItemText primary="Sign Out" />
        </ListItem>

      </List>
    </div>);
  }

  render() {
    const { classes, drawerOpen } = this.props;
    const drawerContent = this.renderContent();
    return (
      <div>
        <SwipeableDrawer
          open={drawerOpen}
          onOpen={this.props.openDrawer}
          onClose={this.props.closeDrawer}
          classes={{
            paper: classes.drawerPaper,
          }}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          // Optimizations recommended by the Material-UI docs:
          disableBackdropTransition={!iOS}
          disableDiscovery={iOS}
        >
          {drawerContent}
        </SwipeableDrawer>
      </div>
    );
  }
}


function mapStateToProps(state) {
  return {
    drawerOpen: state.app.drawerOpen,
    syncProgress: state.app.syncProgress,
    syncedAt: state.app.syncedAt,
  };
}

const dispatchToProps = {
  callOPNAPI,
  callOPNReportAPI,
  closeDrawer,
  openDrawer,
  setLoggingOut,
  setSyncProgress,
};

export default withStyles(styles)(
  connect(mapStateToProps, dispatchToProps)(OPNDrawer));
