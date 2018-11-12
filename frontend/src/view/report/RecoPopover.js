
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
import RemoveCircle from '@material-ui/icons/RemoveCircle';
import CircularProgress from '@material-ui/core/CircularProgress';
import Close from '@material-ui/icons/Close';
import Fade from '@material-ui/core/Fade';
import IconButton from '@material-ui/core/IconButton';
import Input from '@material-ui/core/Input';
import Popover from '@material-ui/core/Popover';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import Search from '@material-ui/icons/Search';
import Typography from '@material-ui/core/Typography';


const styles = theme => ({
  popoverContent: {
    minWidth: '700px',
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
    justifyContent: 'space-between',
    padding: '0 16px 16px 16px',
  },
  actionLeftButtons: {
    flexGrow: 2,
  },
  table: {
    borderCollapse: 'collapse',
    width: '100%',
  },
  headCell: {
    backgroundColor: '#ddd',
    border: '1px solid #bbb',
    fontWeight: 'normal',
  },
  head2Cell: {
    backgroundColor: '#ddd',
    border: '1px solid #bbb',
    fontWeight: 'normal',
  },
  spaceRow: {
    height: '16px',
  },
  cell: {
    border: '1px solid #bbb',
  },
  actionCell: {
    border: '1px solid #bbb',
    textAlign: 'center',
  },
  actionHeadCell: {
    backgroundColor: '#ddd',
    border: '1px solid #bbb',
    textAlign: 'center',
  },
  removeIcon: {
    cursor: 'pointer',
    color: '#777',
    display: 'block',
    margin: '0 auto',
  },
  removableRow: {
    transition: 'opacity 200ms ease',
  },
  removingRow: {
    opacity: 0,
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
    padding: '0 8px',
  },
  searchHeadCell: {
    paddingTop: '2px',
    textAlign: 'center',
  },
  searchIcon: {
    color: '#777',
    display: 'block',
    margin: '0 auto',
  },
  searchInput: {
    padding: 0,
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
    this.state = {
      popoverActions: null,
      reco: null,
      removingMovements: {},
      undoHistory: [],  // List of reco states
    };
  }

  componentDidUpdate(prevProps) {
    let recoState = this.state.reco;
    let initializing = false;

    if (this.props.open && !prevProps.open) {
      // Clear the old state.
      recoState = null;
      initializing = true;
    }

    if (!recoState && this.props.reco) {
      // Initialize the reco state.
      recoState = this.props.reco;
      initializing = true;
      this.updatePopoverPosition();
    }

    if (initializing) {
      this.setState({
        reco: recoState,
        undoHistory: [],
      });
    }
  }

  updatePopoverPosition() {
    const {popoverActions} = this.state;
    if (popoverActions) {
      popoverActions.updatePosition();
    }
  }

  handleClose() {
    this.props.dispatch(closeRecoPopover());
  }

  handleClickTransfer(tid, event) {
    if (event.button === 0) {
      event.preventDefault();
      this.props.dispatch(closeRecoPopover());
      this.props.history.push(`/t/${tid}`);
    }
  }

  handleRemoveMovement(movementId) {
    this.setState({removingMovements: {
      ...this.state.removingMovements,
      [movementId]: true,
    }});

    window.setTimeout(() => {
      const {
        reco,
      } = this.state;

      const movements = [];
      reco.movements.forEach(movement => {
        if (movement.id !== movementId) {
          movements.push(movement);
        }
      });

      this.setState({
        reco: {
          ...reco,
          movements
        },
        removingMovements: {
          ...this.state.removingMovements,
          [movementId]: undefined,
        },
        undoHistory: [
          ...this.state.undoHistory,
          reco,
        ],
      });

      this.updatePopoverPosition();
    }, 200);
  }

  handleActionCallback(popoverActions) {
    this.setState({popoverActions});
  }

  handleUndo() {
    const {
      undoHistory,
    } = this.state;

    if (!undoHistory || !undoHistory.length) {
      return;
    }

    const len1 = undoHistory.length - 1;
    this.setState({
      reco: undoHistory[len1],
      undoHistory: undoHistory.slice(0, len1),
    });

    this.updatePopoverPosition();
  }

  renderTable() {
    const {
      classes,
    } = this.props;

    const {
      reco,
      removingMovements,
    } = this.state;

    if (!reco) {
      return <CircularProgress />;
    }

    const movementRows = reco.movements.map(movement => {
      const tid = dashed(movement.transfer_id);
      const mid = movement.id;
      const rowClass = `${classes.removableRow} ` + (
        removingMovements[mid] ? classes.removingRow : '');

      return (
        <tr key={`mv-${mid}`} className={rowClass}>
          <td className={classes.actionCell}>
            <RemoveCircle
              className={classes.removeIcon}
              onClick={this.binder1(this.handleRemoveMovement, mid)} />
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
            <th colSpan="4"className={classes.headCell}>Account Entries</th>
          </tr>
          <tr>
            <th width="10%" className={classes.actionHeadCell}></th>
            <th width="25%" className={classes.head2Cell}>Amount</th>
            <th width="25%" className={classes.head2Cell}>Date</th>
            <th width="30%" className={classes.head2Cell}>Description</th>
          </tr>
          {accountEntryRows}
          <tr>
            <td colSpan="4" className={classes.searchCell}></td>
          </tr>

          <tr>
            <td colSpan="4" className={classes.spaceRow}></td>
          </tr>

          <tr>
            <th colSpan="4" className={classes.headCell}>Movements</th>
          </tr>
          <tr>
            <th width="10%" className={classes.head2Cell}></th>
            <th width="25%" className={classes.head2Cell}>
              {reco.is_circ ? 'Vault' : 'Wallet'}
            </th>
            <th width="25%" className={classes.head2Cell}>Date and Time</th>
            <th width="30%" className={classes.head2Cell}>Transfer (Movement #)</th>
          </tr>
          {movementRows}
          <tr>
            <td className={classes.searchHeadCell}>
              <Search className={classes.searchIcon} />
            </td>
            <td className={classes.searchCell}>
              <Input classes={{input: classes.searchInput}} disableUnderline />
            </td>
            <td className={classes.searchCell}>
              <Input classes={{input: classes.searchInput}} disableUnderline />
            </td>
            <td className={classes.searchCell}>
              <Input classes={{input: classes.searchInput}} disableUnderline />
            </td>
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

    const {
      undoHistory,
    } = this.state;

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
        action={this.binder(this.handleActionCallback)}
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
            <div className={classes.actionLeftButtons}>
              <Button
                disabled={!undoHistory || !undoHistory.length}
                onClick={this.binder(this.handleUndo)}>Undo</Button>
            </div>
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
