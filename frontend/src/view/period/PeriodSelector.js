import { compose } from '../../util/functional';
import { injectIntl } from 'react-intl';
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
  fileSelect: {
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
  archivedFileName: {
    textDecoration: 'line-through',
  },
};


class PeriodSelector extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    intl: PropTypes.object.isRequired,
    period: PropTypes.object,
    file: PropTypes.object,
    files: PropTypes.object,
    fileOrder: PropTypes.array,
    loading: PropTypes.bool,
    loadError: PropTypes.bool,
    syncProgress: PropTypes.any,
    redirectToFile: PropTypes.func.isRequired,
    redirectToPeriod: PropTypes.func.isRequired,
  };

  handleFileChange = (event) => {
    const fileId = event.target.value;
    this.props.redirectToFile(fileId);
  }

  handlePeriodChange = (event) => {
    const periodId = event.target.value;
    this.props.redirectToPeriod(periodId);
  }

  renderFileSelections() {
    const {
      classes,
      files,
      fileOrder,
      loading,
      loadError,
      syncProgress,
    } = this.props;

    if (fileOrder && fileOrder.length) {
      const res = fileOrder.map(fileId => {
        const file = files[fileId];
        let fileName = `${file.title} (${file.currency})`;
        if (file.archived) {
          fileName = (
            <span className={classes.archivedFileName}>{fileName}</span>);
        }
        return (
          <MenuItem value={fileId} key={fileId}>File: {fileName}</MenuItem>);
      });

      res.push(
        <MenuItem value="" key="files">
          File List&hellip;
        </MenuItem>
      );

      return res;

    } else {
      let errorMessage;
      if (loading) {
        errorMessage = <em>Loading files&hellip;</em>;
      } else if (loadError) {
        errorMessage = <em>Unable to load file list</em>;
      } else if (syncProgress !== null) {
        let syncMessage;
        if (syncProgress < 0) {
          syncMessage = 'Connecting';
        } else {
          syncMessage = `${syncProgress}%`;
        }
        errorMessage = <em>Syncing ({syncMessage})&hellip;</em>;
      } else {
        errorMessage = <em>No files found for your profile</em>;
      }
      return [
        <MenuItem value="#error" key="#error">
          {errorMessage}
        </MenuItem>,
        <MenuItem value="" key="files">
          File List&hellip;
        </MenuItem>
      ];
    }
  }

  renderPeriodSelections() {
    const {
      classes,
      file,
      intl,
    } = this.props;

    if (file && file.period_order && file.period_order.length) {
      const periodMenuItem = classes.periodMenuItem;
      const selectIcon = classes.selectIcon;
      const res = file.period_order.map(periodId => {
        const period = file.periods[periodId];
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
        <MenuItem value="" key="periods">
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
      file,
      fileOrder,
      period,
    } = this.props;

    const fileSelections = this.renderFileSelections();
    const periodSelections = this.renderPeriodSelections();

    let fileValue;
    if (file) {
      fileValue = file.id;
    } else if (fileOrder && fileOrder.length) {
      fileValue = fileOrder[0];
    } else {
      fileValue = '#error';
    }

    let periodValue;
    if (period) {
      periodValue = period.id;
    } else if (file && file.period_order && file.period_order.length) {
      periodValue = file.period_order[0];
    } else {
      periodValue = '';
    }

    return (
      <Paper className={classes.root}>
        <div className={classes.controlBox}>
          <FormControl>
            <Select
              className={classes.fileSelect}
              classes={{root: classes.selectRoot}}
              value={fileValue}
              onChange={this.handleFileChange}
              inputProps={{
                id: 'select-file',
              }}
              disableUnderline
            >
              {fileSelections}
            </Select>
          </FormControl>
        </div>
        <div className={classes.controlBox}>
          <FormControl>
            <Select
              className={classes.periodSelect}
              classes={{root: classes.selectRoot}}
              value={periodValue}
              onChange={this.handlePeriodChange}
              inputProps={{
                id: 'select-period',
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
