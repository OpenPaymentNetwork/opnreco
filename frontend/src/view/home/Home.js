import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fetchcache } from '../../reducer/fetchcache';
import { fOPNReco } from '../../util/fetcher';
import { getPloopAndPeriod } from '../../util/period';
import { toggleDrawer } from '../../reducer/app';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import CircularProgress from '@material-ui/core/CircularProgress';
import PeriodSelector from './PeriodSelector';
import Hidden from '@material-ui/core/Hidden';
import IconButton from '@material-ui/core/IconButton';
import MenuIcon from '@material-ui/icons/Menu';
import PropTypes from 'prop-types';
import React from 'react';
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
  periodSelectorBox: {
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
  waitContainer: {
    padding: '16px',
    textAlign: 'center',
  },
});


class Home extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    match: PropTypes.object.isRequired,
    ploop: PropTypes.object,
    period: PropTypes.object,
    transferId: PropTypes.string,
    ploopsLoaded: PropTypes.bool,
    syncing: PropTypes.bool,
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
      period,
      match,
      ploop,
      transferId,
      ploopsLoaded,
      syncing,
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
        <Tab value="t" label="Transfer" href={transferPath}
          onClick={this.binder(this.handleTabClick)} />
        <Tab value="period" label="Periods" href="/period"
          onClick={this.binder(this.handleTabClick)} />
      </Tabs>
    );

    const filterBox = (
      <div className={classes.periodSelectorBox}>
        <PeriodSelector ploop={ploop} period={period} />
      </div>
    );

    let tabContent;

    if (ploop) {
      tabContent = <TabContent tab={tab} ploop={ploop} period={period} />;
    } else if (!ploopsLoaded || syncing) {
      tabContent = (
        <div className={classes.waitContainer}>
          <CircularProgress size={24} className={classes.waitSpinner}/>
        </div>
      );
    } else {
      // Not syncing and no accounts are available for the profile owner.
      tabContent = null;
    }

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

        {tabContent}
      </div>
    );
  }
}

function mapStateToProps(state) {
  const {ploop, period} = getPloopAndPeriod(state);

  return {
    ploop,
    period,
    transferId: state.app.transferId,
    ploopsLoaded: !!fetchcache.get(state, fOPNReco.pathToURL('/ploops')),
    syncing: state.app.syncProgress !== null,
  };
}


export default compose(
  withStyles(styles, {withTheme: true}),
  withRouter,
  connect(mapStateToProps),
)(Home);
