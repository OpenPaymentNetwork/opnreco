
import PropTypes from 'prop-types';
import React from 'react';
import SwipeableDrawer from '@material-ui/core/SwipeableDrawer';
import { connect } from 'react-redux';
import { openDrawer, closeDrawer } from '../../reducer/app';
import { withStyles } from '@material-ui/core/styles';

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
    classes: PropTypes.object.isRequired,
    drawerOpen: PropTypes.bool,
    openDrawer: PropTypes.func.isRequired,
    closeDrawer: PropTypes.func.isRequired,
  };

  renderContent() {
    return <div>hi!</div>;
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
  };
}

const dispatchToProps = {
  openDrawer,
  closeDrawer,
};

export default withStyles(styles)(
  connect(mapStateToProps, dispatchToProps)(OPNDrawer));
