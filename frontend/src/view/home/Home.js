import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReport } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { toggleDrawer } from '../../reducer/app';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import Hidden from '@material-ui/core/Hidden';
import IconButton from '@material-ui/core/IconButton';
import Linger from '../../util/Linger';
import MenuIcon from '@material-ui/icons/Menu';
import PropTypes from 'prop-types';
import React from 'react';
import RecoPopover from '../report/RecoPopover';
import FileSelector from '../report/FileSelector';
import Tab from '@material-ui/core/Tab';
import TabContent from './TabContent';
import Tabs from '@material-ui/core/Tabs';


const styles = theme => ({
  root: {
  },
  topLine: {
    [theme.breakpoints.up('md')]: {
      display: 'flex',
      alignItems: 'flex-end',
    },
    backgroundColor: theme.palette.primary.main,
    color: '#fff',
    paddingLeft: 32,
    minHeight: '94px',
    position: 'relative',
  },
  fileSelectorBox: {
    padding: 16,
  },
  tabs: {
    flexGrow: '1',
  },
  menuButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    color: '#fff',
  },
});


class Home extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    match: PropTypes.object.isRequired,
    ploop: PropTypes.object,
    file: PropTypes.object,
    recoPopoverOpen: PropTypes.bool,
    transferId: PropTypes.string,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
  }

  handleToggleDrawer() {
    this.props.dispatch(toggleDrawer());
  }

  handleTabChange(event, value) {
    if (value === 't' && this.props.transferId) {
      this.props.history.push(`/${value}/${this.props.transferId}`);
    } else {
      this.props.history.push(`/${value}`);
    }
  }

  handleTabClick(event) {
    if (event.button === 0) {
      event.preventDefault();
    }
  }

  render() {
    const {
      classes,
      file,
      match,
      ploop,
      recoPopoverOpen,
      transferId,
    } = this.props;

    const tab = match.params.tab || 'reco';

    const transferPath = transferId ? `/t/${transferId}` : '/t';
    const tabs = (
      <Tabs
        className={classes.tabs}
        value={tab}
        scrollable
        scrollButtons="auto"
        onChange={this.binder(this.handleTabChange)}
      >
        <Tab value="reco" label="Reconciliation" href="/reco"
          onClick={this.binder(this.handleTabClick)} />
        <Tab value="transactions" label="Transactions" href="/transactions"
          onClick={this.binder(this.handleTabClick)} />
        <Tab value="t" label="Transfer Summary" href={transferPath}
          onClick={this.binder(this.handleTabClick)} />
      </Tabs>
    );

    const filterBox = (
      <div className={classes.fileSelectorBox}>
        <FileSelector ploop={ploop} file={file} />
      </div>
    );

    return (
      <div className={classes.root}>

        <div className={classes.topLine}>

          <IconButton
            className={classes.menuButton}
            color="inherit"
            aria-label="Menu"
            onClick={this.binder(this.handleToggleDrawer)}
          >
            <MenuIcon />
          </IconButton>

          <Hidden mdUp>
            {filterBox}
            {tabs}
          </Hidden>

          <Hidden smDown>
            {tabs}
            {filterBox}
          </Hidden>

        </div>

        <TabContent tab={tab} ploop={ploop} file={file} />

        <Linger enabled={recoPopoverOpen}>
          <RecoPopover />
        </Linger>

      </div>
    );
  }
}

const ploopsURL = fOPNReport.pathToURL('/ploops');


function mapStateToProps(state) {
  const {ploopKey, fileId, recoPopover} = state.report;
  const fetched = fetchcache.get(state, ploopsURL) || {};
  const ploops = fetched.ploops || {};
  const ploopOrder = fetched.ploop_order;
  let selectedPloopKey = ploopKey;

  if (ploopOrder && ploopOrder.length) {
    if (!selectedPloopKey || !ploops[selectedPloopKey]) {
      selectedPloopKey = fetched.default_ploop || '';
    }

    if (!selectedPloopKey) {
      selectedPloopKey = ploopOrder[0];
    }
  } else {
    selectedPloopKey = '';
  }

  const ploop = selectedPloopKey ? ploops[selectedPloopKey] : null;

  let file = null;
  if (ploop && ploop.files) {
    if (fileId) {
      file = ploop.files[fileId];
    } else if (ploop.file_order && ploop.file_order.length) {
      file = ploop.files[ploop.file_order[0]];
    }
  }

  return {
    recoPopoverOpen: recoPopover.open,
    ploop,
    file,
    transferId: state.app.transferId,
  };
}


export default compose(
  withStyles(styles, {withTheme: true}),
  withRouter,
  connect(mapStateToProps),
)(Home);
