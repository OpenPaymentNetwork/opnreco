
import { binder } from '../../util/binder';
import { closeRecoPopover } from '../../reducer/report';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { withStyles } from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import React from 'react';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';
import Typography from '@material-ui/core/Typography';
import Popover from '@material-ui/core/Popover';
import Fade from '@material-ui/core/Fade';


const styles = theme => ({
  tabs: {
    backgroundColor: theme.palette.primary.main,
    color: '#fff',
  },
});


class RecoPopover extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    open: PropTypes.bool,
    anchorEl: PropTypes.object,
    recoInternal: PropTypes.bool,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
  }

  handleClose() {
    this.props.dispatch(closeRecoPopover());
  }

  render() {
    const {
      classes,
      open,
      anchorEl,
      recoInternal,
    } = this.props;

    return (
      <Popover
        id="reco-popover"
        open={open}
        anchorEl={anchorEl}
        onClose={this.binder(this.handleClose)}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        TransitionComponent={Fade}
      >
        <div className={classes.popoverContent}>
          <Tabs
            className={classes.tabs}
            classes={{indicator: classes.tabsIndicator}}
            value={recoInternal ? 'internal': 'account'}
          >
            <Tab value="account" label="Account" />
            <Tab value="internal" label="Internal" />
            <Tab value="remove" label="Remove" />
          </Tabs>
        </div>
      </Popover>
    );
  }
}


function mapStateToProps(state) {
  return state.report.recoPopover;
}


export default compose(
  withStyles(styles, {withTheme: true}),
  connect(mapStateToProps),
)(RecoPopover);
