
import AppBar from '@material-ui/core/AppBar';
import IconButton from '@material-ui/core/IconButton';
import MenuIcon from '@material-ui/icons/Menu';
import PropTypes from 'prop-types';
import React from 'react';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { toggleDrawer } from '../../reducer/app';
import { withStyles } from '@material-ui/core/styles';


const styles = {
  root: {
  },
  title: {
    flex: 1,
  },
  menuButton: {
    marginLeft: -12,
    marginRight: 20,
  },
};


class OPNAppBar extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    layout: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
  };

  handleToggleDrawer = () => {
    this.props.dispatch(toggleDrawer());
  };

  render() {
    const { classes, layout } = this.props;
    return (
      <div className={classes.root}>
        <AppBar position="static">
          <Toolbar>
            <IconButton
              className={classes.menuButton}
              color="inherit"
              aria-label="Menu"
              onClick={this.handleToggleDrawer}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" color="inherit" className={classes.title}>
              {layout.title}
            </Typography>
          </Toolbar>
        </AppBar>
      </div>
    );
  }
}


function mapStateToProps(state) {
  return {
    layout: state.app.layout,
  };
}


export default compose(
  withStyles(styles),
  connect(mapStateToProps),
)(OPNAppBar);
