import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { injectIntl, intlShape } from 'react-intl';
import { renderPeriodDateString } from '../../util/reportrender';
import { withStyles } from '@material-ui/core/styles';
import FormControl from '@material-ui/core/FormControl';
import Lock from '@material-ui/icons/Lock';
import LockOpen from '@material-ui/icons/LockOpen';
import MenuItem from '@material-ui/core/MenuItem';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Select from '@material-ui/core/Select';


const styles = {
  root: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  controlBox: {
    padding: '4px 16px',
  },
  ploopSelect: {
    width: 400,
  },
  selectRoot: {
    fontSize: '0.9rem',
  },
  periodMenuItem: {
    paddingLeft: '24px',
    position: 'relative',
    height: '16px',
    lineHeight: '16px',
  },
  selectIcon: {
    width: '16px',
    height: '16px',
    position: 'absolute',
    left: '0',
    top: '0',
  },
};


class PeriodSelector extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    intl: intlShape.isRequired,
    period: PropTypes.object,
    ploop: PropTypes.object,
    ploops: PropTypes.object,
    ploopOrder: PropTypes.array,
    loading: PropTypes.bool,
    loadError: PropTypes.bool,
    syncProgress: PropTypes.any,
    redirectToPeriod: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
  }

  handlePloopChange(event) {
    const {
      redirectToPeriod,
      ploops,
    } = this.props;

    const ploopKey = event.target.value;
    const periodId = ploops[ploopKey].period_order[0];
    redirectToPeriod(periodId);
  }

  handlePeriodChange(event) {
    const periodId = event.target.value;
    const {redirectToPeriod} = this.props;
    redirectToPeriod(periodId);
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
      classes,
      ploop,
      intl,
    } = this.props;

    if (ploop && ploop.period_order && ploop.period_order.length) {
      const periodMenuItem = classes.periodMenuItem;
      const selectIcon = classes.selectIcon;
      const res = ploop.period_order.map(periodId => {
        const period = ploop.periods[periodId];
        if (!period) {
          return null;
        }
        return (
          <MenuItem value={periodId} key={periodId}>
            <div className={periodMenuItem}>
              {period.closed ?
                <span title="Closed Period">
                  <Lock className={selectIcon} />
                </span> :
                <span title="Open Period">
                  <LockOpen className={selectIcon} />
                </span>
              }
              {renderPeriodDateString(period, intl)}
            </div>
          </MenuItem>);
      });
      res.push(
        <MenuItem value='periods' key='periods'>
          Period List&hellip;
        </MenuItem>
      );
      return res;
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
      periodValue = period.id;
    } else if (ploop && ploop.period_order && ploop.period_order.length) {
      periodValue = ploop.period_order[0];
    } else {
      periodValue = '';
    }

    return (
      <Paper className={classes.root}>
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
              disableUnderline
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
              disableUnderline
            >
              {periodSelections}
            </Select>
          </FormControl>
        </div>
      </Paper>
    );
  }
}


export default compose(
  withStyles(styles),
  injectIntl,
)(PeriodSelector);
