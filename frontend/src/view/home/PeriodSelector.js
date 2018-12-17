import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReco } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { injectIntl, intlShape } from 'react-intl';
import { renderPeriodDateString } from '../../util/reportrender';
import { setPloopKey, setPeriodId } from '../../reducer/report';
import { withStyles } from '@material-ui/core/styles';
import FormControl from '@material-ui/core/FormControl';
import MenuItem from '@material-ui/core/MenuItem';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import Select from '@material-ui/core/Select';


const styles = theme => ({
  root: {
    [theme.breakpoints.up('md')]: {
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
    },
  },
  controlBox: {
    padding: 16,
  },
  ploopSelect: {
    [theme.breakpoints.up('md')]: {
      width: 250,
    },
    [theme.breakpoints.up('lg')]: {
      width: 400,
    },
  },
  periodSelect: {
  },
  selectRoot: {
    fontSize: '0.9rem',
  },
});

const ploopsURL = fOPNReco.pathToURL('/ploops');


class PeriodSelector extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    intl: intlShape.isRequired,
    period: PropTypes.object,
    ploop: PropTypes.object,
    ploops: PropTypes.object,
    ploopOrder: PropTypes.array,
    loading: PropTypes.bool,
    loadError: PropTypes.bool,
    syncProgress: PropTypes.any,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
  }

  handlePloopChange(event) {
    this.props.dispatch(setPloopKey(event.target.value));
  }

  handlePeriodChange(event) {
    this.props.dispatch(setPeriodId(event.target.value));
  }

  renderPloopSelections() {
    const {
      ploops,
      ploopOrder,
      loading,
      loadError,
      syncProgress,
    } = this.props;

    if (ploopOrder && ploopOrder.length) {
      return ploopOrder.map(ploopKey => {
        const ploop = ploops[ploopKey];
        let peerType;
        if (ploop.peer_id === 'c') {
          peerType = 'Circulation';
        } else if (ploop.peer_is_dfi_account) {
          peerType = 'DFI Account';
        } else {
          peerType = 'Wallet';
        }
        return (
          <MenuItem value={ploopKey} key={ploopKey}>
            {ploop.peer_title} ({peerType}) -
            {' '}{ploop.currency}
            {' '}{ploop.loop_id === '0' ? 'Open Loop' : ploop.loop_title}
          </MenuItem>
        );
      });

    } else {
      let errorMessage;
      if (loading) {
        errorMessage = <em>Loading accounts&hellip;</em>;
      } else if (loadError) {
        errorMessage = <em>Unable to load account list</em>;
      } else if (syncProgress !== null) {
        let syncMessage;
        if (syncProgress < 0) {
          syncMessage = 'Connecting';
        } else {
          syncMessage = `${syncProgress}%`;
        }
        errorMessage = <em>Syncing ({syncMessage})&hellip;</em>;
      } else {
        errorMessage = <em>No accounts found for your profile</em>;
      }
      return [
        <MenuItem value="#error" key="#error">
          {errorMessage}
        </MenuItem>
      ];
    }
  }

  renderPeriodSelections() {
    const {
      ploop,
      intl,
    } = this.props;

    if (ploop && ploop.period_order && ploop.period_order.length) {
      return ploop.period_order.map(periodId => {
        const period = ploop.periods[periodId];
        return (
          <MenuItem value={periodId} key={periodId}>
            {period ? renderPeriodDateString(period, intl) : null}
          </MenuItem>);
      });
    } else {
      return [];
    }
  }

  render() {
    const {
      classes,
      ploop,
      ploopOrder,
      period,
    } = this.props;

    const ploopSelections = this.renderPloopSelections();
    const periodSelections = this.renderPeriodSelections();

    let ploopValue;
    if (ploop) {
      ploopValue = ploop.ploop_key;
    } else if (ploopOrder && ploopOrder.length) {
      ploopValue = ploopOrder[0];
    } else {
      ploopValue = '#error';
    }

    let periodValue;
    if (period) {
      periodValue = period.period_id;
    } else if (ploop && ploop.period_order && ploop.period_order.length) {
      periodValue = ploop.period_order[0];
    } else {
      periodValue = '';
    }

    return (
      <Paper className={classes.root}>
        <Require fetcher={fOPNReco} urls={[ploopsURL]} />
        <div className={classes.controlBox}>
          <FormControl>
            <Select
              className={classes.ploopSelect}
              classes={{root: classes.selectRoot}}
              value={ploopValue}
              onChange={this.binder(this.handlePloopChange)}
              inputProps={{
                id: 'filter-ploop',
              }}
            >
              {ploopSelections}
            </Select>
          </FormControl>
        </div>
        <div className={classes.controlBox}>
          <FormControl>
            <Select
              className={classes.periodSelect}
              classes={{root: classes.selectRoot}}
              value={periodValue}
              onChange={this.binder(this.handlePeriodChange)}
              inputProps={{
                id: 'filter-period',
              }}
            >
              {periodSelections}
            </Select>
          </FormControl>
        </div>
      </Paper>
    );
  }
}


function mapStateToProps(state) {
  const fetched = fetchcache.get(state, ploopsURL) || {};
  const loading = fetchcache.fetching(state, ploopsURL);
  const loadError = !!fetchcache.getError(state, ploopsURL);
  return {
    ploopsURL,
    ploops: fetched.ploops || {},
    ploopOrder: fetched.ploop_order || [],
    loading,
    loadError,
    syncProgress: state.app.syncProgress,
  };
}


export default compose(
  withStyles(styles, {withTheme: true}),
  injectIntl,
  connect(mapStateToProps),
)(PeriodSelector);
