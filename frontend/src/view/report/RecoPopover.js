
import { binder, binder1 } from '../../util/binder';
import { closeRecoPopover } from '../../reducer/report';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { dashed } from '../../util/transferfmt';
import { fetchcache } from '../../reducer/fetchcache';
import { fOPNReport } from '../../util/fetcher';
import { FormattedDate, FormattedTime } from 'react-intl';
import { getCurrencyDeltaFormatter } from '../../util/currency';
import { getPloopAndFile } from '../../util/ploopfile';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Close from '@material-ui/icons/Close';
import Fade from '@material-ui/core/Fade';
import IconButton from '@material-ui/core/IconButton';
import Popover from '@material-ui/core/Popover';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import Typography from '@material-ui/core/Typography';


const styles = theme => ({
  popoverContent: {
    minWidth: '600px',
  },
  titleBar: {
    backgroundColor: theme.palette.primary.main,
    color: '#fff',
    paddingLeft: '16px',
    fontSize: '1.0rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeButton: {
    color: '#fff',
  },
  content: {
    padding: '16px',
  },
  actionBox: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '0 16px 16px 16px',
  },
  table: {
    borderCollapse: 'collapse',
    width: '100%',
  },
  headCell: {
    border: '1px solid #bbb',
    backgroundColor: '#ddd',
    fontWeight: 'normal',
  },
  head2Cell: {
    border: '1px solid #bbb',
    fontWeight: 'normal',
  },
  spaceRow: {
    height: '16px',
  },
  cell: {
    border: '1px solid #bbb',
  },
  checkCell: {
    border: '1px solid #bbb',
    textAlign: 'center',
  },
  textCell: {
    border: '1px solid #bbb',
    padding: '2px 8px',
  },
  numberCell: {
    border: '1px solid #bbb',
    padding: '2px 8px',
    textAlign: 'right',
  },
  searchCell: {
    border: '1px solid #bbb',
  },
});


class RecoPopover extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    open: PropTypes.bool,
    anchorEl: PropTypes.object,
    recoId: PropTypes.string,
    recoURL: PropTypes.string.isRequired,
    recoCompleteURL: PropTypes.string,
    reco: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
    this.binder1 = binder1(this);
  }

  handleClose() {
    this.props.dispatch(closeRecoPopover());
  }

  handleClickTransfer(tid, event) {
    if (event.button === 0) {
      event.preventDefault();
      this.props.history.push(`/t/${tid}`);
    }
  }

  renderTable() {
    const {
      classes,
      reco,
    } = this.props;

    if (!reco) {
      return <CircularProgress />;
    }

    const movementRows = reco.movements.map(movement => {
      const tid = dashed(movement.transfer_id);
      return (
        <tr key={`mv-${movement.id}`}>
          <td className={classes.checkCell}>
            <input type="checkbox" />
          </td>
          <td className={classes.numberCell}>
            {getCurrencyDeltaFormatter(movement.currency)(movement.delta)
            } {movement.currency}
          </td>
          <td className={classes.textCell}>
            <FormattedDate value={movement.ts}
              day="numeric" month="short" year="numeric" />
            {' '}
            <FormattedTime value={movement.ts}
              hour="numeric" minute="2-digit" second="2-digit" />
          </td>
          <td className={classes.numberCell}>
            <a href={`/t/${tid}`}
                onClick={this.binder1(this.handleClickTransfer, tid)}>
              {tid} ({movement.number})
            </a>
          </td>
        </tr>
      );
    });

    const accountEntryRows = [];

    return (
      <table className={classes.table}>
        <tbody>
          <tr>
            <th colSpan="4" className={classes.headCell}>Movements</th>
          </tr>
          <tr>
            <th width="10%" className={classes.checkCell}>
              <input type="checkbox" />
            </th>
            <th width="25%" className={classes.head2Cell}>Amount</th>
            <th width="25%" className={classes.head2Cell}>Date and Time</th>
            <th width="30%" className={classes.head2Cell}>Transfer (Movement #)</th>
          </tr>
          {movementRows}
          <tr>
            <td colSpan="4" className={classes.searchCell}></td>
          </tr>
          <tr>
            <td colSpan="4" className={classes.spaceRow}></td>
          </tr>
          <tr>
            <th colSpan="4"className={classes.headCell}>Account Entries</th>
          </tr>
          <tr>
            <th width="10%" className={classes.checkCell}>
              <input type="checkbox" />
            </th>
            <th width="25%" className={classes.head2Cell}>Amount</th>
            <th width="25%" className={classes.head2Cell}>Date</th>
            <th width="30%" className={classes.head2Cell}>Description</th>
          </tr>
          {accountEntryRows}
          <tr>
            <td colSpan="4" className={classes.searchCell}></td>
          </tr>
        </tbody>
      </table>
    );
  }

  render() {
    const {
      classes,
      open,
      anchorEl,
      recoId,
      recoURL,
      recoCompleteURL,
    } = this.props;

    let require = null;
    if (recoURL) {
      const requireURLs = [recoURL];
      if (recoCompleteURL) {
        requireURLs.push(recoCompleteURL);
      }
      require = <Require urls={requireURLs} fetcher={fOPNReport} />;
    }

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
        {require}
        <div className={classes.popoverContent}>
          <Typography variant="h6" className={classes.titleBar}>
            <span className={classes.popoverTitle}>Reconciliation {recoId}</span>
            <IconButton
              className={classes.closeButton}
              onClick={this.binder(this.handleClose)}
            >
              <Close />
            </IconButton>
          </Typography>
          <Typography className={classes.content} component="div">
            {this.renderTable()}
          </Typography>
          <div className={classes.actionBox}>
            {recoId ?
              <Button>Remove</Button>
              : null}
            <Button color="primary">Save</Button>
          </div>
        </div>
      </Popover>
    );
  }
}


function mapStateToProps(state) {
  const {ploop, file} = getPloopAndFile(state);
  const {recoPopover} = state.report;
  const {recoId, movementId, accountEntryId} = recoPopover;
  let recoURL, reco;
  let recoCompleteURL = null;

  if (ploop) {
    const query = (
      `ploop_key=${encodeURIComponent(ploop.ploop_key)}` +
      `&file_id=${encodeURIComponent(file ? file.file_id : 'current')}` +
      `&movement_id=${encodeURIComponent(movementId || '')}` +
      `&reco_id=${encodeURIComponent(recoId || '')}` +
      `&account_entry_id=${encodeURIComponent(accountEntryId || '')}`);
    recoURL = fOPNReport.pathToURL(`/reco?${query}`);
    reco = fetchcache.get(state, recoURL);

    if (reco) {
      // Now that the initial record is loaded, load the complete record,
      // which often takes longer because it updates all profiles and loops.
      recoCompleteURL = fOPNReport.pathToURL(`/reco-complete?${query}`);
      const recoComplete = fetchcache.get(state, recoCompleteURL);
      if (recoComplete) {
        reco = recoComplete;
      }
    }

  } else {
    recoURL = '';
    reco = null;
  }
  return {
    ...recoPopover,
    recoURL,
    recoCompleteURL,
    reco,
  };
}


export default compose(
  withStyles(styles, {withTheme: true}),
  withRouter,
  connect(mapStateToProps),
)(RecoPopover);
