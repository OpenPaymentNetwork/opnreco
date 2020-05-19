
import { compose } from '../../util/functional';
import { injectIntl } from 'react-intl';
import { renderPeriodDateString } from '../../util/reportrender';
import { withStyles } from '@material-ui/core/styles';
import Lock from '@material-ui/icons/Lock';
import LockOpen from '@material-ui/icons/LockOpen';
import MenuItem from '@material-ui/core/MenuItem';
import PropTypes from 'prop-types';
import React from 'react';
import Select from '@material-ui/core/Select';


const styles = {
  menuItem: {
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


/**
 * A select widget for choosing the period of a reco or statement.
 */
class PeriodAssignSelect extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    intl: PropTypes.object.isRequired,
    periods: PropTypes.array,
  };

  render() {
    const {
      classes,
      periods,
      intl,
      ...otherProps
    } = this.props;

    const {
      menuItem,
      selectIcon,
    } = classes;

    return (
      <Select {...otherProps}>
        {(periods || []).map(period => (
          <MenuItem key={period.id} value={period.id}>
            <div className={menuItem}>
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
          </MenuItem>
        ))}
      </Select>
    );
  }
}


export default compose(
  withStyles(styles),
  injectIntl,
)(PeriodAssignSelect);
